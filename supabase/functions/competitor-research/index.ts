import { createClient } from "@supabase/supabase-js";

// Declare EdgeRuntime for background tasks
declare const EdgeRuntime: {
  waitUntil(promise: Promise<unknown>): void;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Tool for extracting structured competitor intel
const COMPETITOR_INTEL_TOOL = {
  type: "function",
  function: {
    name: "submit_competitor_intel",
    description: "Submit structured competitive intelligence extracted from the competitor's website",
    parameters: {
      type: "object",
      properties: {
        overview: {
          type: "object",
          properties: {
            company_name: { type: "string" },
            tagline: { type: "string" },
            description: { type: "string" },
            founded_year: { type: "string" },
            headquarters: { type: "string" },
            employee_count: { type: "string" },
            target_market: { type: "string" },
          },
          required: ["company_name", "description", "target_market"],
        },
        products: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              description: { type: "string" },
              key_features: { type: "array", items: { type: "string" } },
            },
            required: ["name", "description"],
          },
        },
        pricing: {
          type: "object",
          properties: {
            model: { type: "string", description: "e.g., subscription, per-user, tiered" },
            tiers: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  price: { type: "string" },
                  features: { type: "array", items: { type: "string" } },
                },
              },
            },
            notes: { type: "string" },
          },
        },
        positioning: {
          type: "object",
          properties: {
            value_proposition: { type: "string" },
            key_differentiators: { type: "array", items: { type: "string" } },
            target_personas: { type: "array", items: { type: "string" } },
            messaging_themes: { type: "array", items: { type: "string" } },
          },
        },
        weaknesses: {
          type: "array",
          items: {
            type: "object",
            properties: {
              area: { type: "string" },
              description: { type: "string" },
              how_to_exploit: { type: "string" },
            },
            required: ["area", "description", "how_to_exploit"],
          },
        },
        battlecard: {
          type: "object",
          properties: {
            why_we_win: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  point: { type: "string" },
                  talk_track: { type: "string" },
                },
                required: ["point", "talk_track"],
              },
            },
            trap_questions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  question: { type: "string" },
                  why_it_works: { type: "string" },
                  expected_response: { type: "string" },
                },
                required: ["question", "why_it_works"],
              },
            },
            objection_handlers: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  objection: { type: "string" },
                  response: { type: "string" },
                },
                required: ["objection", "response"],
              },
            },
            landmines: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  topic: { type: "string" },
                  warning: { type: "string" },
                  pivot: { type: "string" },
                },
                required: ["topic", "warning", "pivot"],
              },
            },
          },
          required: ["why_we_win", "trap_questions", "objection_handlers"],
        },
      },
      required: ["overview", "products", "positioning", "weaknesses", "battlecard"],
    },
  },
};

