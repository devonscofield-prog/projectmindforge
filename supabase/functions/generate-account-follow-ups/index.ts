import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

// Rate limiting: 10 requests per minute per user (this is a heavier operation)
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 10;
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

// Passive cleanup: clean old entries during rate limit checks
function cleanupRateLimitEntries(): void {
  const now = Date.now();
  let cleaned = 0;
  for (const [key, value] of rateLimitMap.entries()) {
    if (now > value.resetTime) {
      rateLimitMap.delete(key);
      cleaned++;
      if (cleaned >= 10) break; // Limit cleanup per call
    }
  }
}

function checkRateLimit(userId: string): { allowed: boolean; retryAfter?: number } {
  // Passive cleanup on each check
  cleanupRateLimitEntries();
  
  const now = Date.now();
  const userLimit = rateLimitMap.get(userId);
  
  if (!userLimit || now > userLimit.resetTime) {
    rateLimitMap.set(userId, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true };
  }
  
  if (userLimit.count >= RATE_LIMIT_MAX_REQUESTS) {
    const retryAfter = Math.ceil((userLimit.resetTime - now) / 1000);
    return { allowed: false, retryAfter };
  }
  
  userLimit.count++;
  return { allowed: true };
}

// Update background job status helper
async function updateJobStatus(
  supabase: SupabaseClient,
  jobId: string | null,
  status: 'processing' | 'completed' | 'failed',
  error?: string
): Promise<void> {
  if (!jobId) return;
  
  const updates: Record<string, unknown> = { 
    status, 
    updated_at: new Date().toISOString() 
  };
  
  if (error) {
    updates.error = error;
  }
  
  if (status === 'processing') {
    updates.started_at = new Date().toISOString();
  }
  
  if (status === 'completed' || status === 'failed') {
    updates.completed_at = new Date().toISOString();
  }
  
  await supabase.from('background_jobs').update(updates).eq('id', jobId);
}

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

// Zod validation schema
const generateFollowUpsSchema = z.object({
  prospect_id: z.string().uuid({ message: "Invalid prospect_id UUID format" }),
  job_id: z.string().uuid().optional()
});

// Sales veteran system prompt for generating follow-up steps - Updated for Analysis 2.0
const FOLLOW_UP_SYSTEM_PROMPT = `You are a 20-year B2B/SaaS sales veteran and strategic account coach. You've closed hundreds of enterprise deals ranging from $50K to $5M ARR. You understand exactly what separates good follow-up from great follow-up that actually advances deals.

Your task is to analyze ALL call data for an account and generate 3-7 specific, actionable follow-up STEPS (not questions). Each step should be something the rep can execute TODAY to move the deal forward measurably.

**CRITICAL: USE THE RELEVANCE MAP**
You will receive a "Relevance Map" showing pain-to-solution connections from each call. Use this strategically:
- If the rep pitched a solution that was marked 'Relevant' (matched a pain), the follow-up should be to send a PROPOSAL for that solution with specific ROI examples.
- If there are 'Missed Opportunities' (pains the prospect mentioned but rep didn't address), the follow-up should be to CLARIFY that pain and pitch the appropriate solution.
- For 'Irrelevant' pitches (spray and pray), suggest a follow-up to re-qualify the prospect's actual needs before continuing.

GUIDELINES FOR GREAT FOLLOW-UP STEPS:
1. Be SPECIFIC - not "follow up with stakeholder" but "Schedule 30-min call with IT Director John to address security concerns raised in last call"
2. Be ACTIONABLE - concrete actions, not vague suggestions
3. Address GAPS - use the MEDDPICC scores to identify qualification gaps (low scores = missing info)
4. Consider TIMING - prioritize based on deal stage and urgency signals
5. Think MULTI-THREADING - always look for ways to engage more stakeholders

CATEGORIES:
- discovery: Uncover more info about pain, budget, timeline, decision process
- stakeholder: Expand multi-threading, engage decision makers, build champions
- objection: Address unresolved concerns with proof points, ROI data, references
- proposal: Advance toward commercial discussions, pricing, contracts
- relationship: Build champion strength, strengthen rapport, add value
- competitive: Counter competitive threats, differentiate, establish unique value

For each follow-up step, provide:
- title: Action verb + specific outcome (max 60 chars)
- description: 1-2 sentences with context on WHY this matters
- priority: high/medium/low based on deal impact and urgency
- category: one of the above
- ai_reasoning: 2-3 sentences explaining your veteran thinking - why this specific action, what it addresses, and what outcome to expect

Be direct. Be specific. Think like someone whose commission depends on this deal closing.`;

