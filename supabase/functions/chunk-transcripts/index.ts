import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// CORS: Restrict to production domains
function getCorsHeaders(origin?: string | null): Record<string, string> {
  const allowedOrigins = ['https://lovable.dev', 'https://www.lovable.dev'];
  const devPatterns = [/^https?:\/\/localhost(:\d+)?$/, /^https:\/\/[a-z0-9-]+\.lovableproject\.com$/, /^https:\/\/[a-z0-9-]+\.lovable\.app$/];
  const requestOrigin = origin || '';
  const isAllowed = allowedOrigins.includes(requestOrigin) || devPatterns.some(pattern => pattern.test(requestOrigin));
  return {
    'Access-Control-Allow-Origin': isAllowed ? requestOrigin : allowedOrigins[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

// Chunk size in characters (~500 tokens = ~2000 chars)
const CHUNK_SIZE = 2000;
const CHUNK_OVERLAP = 200;

serve(async (req) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { transcript_ids } = await req.json() as { transcript_ids: string[] };
    
    if (!transcript_ids || transcript_ids.length === 0) {
      return new Response(
        JSON.stringify({ error: 'transcript_ids are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[chunk-transcripts] Processing ${transcript_ids.length} transcripts`);

    // Verify admin role
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user is admin
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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

    // Check which transcripts already have chunks
    const { data: existingChunks } = await supabase
      .from('transcript_chunks')
      .select('transcript_id')
      .in('transcript_id', transcript_ids);

    const chunkedIds = new Set((existingChunks || []).map(c => c.transcript_id));
    const idsToChunk = transcript_ids.filter(id => !chunkedIds.has(id));

    console.log(`[chunk-transcripts] ${chunkedIds.size} already chunked, ${idsToChunk.length} to process`);

    if (idsToChunk.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'All transcripts already chunked',
          chunked: transcript_ids.length,
          new_chunks: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch transcripts to chunk
    const { data: transcripts, error: fetchError } = await supabase
      .from('call_transcripts')
      .select('id, call_date, account_name, call_type, raw_text, rep_id')
      .in('id', idsToChunk);

    if (fetchError) {
      console.error('[chunk-transcripts] Error fetching transcripts:', fetchError);
      throw new Error('Failed to fetch transcripts');
    }

    // Get rep names for metadata
    const repIds = [...new Set((transcripts || []).map(t => t.rep_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name')
      .in('id', repIds);

    const repMap = new Map((profiles || []).map(p => [p.id, p.name]));

    // Chunk each transcript
    const allChunks: any[] = [];
    
    for (const transcript of transcripts || []) {
      const chunks = chunkText(transcript.raw_text || '', CHUNK_SIZE, CHUNK_OVERLAP);
      const repName = repMap.get(transcript.rep_id) || 'Unknown';
      
      chunks.forEach((chunkText, index) => {
        allChunks.push({
          transcript_id: transcript.id,
          chunk_index: index,
          chunk_text: chunkText,
          metadata: {
            account_name: transcript.account_name || 'Unknown',
            call_date: transcript.call_date,
            call_type: transcript.call_type || 'Call',
            rep_name: repName,
            rep_id: transcript.rep_id,
          }
        });
      });
    }

    console.log(`[chunk-transcripts] Created ${allChunks.length} chunks from ${transcripts?.length || 0} transcripts`);

    // Insert chunks in batches
    const BATCH_SIZE = 100;
    for (let i = 0; i < allChunks.length; i += BATCH_SIZE) {
      const batch = allChunks.slice(i, i + BATCH_SIZE);
      const { error: insertError } = await supabase
        .from('transcript_chunks')
        .insert(batch);

      if (insertError) {
        console.error('[chunk-transcripts] Error inserting chunks:', insertError);
        throw new Error('Failed to insert chunks');
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Chunked ${transcripts?.length || 0} transcripts`,
        chunked: transcript_ids.length,
        new_chunks: allChunks.length 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[chunk-transcripts] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function chunkText(text: string, chunkSize: number, overlap: number): string[] {
  const chunks: string[] = [];
  
  if (!text || text.length === 0) {
    return chunks;
  }

  // Split by paragraphs/sections first for more natural chunks
  const paragraphs = text.split(/\n\n+/);
  let currentChunk = '';

  for (const paragraph of paragraphs) {
    // If adding this paragraph would exceed chunk size
    if (currentChunk.length + paragraph.length > chunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      // Start new chunk with overlap from end of previous
      const overlapText = currentChunk.slice(-overlap);
      currentChunk = overlapText + '\n\n' + paragraph;
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
    }
  }

  // Add final chunk
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  // If we only got one chunk that's too long, split by sentences
  if (chunks.length === 1 && chunks[0].length > chunkSize * 1.5) {
    return chunkBySentence(text, chunkSize, overlap);
  }

  return chunks;
}

function chunkBySentence(text: string, chunkSize: number, overlap: number): string[] {
  const chunks: string[] = [];
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  let currentChunk = '';

  for (const sentence of sentences) {
    if (currentChunk.length + sentence.length > chunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      const overlapText = currentChunk.slice(-overlap);
      currentChunk = overlapText + ' ' + sentence;
    } else {
      currentChunk += sentence;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}