// Background research function
async function runCompetitorResearch(
  competitor_id: string,
  formattedUrl: string,
  name: string,
  firecrawlApiKey: string,
  lovableApiKey: string
): Promise<void> {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    console.log('Background research started for:', formattedUrl);

    // Step 1: Map the site to discover key pages
    console.log('Mapping site structure...');
    const mapResponse = await fetch('https://api.firecrawl.dev/v1/map', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${firecrawlApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: formattedUrl,
        limit: 50,
        includeSubdomains: false,
      }),
    });

    let keyPages: string[] = [formattedUrl];
    if (mapResponse.ok) {
      const mapData = await mapResponse.json();
      const allLinks = mapData.links || [];
      
      const pricingPages = allLinks.filter((link: string) => 
        /pricing|plans|packages|cost/i.test(link)
      ).slice(0, 2);
      
      const featurePages = allLinks.filter((link: string) => 
        /features|product|solutions|platform|capabilities/i.test(link)
      ).slice(0, 2);
      
      const aboutPages = allLinks.filter((link: string) => 
        /about|company|team|story/i.test(link)
      ).slice(0, 1);
      
      keyPages = [formattedUrl, ...pricingPages, ...featurePages, ...aboutPages].slice(0, 5);
      console.log('Key pages to scrape:', keyPages);
    }

    // Step 2: Scrape homepage with branding
    console.log('Scraping homepage with branding...');
    const homepageResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${firecrawlApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: formattedUrl,
        formats: ['markdown', 'branding'],
        onlyMainContent: true,
        waitFor: 2000,
      }),
    });

    if (!homepageResponse.ok) {
      const errorText = await homepageResponse.text();
      console.error('Homepage scrape failed:', errorText);
      await supabase.from('competitors').update({ research_status: 'error', intel: null }).eq('id', competitor_id);
      return;
    }

    const homepageData = await homepageResponse.json();
    const branding = homepageData.data?.branding || null;
    let combinedContent = `# Homepage\n\n${homepageData.data?.markdown || ''}\n\n`;

    // Step 3: Scrape additional key pages
    for (const pageUrl of keyPages.slice(1)) {
      try {
        console.log('Scraping:', pageUrl);
        const pageResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${firecrawlApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            url: pageUrl,
            formats: ['markdown'],
            onlyMainContent: true,
            waitFor: 1500,
          }),
        });

        if (pageResponse.ok) {
          const pageData = await pageResponse.json();
          const pageName = pageUrl.split('/').pop() || 'Page';
          combinedContent += `\n\n# ${pageName}\n\n${pageData.data?.markdown || ''}\n\n`;
        }
      } catch (e) {
        console.warn('Failed to scrape page:', pageUrl, e);
      }
    }

    // Keep full content - no truncation for thorough research
    if (combinedContent.length > 100000) {
      combinedContent = combinedContent.substring(0, 100000) + '\n\n[Content truncated for processing]';
    }

    console.log('Total content length:', combinedContent.length);

    // Step 4: Extract intel using Lovable AI
    console.log('Extracting competitive intelligence with AI...');
    const systemPrompt = `You are a competitive intelligence analyst helping a sales team understand their competitors.

Analyze the provided website content and extract comprehensive competitive intelligence. Be thorough and specific.

For the battlecard section, create actionable sales tools:
- "Why We Win" should be specific differentiators with ready-to-use talk tracks
- "Trap Questions" should be questions that expose competitor weaknesses
- "Objection Handlers" should address common "why not use [competitor]?" objections
- "Landmines" should warn about topics to avoid or pivot away from

Be specific and actionable. Use concrete examples from the website content.`;

    const userPrompt = `Analyze this competitor's website content and extract structured competitive intelligence:

Company: ${name || 'Unknown'}
Website: ${formattedUrl}

--- WEBSITE CONTENT ---
${combinedContent}
--- END CONTENT ---

Extract comprehensive intel including overview, products, pricing (if visible), positioning, weaknesses, and create a detailed battlecard for the sales team.`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-pro-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        tools: [COMPETITOR_INTEL_TOOL],
        tool_choice: { type: 'function', function: { name: 'submit_competitor_intel' } },
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI extraction failed:', errorText);
      await supabase.from('competitors').update({ research_status: 'error', intel: null }).eq('id', competitor_id);
      return;
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall || toolCall.function.name !== 'submit_competitor_intel') {
      console.error('No valid tool call in response');
      await supabase.from('competitors').update({ research_status: 'error', intel: null }).eq('id', competitor_id);
      return;
    }

    let intel;
    try {
      intel = JSON.parse(toolCall.function.arguments);
    } catch (e) {
      console.error('Failed to parse AI response:', e);
      await supabase.from('competitors').update({ research_status: 'error', intel: null }).eq('id', competitor_id);
      return;
    }

    console.log('Intel extracted successfully, saving to database...');

    // Save to database
    const { error: updateError } = await supabase
      .from('competitors')
      .update({
        raw_content: { 
          scraped_pages: keyPages,
          content_length: combinedContent.length,
        },
        intel,
        branding,
        logo_url: branding?.images?.logo || branding?.logo || null,
        last_researched_at: new Date().toISOString(),
        research_status: 'completed',
      })
      .eq('id', competitor_id);

    if (updateError) {
      console.error('Database update failed:', updateError);
      await supabase.from('competitors').update({ research_status: 'error', intel: null }).eq('id', competitor_id);
      return;
    }

    console.log('Competitor research completed successfully for:', name);

  } catch (error) {
    console.error('Background research error:', error);
    await supabase.from('competitors').update({ research_status: 'error', intel: null }).eq('id', competitor_id);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { competitor_id, website, name } = await req.json();
    
    if (!website) {
      return new Response(
        JSON.stringify({ success: false, error: 'Website URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY');
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    
    if (!firecrawlApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Firecrawl API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (!lovableApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Lovable API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format URL
    let formattedUrl = website.trim();
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = `https://${formattedUrl}`;
    }

    console.log('Starting competitor research for:', formattedUrl);

    // If competitor_id provided, run in background and return immediately
    if (competitor_id) {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );

      // Update status to processing
      await supabase
        .from('competitors')
        .update({ research_status: 'processing' })
        .eq('id', competitor_id);

      // Run research in background - function continues after response
      EdgeRuntime.waitUntil(
        runCompetitorResearch(competitor_id, formattedUrl, name, firecrawlApiKey, lovableApiKey)
      );

      // Return immediately - research continues in background
      return new Response(
        JSON.stringify({ 
          success: true, 
          status: 'processing',
          message: 'Research started - this may take a few minutes',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If no competitor_id, run synchronously (for testing)
    // This path shouldn't normally be used in production
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'competitor_id is required for background processing',
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Competitor research error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