// Updated interfaces for Analysis 2.0
interface RelevanceMapItem {
  pain_identified: string;
  feature_pitched: string;
  is_relevant: boolean;
  reasoning: string;
}

interface StrategyAudit {
  strategic_threading?: {
    score?: number;
    grade?: 'Pass' | 'Fail';
    relevance_map?: RelevanceMapItem[];
    missed_opportunities?: string[];
  };
  meddpicc?: {
    overall_score?: number;
    breakdown?: Record<string, { score: number; evidence?: string | null; missing_info?: string | null }>;
  };
}

interface BehaviorScore {
  overall_score?: number;
  grade?: 'Pass' | 'Fail';
  coaching_tip?: string;
  metrics?: {
    patience?: { score: number; interruption_count: number };
    question_quality?: { score: number; open_ended_count: number; closed_count: number };
    monologue?: { score: number; violation_count: number; longest_turn_word_count: number };
    talk_listen_ratio?: { score: number; rep_talk_percentage: number };
    next_steps?: { score: number; secured: boolean; details: string };
  };
}

interface CallData {
  id: string;
  call_date: string;
  call_type: string | null;
  raw_text: string;
  analysis?: {
    call_summary?: string;
    deal_gaps?: { critical_missing_info?: string[]; unresolved_objections?: string[] };
    coach_output?: {
      critical_info_missing?: string[];
      recommended_follow_up_questions?: string[];
      heat_signature?: { score: number; explanation: string };
    };
    strengths?: Array<{ area: string; example: string }>;
    opportunities?: Array<{ area: string; example: string }>;
    // Analysis 2.0 fields
    analysis_strategy?: StrategyAudit;
    analysis_behavior?: BehaviorScore;
  };
}

interface FollowUpSuggestion {
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  category: 'discovery' | 'stakeholder' | 'objection' | 'proposal' | 'relationship' | 'competitive';
  ai_reasoning: string;
}

