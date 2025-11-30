import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Strict system prompt to prevent hallucination and ensure grounded responses
const ADMIN_TRANSCRIPT_ANALYSIS_PROMPT = `You are an expert sales analyst with access to a specific set of call transcripts. Your job is to analyze these transcripts and provide insights based ONLY on what is explicitly stated in them.

CRITICAL RULES - YOU MUST FOLLOW THESE:
1. ONLY reference information that is EXPLICITLY stated in the provided transcripts
2. If information is not in the transcripts, clearly state: "I don't see that information in the selected transcripts"
3. ALWAYS cite your sources using this format: **[Source: {AccountName} - {Date}]**
4. Never make assumptions about what was said - only report what is written
5. If asked about something not covered in the transcripts, clearly state you cannot answer that question
6. When comparing reps or calls, only use information from the provided transcripts
7. Do not hallucinate or infer information that isn't directly stated
8. When quoting, use exact quotes from the transcripts when possible

FORMAT GUIDELINES:
- Use bullet points for lists of findings
- Bold the citation sources for easy scanning
- Group related insights together
- Provide specific examples with quotes when available
- Start responses with a direct answer, then provide supporting evidence

You have access to transcripts from various sales calls. Analyze them carefully and provide grounded, evidence-based insights.`;

const RAG_SEARCH_PROMPT = `Extract 3-5 key search terms from this user question to find relevant transcript sections. Return ONLY a JSON array of search terms, nothing else.

Question: "{QUERY}"

Return format: ["term1", "term2", "term3"]`;

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

