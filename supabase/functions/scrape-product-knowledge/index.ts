/**
 * Scrape Product Knowledge - Firecrawl-powered StormWind website scraper
 * 
 * Maps and scrapes the StormWind website to build a product knowledge base.
 * Stores raw content in product_knowledge table and triggers chunking.
 */

import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Page type classification patterns
const PAGE_TYPE_PATTERNS: Record<string, RegExp[]> = {
  'pricing': [/pricing/i, /plans/i, /cost/i],
  'product': [/product/i, /solution/i, /training/i, /course/i, /certification/i],
  'feature': [/feature/i, /capability/i, /benefit/i],
  'documentation': [/docs?/i, /guide/i, /tutorial/i, /how-to/i, /faq/i],
  'about': [/about/i, /company/i, /team/i, /contact/i],
};

function classifyPageType(url: string, title: string): string {
  const combined = `${url} ${title}`.toLowerCase();
  
  for (const [type, patterns] of Object.entries(PAGE_TYPE_PATTERNS)) {
    if (patterns.some(p => p.test(combined))) {
      return type;
    }
  }
  return 'general';
}

interface ScrapeRequest {
  domain?: string;
  full_rescrape?: boolean;
  specific_urls?: string[];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse request
    const body: ScrapeRequest = await req.json().catch(() => ({}));
    
    // Get environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY');
    const stormwindDomain = body.domain || Deno.env.get('STORMWIND_DOMAIN') || 'stormwindstudios.com';

    if (!firecrawlApiKey) {
      console.error('[scrape-product-knowledge] FIRECRAWL_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Firecrawl API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Authenticate request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is admin
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (roleData?.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[scrape-product-knowledge] Starting scrape for domain: ${stormwindDomain}`);

    let urlsToScrape: string[] = [];

    if (body.specific_urls?.length) {
      // Scrape specific URLs
      urlsToScrape = body.specific_urls;
    } else {
      // Map the website to discover URLs
      console.log('[scrape-product-knowledge] Mapping website...');
      
      const mapResponse = await fetch('https://api.firecrawl.dev/v1/map', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${firecrawlApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: `https://${stormwindDomain}`,
          limit: 200,
          includeSubdomains: false,
        }),
      });

      if (!mapResponse.ok) {
        const errorText = await mapResponse.text();
        console.error('[scrape-product-knowledge] Map failed:', errorText);
        throw new Error(`Failed to map website: ${mapResponse.status}`);
      }

      const mapData = await mapResponse.json();
      urlsToScrape = mapData.links || [];
      console.log(`[scrape-product-knowledge] Found ${urlsToScrape.length} URLs`);
    }

    // Filter out unwanted URLs (assets, admin, etc.)
    const filteredUrls = urlsToScrape.filter(url => {
      const lower = url.toLowerCase();
      return !lower.includes('/admin') &&
             !lower.includes('/login') &&
             !lower.includes('/signup') &&
             !lower.includes('/cart') &&
             !lower.includes('/checkout') &&
             !lower.endsWith('.pdf') &&
             !lower.endsWith('.jpg') &&
             !lower.endsWith('.png') &&
             !lower.endsWith('.gif') &&
             !lower.includes('/api/');
    });

    console.log(`[scrape-product-knowledge] Scraping ${filteredUrls.length} filtered URLs`);

    // Get existing URLs if not doing a full rescrape
    let existingUrls = new Set<string>();
    if (!body.full_rescrape) {
      const { data: existing } = await supabase
        .from('product_knowledge')
        .select('source_url');
      existingUrls = new Set((existing || []).map(e => e.source_url));
    }

    // Scrape each URL
    const results = {
      scraped: 0,
      skipped: 0,
      errors: 0,
      urls_scraped: [] as string[],
    };

    // Process in batches of 5 to avoid rate limits
    const batchSize = 5;
    for (let i = 0; i < filteredUrls.length; i += batchSize) {
      const batch = filteredUrls.slice(i, i + batchSize);
      
      await Promise.all(batch.map(async (url) => {
        try {
          // Skip if already scraped (unless full rescrape)
          if (existingUrls.has(url) && !body.full_rescrape) {
            results.skipped++;
            return;
          }

          console.log(`[scrape-product-knowledge] Scraping: ${url}`);

          const scrapeResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${firecrawlApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              url,
              formats: ['markdown'],
              onlyMainContent: true,
            }),
          });

          if (!scrapeResponse.ok) {
            console.warn(`[scrape-product-knowledge] Scrape failed for ${url}: ${scrapeResponse.status}`);
            results.errors++;
            return;
          }

          const scrapeData = await scrapeResponse.json();
          const markdown = scrapeData.data?.markdown || scrapeData.markdown;
          const metadata = scrapeData.data?.metadata || scrapeData.metadata || {};
          const title = metadata.title || '';

          if (!markdown || markdown.length < 100) {
            console.warn(`[scrape-product-knowledge] Insufficient content for ${url}`);
            results.skipped++;
            return;
          }

          const pageType = classifyPageType(url, title);

          // Upsert the content
          const { error: upsertError } = await supabase
            .from('product_knowledge')
            .upsert({
              source_url: url,
              page_type: pageType,
              title,
              raw_markdown: markdown,
              metadata: {
                description: metadata.description,
                language: metadata.language,
                statusCode: metadata.statusCode,
              },
              scrape_status: 'completed',
              scraped_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }, { onConflict: 'source_url' });

          if (upsertError) {
            console.error(`[scrape-product-knowledge] Upsert error for ${url}:`, upsertError);
            results.errors++;
          } else {
            results.scraped++;
            results.urls_scraped.push(url);
          }

        } catch (err) {
          console.error(`[scrape-product-knowledge] Error scraping ${url}:`, err);
          results.errors++;
        }
      }));

      // Small delay between batches
      if (i + batchSize < filteredUrls.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log(`[scrape-product-knowledge] Complete. Scraped: ${results.scraped}, Skipped: ${results.skipped}, Errors: ${results.errors}`);

    // Trigger processing of new content
    if (results.scraped > 0) {
      console.log('[scrape-product-knowledge] Triggering content processing...');
      
      // Call process function in background
      fetch(`${supabaseUrl}/functions/v1/process-product-knowledge`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ process_all: false }),
      }).catch(err => console.warn('[scrape-product-knowledge] Process trigger warning:', err));
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        results,
        message: `Scraped ${results.scraped} pages, skipped ${results.skipped}, errors: ${results.errors}` 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[scrape-product-knowledge] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