serve(async (req) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);
  
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase client with service role for backend operations
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse and validate request body
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const validation = generateFollowUpsSchema.safeParse(body);
    if (!validation.success) {
      const errors = validation.error.errors.map(err => ({
        path: err.path.join('.'),
        message: err.message
      }));
      console.warn('[generate-account-follow-ups] Validation failed:', errors);
      return new Response(
        JSON.stringify({ error: 'Validation failed', issues: errors }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { prospect_id, job_id } = validation.data;

    console.log(`[generate-account-follow-ups] Starting for prospect: ${prospect_id}${job_id ? ` (job: ${job_id})` : ''}`);
    
    // Mark job as processing
    await updateJobStatus(supabase, job_id || null, 'processing');

    // Check for internal service call (from analyze-call or other edge functions)
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    const isInternalServiceCall = token === supabaseServiceKey;

    if (isInternalServiceCall) {
      console.log('[generate-account-follow-ups] Internal service call detected, bypassing user auth');
    } else {
      // User call - verify JWT
      if (!authHeader) {
        return new Response(
          JSON.stringify({ error: 'Authorization required' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: { user }, error: authError } = await supabase.auth.getUser(token!);
      
      if (authError || !user) {
        return new Response(
          JSON.stringify({ error: 'Invalid authentication' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check rate limit for user calls only
      const rateLimit = checkRateLimit(user.id);
      if (!rateLimit.allowed) {
        console.log(`[generate-account-follow-ups] Rate limit exceeded for user: ${user.id}`);
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { 
            status: 429, 
            headers: { 
              ...corsHeaders, 
              'Content-Type': 'application/json',
              'Retry-After': String(rateLimit.retryAfter || 60)
            } 
          }
        );
      }
    }

    // Update prospect status to processing
    await supabase
      .from('prospects')
      .update({ follow_ups_generation_status: 'processing' })
      .eq('id', prospect_id);

    // Fetch prospect details
    const { data: prospect, error: prospectError } = await supabase
      .from('prospects')
      .select('*')
      .eq('id', prospect_id)
      .single();

    if (prospectError || !prospect) {
      console.error('[generate-account-follow-ups] Prospect not found:', prospectError);
      return new Response(
        JSON.stringify({ error: 'Prospect not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch all call transcripts for this prospect
    const { data: calls, error: callsError } = await supabase
      .from('call_transcripts')
      .select('id, call_date, call_type, raw_text')
      .eq('prospect_id', prospect_id)
      .order('call_date', { ascending: false });

    if (callsError) {
      console.error('[generate-account-follow-ups] Error fetching calls:', callsError);
      throw new Error('Failed to fetch call transcripts');
    }

    // Fetch analyses for all calls - include Analysis 2.0 fields
    const callIds = (calls || []).map(c => c.id);
    let analyses: Record<string, any> = {};
    
    if (callIds.length > 0) {
      const { data: analysisData } = await supabase
        .from('ai_call_analysis')
        .select('call_id, call_summary, deal_gaps, coach_output, strengths, opportunities, analysis_strategy, analysis_behavior')
        .in('call_id', callIds);
      
      if (analysisData) {
        analyses = analysisData.reduce((acc, a) => {
          acc[a.call_id] = a;
          return acc;
        }, {} as Record<string, any>);
      }
    }

    // Fetch stakeholders
    const { data: stakeholders } = await supabase
      .from('stakeholders')
      .select('id, name, job_title, influence_level, champion_score, is_primary_contact')
      .eq('prospect_id', prospect_id);

    // Fetch existing pending follow-ups to avoid duplicates
    const { data: existingFollowUps } = await supabase
      .from('account_follow_ups')
      .select('title, description')
      .eq('prospect_id', prospect_id)
      .eq('status', 'pending');

    // Fetch email logs for this prospect with stakeholder details
    const { data: emailLogs } = await supabase
      .from('email_logs')
      .select('direction, subject, body, email_date, contact_name, notes, stakeholder_id')
      .eq('prospect_id', prospect_id)
      .order('email_date', { ascending: false });

    // Create a map of stakeholders for easy lookup
    const stakeholderMap = new Map((stakeholders || []).map(s => [s.id, s]));

    // Build context for AI
    const callsWithAnalysis: CallData[] = (calls || []).map(call => ({
      ...call,
      analysis: analyses[call.id]
    }));

    // If no calls, generate basic follow-ups
    if (callsWithAnalysis.length === 0) {
      console.log('[generate-account-follow-ups] No calls found, generating basic follow-ups');
      
      const basicFollowUps: FollowUpSuggestion[] = [
        {
          title: 'Schedule initial discovery call',
          description: 'No calls recorded yet. Reach out to establish first contact and understand their current situation.',
          priority: 'high',
          category: 'discovery',
          ai_reasoning: 'Without any call data, the first priority is establishing contact. A discovery call will reveal pain points, timeline, and budget - the foundation for any deal.'
        }
      ];

      // Save follow-ups
      for (const followUp of basicFollowUps) {
        await supabase.from('account_follow_ups').insert({
          prospect_id,
          rep_id: prospect.rep_id,
          title: followUp.title,
          description: followUp.description,
          priority: followUp.priority,
          category: followUp.category,
          ai_reasoning: followUp.ai_reasoning,
          generated_from_call_ids: [],
          status: 'pending'
        });
      }

      // Update prospect status
      await supabase
        .from('prospects')
        .update({ 
          follow_ups_generation_status: 'completed',
          follow_ups_last_generated_at: new Date().toISOString()
        })
        .eq('id', prospect_id);

      return new Response(
        JSON.stringify({ success: true, count: basicFollowUps.length }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build comprehensive context
    const contextPrompt = buildContextPrompt(prospect, callsWithAnalysis, stakeholders || [], existingFollowUps || [], emailLogs || []);

    // Call Lovable AI Gateway
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    console.log('[generate-account-follow-ups] Calling Lovable AI for analysis...');

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: FOLLOW_UP_SYSTEM_PROMPT },
          { role: 'user', content: contextPrompt }
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'submit_follow_up_steps',
            description: 'Submit the generated follow-up steps for this account',
            parameters: {
              type: 'object',
              properties: {
                follow_ups: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      title: { type: 'string', description: 'Short action title (max 60 chars)' },
                      description: { type: 'string', description: '1-2 sentences with context' },
                      priority: { type: 'string', enum: ['high', 'medium', 'low'] },
                      category: { type: 'string', enum: ['discovery', 'stakeholder', 'objection', 'proposal', 'relationship', 'competitive'] },
                      ai_reasoning: { type: 'string', description: '2-3 sentences explaining the reasoning' }
                    },
                    required: ['title', 'description', 'priority', 'category', 'ai_reasoning']
                  },
                  minItems: 3,
                  maxItems: 7
                }
              },
              required: ['follow_ups']
            }
          }
        }],
        tool_choice: { type: 'function', function: { name: 'submit_follow_up_steps' } }
      })
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('[generate-account-follow-ups] AI Gateway error:', aiResponse.status, errorText);
      throw new Error(`AI Gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    console.log('[generate-account-follow-ups] AI response received');

    // Extract follow-ups from tool call
    let followUps: FollowUpSuggestion[] = [];
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    
    if (toolCall?.function?.arguments) {
      try {
        const args = JSON.parse(toolCall.function.arguments);
        followUps = args.follow_ups || [];
      } catch (e) {
        console.error('[generate-account-follow-ups] Failed to parse tool arguments:', e);
      }
    }

    if (followUps.length === 0) {
      console.warn('[generate-account-follow-ups] No follow-ups generated');
      await supabase
        .from('prospects')
        .update({ 
          follow_ups_generation_status: 'completed',
          follow_ups_last_generated_at: new Date().toISOString()
        })
        .eq('id', prospect_id);

      return new Response(
        JSON.stringify({ success: true, count: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Filter out duplicates (simple title similarity check)
    const existingTitles = new Set((existingFollowUps || []).map(f => f.title.toLowerCase()));
    const newFollowUps = followUps.filter(f => !existingTitles.has(f.title.toLowerCase()));

    console.log(`[generate-account-follow-ups] Saving ${newFollowUps.length} new follow-ups (filtered ${followUps.length - newFollowUps.length} duplicates)`);

    // Save new follow-ups
    for (const followUp of newFollowUps) {
      await supabase.from('account_follow_ups').insert({
        prospect_id,
        rep_id: prospect.rep_id,
        title: followUp.title,
        description: followUp.description,
        priority: followUp.priority,
        category: followUp.category,
        ai_reasoning: followUp.ai_reasoning,
        generated_from_call_ids: callIds,
        status: 'pending'
      });
    }

    // Update prospect status
    await supabase
      .from('prospects')
      .update({ 
        follow_ups_generation_status: 'completed',
        follow_ups_last_generated_at: new Date().toISOString()
      })
      .eq('id', prospect_id);

    // Mark job as completed
    await updateJobStatus(supabase, job_id || null, 'completed');

    console.log(`[generate-account-follow-ups] Completed successfully for prospect: ${prospect_id}`);

    return new Response(
      JSON.stringify({ success: true, count: newFollowUps.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[generate-account-follow-ups] Error:', error);
    
    // Try to update status to error if we have prospect_id and job_id
    try {
      const parsedBody = await req.clone().json();
      const { prospect_id, job_id } = parsedBody;
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      
      if (prospect_id) {
        await supabase
          .from('prospects')
          .update({ follow_ups_generation_status: 'error' })
          .eq('id', prospect_id);
      }
      
      // Mark job as failed
      await updateJobStatus(supabase, job_id || null, 'failed', error instanceof Error ? error.message : 'Unknown error');
    } catch (e) {
      // Ignore cleanup errors
    }

    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function buildContextPrompt(
  prospect: any,
  calls: CallData[],
  stakeholders: any[],
  existingFollowUps: any[],
  emailLogs: any[]
): string {
  let prompt = `## ACCOUNT OVERVIEW
Account Name: ${prospect.account_name || prospect.prospect_name}
Status: ${prospect.status}
Heat Score: ${prospect.heat_score || 'Not rated'}/10
Potential Revenue: ${prospect.potential_revenue ? `$${prospect.potential_revenue.toLocaleString()}` : 'Unknown'}

## STAKEHOLDERS (${stakeholders.length} total)
`;

  if (stakeholders.length > 0) {
    for (const s of stakeholders) {
      prompt += `- ${s.name}${s.job_title ? ` (${s.job_title})` : ''} - ${s.influence_level || 'unknown influence'}${s.champion_score ? `, Champion Score: ${s.champion_score}/10` : ''}${s.is_primary_contact ? ' [PRIMARY]' : ''}\n`;
    }
  } else {
    prompt += `- No stakeholders mapped yet\n`;
  }

  prompt += `\n## CALL HISTORY (${calls.length} calls, most recent first)\n`;

  for (const call of calls.slice(0, 5)) { // Limit to last 5 calls for context
    prompt += `\n### Call: ${call.call_date} (${call.call_type || 'Unknown type'})\n`;
    
    if (call.analysis) {
      if (call.analysis.call_summary) {
        prompt += `Summary: ${call.analysis.call_summary}\n`;
      }
      
      // === ANALYSIS 2.0: Strategic Context ===
      if (call.analysis.analysis_strategy) {
        const strategy = call.analysis.analysis_strategy as StrategyAudit;
        
        // Strategic Threading Score
        if (strategy.strategic_threading) {
          prompt += `Strategic Threading Score: ${strategy.strategic_threading.score ?? 'N/A'}/100 (${strategy.strategic_threading.grade || 'N/A'})\n`;
          
          // Relevance Map - CRITICAL for follow-up generation
          if (strategy.strategic_threading.relevance_map?.length) {
            prompt += `\n**RELEVANCE MAP (Pain-to-Solution Connections):**\n`;
            for (const mapping of strategy.strategic_threading.relevance_map) {
              const status = mapping.is_relevant ? '✓ RELEVANT' : '✗ IRRELEVANT';
              prompt += `- Pain: "${mapping.pain_identified}" → Solution: "${mapping.feature_pitched}" [${status}]\n`;
              if (!mapping.is_relevant) {
                prompt += `  Reason: ${mapping.reasoning}\n`;
              }
            }
          }
          
          // Missed Opportunities - CRITICAL for follow-up generation
          if (strategy.strategic_threading.missed_opportunities?.length) {
            prompt += `\n**MISSED OPPORTUNITIES (Pains NOT addressed):**\n`;
            for (const missed of strategy.strategic_threading.missed_opportunities) {
              prompt += `- ${missed}\n`;
            }
          }
        }
        
        // MEDDPICC Breakdown
        if (strategy.meddpicc) {
          prompt += `\nMEDDPICC Score: ${strategy.meddpicc.overall_score ?? 'N/A'}/100\n`;
          
          if (strategy.meddpicc.breakdown) {
            const lowScoreElements: string[] = [];
            for (const [element, data] of Object.entries(strategy.meddpicc.breakdown)) {
              if (data.score < 5 && data.missing_info) {
                lowScoreElements.push(`${element}: ${data.missing_info}`);
              }
            }
            if (lowScoreElements.length > 0) {
              prompt += `MEDDPICC Gaps (low scores): ${lowScoreElements.join('; ')}\n`;
            }
          }
        }
      }
      
      // === ANALYSIS 2.0: Behavioral Context ===
      if (call.analysis.analysis_behavior) {
        const behavior = call.analysis.analysis_behavior as BehaviorScore;
        prompt += `Behavior Score: ${behavior.overall_score ?? 'N/A'}/100 (${behavior.grade || 'N/A'})\n`;
        
        if (behavior.metrics?.next_steps) {
          const nextSteps = behavior.metrics.next_steps;
          prompt += `Next Steps: ${nextSteps.secured ? '✓ SECURED' : '✗ NOT SECURED'} - ${nextSteps.details}\n`;
        }
        
        if (behavior.coaching_tip) {
          prompt += `Coaching Tip: ${behavior.coaching_tip}\n`;
        }
      }
      
      // === Legacy Fields (fallback) ===
      if (!call.analysis.analysis_strategy) {
        if (call.analysis.deal_gaps?.critical_missing_info?.length) {
          prompt += `Missing Info: ${call.analysis.deal_gaps.critical_missing_info.join(', ')}\n`;
        }
        if (call.analysis.deal_gaps?.unresolved_objections?.length) {
          prompt += `Unresolved Objections: ${call.analysis.deal_gaps.unresolved_objections.join(', ')}\n`;
        }
        if (call.analysis.coach_output?.heat_signature) {
          prompt += `Heat: ${call.analysis.coach_output.heat_signature.score}/10 - ${call.analysis.coach_output.heat_signature.explanation}\n`;
        }
        if (call.analysis.opportunities?.length) {
          prompt += `Improvement Areas: ${call.analysis.opportunities.map((o: any) => o.area).join(', ')}\n`;
        }
      }
    }
    
    // Include abbreviated transcript for context
    const transcriptPreview = call.raw_text.substring(0, 1500);
    prompt += `Transcript excerpt: ${transcriptPreview}${call.raw_text.length > 1500 ? '...' : ''}\n`;
  }

  // Add email communication section
  if (emailLogs && emailLogs.length > 0) {
    prompt += `\n## EMAIL COMMUNICATION (${emailLogs.length} emails, most recent first)\n`;
    
    // Create a local stakeholder map for this function scope
    const localStakeholderMap = new Map(stakeholders.map(s => [s.id, s]));
    
    for (const email of emailLogs.slice(0, 10)) { // Limit to last 10 emails
      const direction = email.direction === 'outgoing' ? 'SENT' : 'RECEIVED';
      
      // Get stakeholder info if linked
      const linkedStakeholder = email.stakeholder_id ? localStakeholderMap.get(email.stakeholder_id) : null;
      
      let contactInfo = '';
      if (linkedStakeholder) {
        contactInfo = ` ${email.direction === 'outgoing' ? 'to' : 'from'} ${linkedStakeholder.name}`;
        if (linkedStakeholder.job_title) {
          contactInfo += ` (${linkedStakeholder.job_title}`;
          if (linkedStakeholder.influence_level) {
            contactInfo += `, ${linkedStakeholder.influence_level.replace('_', ' ')}`;
          }
          contactInfo += ')';
        }
        if (linkedStakeholder.is_primary_contact) {
          contactInfo += ' [PRIMARY CONTACT]';
        }
      } else if (email.contact_name) {
        contactInfo = ` ${email.direction === 'outgoing' ? 'to' : 'from'} ${email.contact_name} (not linked to stakeholder)`;
      }
      
      prompt += `\n### Email ${direction}${contactInfo} - ${email.email_date}\n`;
      
      if (email.subject) {
        prompt += `Subject: ${email.subject}\n`;
      }
      
      // Include abbreviated email body
      const bodyPreview = email.body.substring(0, 800);
      prompt += `Content: ${bodyPreview}${email.body.length > 800 ? '...' : ''}\n`;
      
      if (linkedStakeholder?.champion_score) {
        prompt += `Stakeholder Champion Score: ${linkedStakeholder.champion_score}/10\n`;
      }
      
      if (email.notes) {
        prompt += `Rep Notes: ${email.notes}\n`;
      }
    }
  }

  if (existingFollowUps.length > 0) {
    prompt += `\n## EXISTING PENDING FOLLOW-UPS (avoid duplicating these)\n`;
    for (const f of existingFollowUps) {
      prompt += `- ${f.title}\n`;
    }
  }

  prompt += `\n## YOUR TASK
Based on ALL the above context, especially the RELEVANCE MAP and MISSED OPPORTUNITIES, generate 3-7 specific, actionable follow-up steps that will advance this deal. 

REMEMBER:
- For RELEVANT pain-solution matches: Suggest sending proposals with ROI examples
- For MISSED OPPORTUNITIES: Suggest calls to clarify those pains
- For low MEDDPICC scores: Suggest discovery to fill those gaps

Think like your commission depends on it. Be specific, be strategic, prioritize what matters most RIGHT NOW.`;

  return prompt;
}