// Maximum transcripts for direct injection
const DIRECT_INJECTION_MAX = 20;
// Maximum chunks to include in RAG context
const RAG_CHUNK_LIMIT = 50;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { transcript_ids, messages, use_rag } = await req.json() as { 
      transcript_ids: string[]; 
      messages: Message[];
      use_rag?: boolean;
    };
    
    if (!transcript_ids || transcript_ids.length === 0) {
      return new Response(
        JSON.stringify({ error: 'transcript_ids are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const shouldUseRag = use_rag || transcript_ids.length > DIRECT_INJECTION_MAX;

    console.log(`[admin-transcript-chat] Starting analysis for ${transcript_ids.length} transcripts (RAG: ${shouldUseRag})`);

    // Get auth token and verify admin role
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

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    let transcriptContext: string;

    if (shouldUseRag) {
      // RAG mode: Use chunked search
      transcriptContext = await buildRagContext(
        supabase, 
        transcript_ids, 
        messages, 
        LOVABLE_API_KEY
      );
    } else {
      // Direct injection mode: Fetch full transcripts
      transcriptContext = await buildDirectContext(supabase, transcript_ids);
    }

    const systemPrompt = ADMIN_TRANSCRIPT_ANALYSIS_PROMPT;

    console.log(`[admin-transcript-chat] Calling Lovable AI with ${messages.length} messages`);

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-pro',
        messages: [
          { 
            role: 'system', 
            content: `${systemPrompt}\n\n## TRANSCRIPTS FOR ANALYSIS\n\n${transcriptContext}` 
          },
          ...messages
        ],
        stream: true,
        temperature: 0.3,
      })
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded, please try again in a moment' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Usage limit reached, please add credits' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await aiResponse.text();
      console.error('[admin-transcript-chat] AI Gateway error:', aiResponse.status, errorText);
      throw new Error(`AI Gateway error: ${aiResponse.status}`);
    }

    return new Response(aiResponse.body, {
      headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
    });

  } catch (error) {
    console.error('[admin-transcript-chat] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function buildDirectContext(
  supabase: any,
  transcriptIds: string[]
): Promise<string> {
  const { data: transcripts, error } = await supabase
    .from('call_transcripts')
    .select('id, call_date, account_name, call_type, raw_text, rep_id')
    .in('id', transcriptIds);

  if (error) {
    console.error('[admin-transcript-chat] Error fetching transcripts:', error);
    throw new Error('Failed to fetch transcripts');
  }

  if (!transcripts || transcripts.length === 0) {
    throw new Error('No transcripts found');
  }

  const repIds = [...new Set(transcripts.map((t: any) => t.rep_id))];
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, name')
    .in('id', repIds);

  const repMap = new Map((profiles || []).map((p: any) => [p.id, p.name]));

  let context = '';
  for (const transcript of transcripts) {
    const repName = repMap.get(transcript.rep_id) || 'Unknown Rep';
    context += `\n${'='.repeat(60)}\n`;
    context += `TRANSCRIPT: ${transcript.account_name || 'Unknown'} | ${transcript.call_date} | ${transcript.call_type || 'Call'}\n`;
    context += `Rep: ${repName}\n`;
    context += `${'='.repeat(60)}\n\n`;
    context += transcript.raw_text || '[No transcript text available]';
    context += '\n\n';
  }

  return context;
}

async function buildRagContext(
  supabase: any,
  transcriptIds: string[],
  messages: Message[],
  apiKey: string
): Promise<string> {
  // Get the latest user message for search
  const latestUserMessage = [...messages].reverse().find(m => m.role === 'user');
  if (!latestUserMessage) {
    throw new Error('No user message found');
  }

  console.log(`[admin-transcript-chat] RAG mode for ${transcriptIds.length} transcripts`);

  // First, ensure transcripts are chunked
  const { data: existingChunks } = await supabase
    .from('transcript_chunks')
    .select('transcript_id')
    .in('transcript_id', transcriptIds);

  const chunkedIds = new Set((existingChunks || []).map((c: any) => c.transcript_id));
  const unchunkedIds = transcriptIds.filter(id => !chunkedIds.has(id));

  // If there are unchunked transcripts, chunk them inline
  if (unchunkedIds.length > 0) {
    console.log(`[admin-transcript-chat] Chunking ${unchunkedIds.length} transcripts inline`);
    await chunkTranscriptsInline(supabase, unchunkedIds);
  }

  // Extract search terms from the query using AI
  const searchTerms = await extractSearchTerms(latestUserMessage.content, apiKey);
  console.log(`[admin-transcript-chat] Search terms: ${searchTerms.join(', ')}`);

  // Build full-text search query
  const searchQuery = searchTerms.join(' | ');

  // Search chunks using full-text search
  const { data: searchResults, error: searchError } = await supabase
    .from('transcript_chunks')
    .select('id, chunk_text, metadata, transcript_id')
    .in('transcript_id', transcriptIds)
    .textSearch('search_vector', searchQuery, { type: 'websearch' })
    .limit(RAG_CHUNK_LIMIT);

  if (searchError) {
    console.error('[admin-transcript-chat] Search error:', searchError);
    // Fallback to getting first chunks from each transcript
    return await buildFallbackContext(supabase, transcriptIds);
  }

  console.log(`[admin-transcript-chat] Found ${searchResults?.length || 0} relevant chunks`);

  // If no results from search, use fallback
  if (!searchResults || searchResults.length === 0) {
    return await buildFallbackContext(supabase, transcriptIds);
  }

  // Build context from search results
  let context = `Note: Using semantic search across ${transcriptIds.length} transcripts. Showing ${searchResults.length} most relevant sections.\n\n`;

  // Group chunks by transcript for better organization
  const chunksByTranscript = new Map<string, any[]>();
  for (const chunk of searchResults) {
    const tid = chunk.transcript_id;
    if (!chunksByTranscript.has(tid)) {
      chunksByTranscript.set(tid, []);
    }
    chunksByTranscript.get(tid)!.push(chunk);
  }

  for (const [transcriptId, chunks] of chunksByTranscript) {
    const meta = chunks[0].metadata;
    context += `\n${'='.repeat(60)}\n`;
    context += `TRANSCRIPT: ${meta.account_name || 'Unknown'} | ${meta.call_date} | ${meta.call_type || 'Call'}\n`;
    context += `Rep: ${meta.rep_name || 'Unknown'}\n`;
    context += `${'='.repeat(60)}\n\n`;
    
    for (const chunk of chunks.sort((a: any, b: any) => (a.chunk_index || 0) - (b.chunk_index || 0))) {
      context += chunk.chunk_text + '\n\n---\n\n';
    }
  }

  return context;
}

async function extractSearchTerms(query: string, apiKey: string): Promise<string[]> {
  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { 
            role: 'user', 
            content: RAG_SEARCH_PROMPT.replace('{QUERY}', query)
          }
        ],
        temperature: 0,
      })
    });

    if (!response.ok) {
      console.error('[admin-transcript-chat] Failed to extract search terms');
      return query.toLowerCase().split(/\s+/).filter(w => w.length > 3).slice(0, 5);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    // Parse JSON array from response
    const match = content.match(/\[.*\]/s);
    if (match) {
      return JSON.parse(match[0]);
    }
    
    // Fallback: extract words from response
    return query.toLowerCase().split(/\s+/).filter(w => w.length > 3).slice(0, 5);
  } catch (error) {
    console.error('[admin-transcript-chat] Error extracting search terms:', error);
    return query.toLowerCase().split(/\s+/).filter(w => w.length > 3).slice(0, 5);
  }
}

async function buildFallbackContext(
  supabase: any,
  transcriptIds: string[]
): Promise<string> {
  // Get first few chunks from each transcript
  const chunksPerTranscript = Math.ceil(RAG_CHUNK_LIMIT / transcriptIds.length);
  
  const { data: chunks } = await supabase
    .from('transcript_chunks')
    .select('id, chunk_text, metadata, transcript_id, chunk_index')
    .in('transcript_id', transcriptIds)
    .order('chunk_index', { ascending: true })
    .limit(RAG_CHUNK_LIMIT);

  if (!chunks || chunks.length === 0) {
    throw new Error('No chunks available. Please try with fewer transcripts.');
  }

  let context = `Note: Showing first sections from ${transcriptIds.length} transcripts.\n\n`;

  const chunksByTranscript = new Map<string, any[]>();
  for (const chunk of chunks) {
    const tid = chunk.transcript_id;
    if (!chunksByTranscript.has(tid)) {
      chunksByTranscript.set(tid, []);
    }
    if (chunksByTranscript.get(tid)!.length < chunksPerTranscript) {
      chunksByTranscript.get(tid)!.push(chunk);
    }
  }

  for (const [transcriptId, transcriptChunks] of chunksByTranscript) {
    const meta = transcriptChunks[0].metadata;
    context += `\n${'='.repeat(60)}\n`;
    context += `TRANSCRIPT: ${meta.account_name || 'Unknown'} | ${meta.call_date} | ${meta.call_type || 'Call'}\n`;
    context += `Rep: ${meta.rep_name || 'Unknown'}\n`;
    context += `${'='.repeat(60)}\n\n`;
    
    for (const chunk of transcriptChunks) {
      context += chunk.chunk_text + '\n\n---\n\n';
    }
  }

  return context;
}

async function chunkTranscriptsInline(
  supabase: any,
  transcriptIds: string[]
): Promise<void> {
  const CHUNK_SIZE = 2000;
  const CHUNK_OVERLAP = 200;

  const { data: transcripts } = await supabase
    .from('call_transcripts')
    .select('id, call_date, account_name, call_type, raw_text, rep_id')
    .in('id', transcriptIds);

  if (!transcripts || transcripts.length === 0) return;

  const repIds = [...new Set(transcripts.map((t: any) => t.rep_id))];
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, name')
    .in('id', repIds);

  const repMap = new Map((profiles || []).map((p: any) => [p.id, p.name]));

  const allChunks: any[] = [];
  
  for (const transcript of transcripts) {
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

  if (allChunks.length > 0) {
    const { error } = await supabase
      .from('transcript_chunks')
      .insert(allChunks);
    
    if (error) {
      console.error('[admin-transcript-chat] Error inserting chunks:', error);
    }
  }
}

function chunkText(text: string, chunkSize: number, overlap: number): string[] {
  const chunks: string[] = [];
  if (!text || text.length === 0) return chunks;

  const paragraphs = text.split(/\n\n+/);
  let currentChunk = '';

  for (const paragraph of paragraphs) {
    if (currentChunk.length + paragraph.length > chunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      const overlapText = currentChunk.slice(-overlap);
      currentChunk = overlapText + '\n\n' + paragraph;
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}
