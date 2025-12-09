import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

// Required links that MUST be included in every email
const REQUIRED_LINKS = {
  stormwind_website: {
    url: 'https://info.stormwind.com/',
    text: 'StormWind Website',
    context: 'General info about StormWind'
  },
  training_samples: {
    url: 'https://info.stormwind.com/training-samples',
    text: 'View Sample Courses',
    context: 'Course demos and previews'
  }
};

// Input validation schema
const MAX_TRANSCRIPT_LENGTH = 500_000;

function sanitizeUserInput(input: string): string {
  if (typeof input !== 'string') return '';
  return input.replace(/\0/g, '').replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '[REMOVED]').trim();
}

const generateSalesAssetsSchema = z.object({
  call_id: z.string().uuid().optional(), // Optional call_id to save assets to DB
  transcript: z.string()
    .min(100, "Transcript too short")
    .max(MAX_TRANSCRIPT_LENGTH, `Transcript too long (max ${MAX_TRANSCRIPT_LENGTH} chars)`)
    .transform(sanitizeUserInput),
  strategic_context: z.object({
    strategic_threading: z.object({
      relevance_map: z.array(z.object({
        pain_identified: z.string().max(1000),
        feature_pitched: z.string().max(1500),
        is_relevant: z.boolean(),
        reasoning: z.string().max(1500)
      })).max(50).optional(),
      missed_opportunities: z.array(z.string().max(1000)).max(20).optional()
    }).optional(),
    critical_gaps: z.array(z.object({
      category: z.string().max(100),
      description: z.string().max(500),
      impact: z.string().max(100),
      suggested_question: z.string().max(500)
    })).max(20).optional()
  }).optional(),
  psychology_context: z.object({
    prospect_persona: z.string().max(200).optional(),
    disc_profile: z.string().max(100).optional(),
    communication_style: z.object({
      tone: z.string().max(100).optional(),
      preference: z.string().max(200).optional()
    }).optional(),
    dos_and_donts: z.object({
      do: z.array(z.string().max(200)).max(10).optional(),
      dont: z.array(z.string().max(200)).max(10).optional()
    }).optional()
  }).optional(),
  account_name: z.string().max(200).transform(sanitizeUserInput).optional(),
  stakeholder_name: z.string().max(200).transform(sanitizeUserInput).optional()
});

const SALES_ASSETS_TOOL = {
  type: "function",
  function: {
    name: "generate_sales_assets",
    description: "Generate a follow-up recap email and internal CRM notes based on the call transcript and strategic context",
    parameters: {
      type: "object",
      properties: {
        recap_email: {
          type: "object",
          properties: {
            subject_line: { 
              type: "string", 
              description: "Professional email subject line. Use {{ProspectFirstName}} placeholder if referencing the prospect." 
            },
            body_markdown: { 
              type: "string", 
              description: "Email body in Markdown format with proper paragraphs, bold text, and markdown links. Must include required StormWind links." 
            }
          },
          required: ["subject_line", "body_markdown"]
        },
        internal_notes_markdown: {
          type: "string",
          description: "CRM-ready internal notes in markdown format with key points, next steps, and action items"
        }
      },
      required: ["recap_email", "internal_notes_markdown"]
    }
  }
};

const COPYWRITER_SYSTEM_PROMPT = `You are an expert Enterprise Sales Copywriter for StormWind Studios. 

**GOAL:** Write a post-call recap that is **under 150 words**. It must be skimmable on a mobile phone.

**STYLE RULES (Strict):**
1.  **NO "BECAUSE":** Do not start sentences with "Because you mentioned..." or "Since you need...". You must use Active Voice.
2.  **NO FLUFF:** Delete conversational fillers like "Despite your busy schedule" or "It was a pleasure." Start directly with "Thanks for..."
3.  **BULLETS:** Keep bullet points under 10 words each.

**MANDATORY LINKS:**
* [StormWind Website](https://info.stormwind.com/)
* [View Sample Courses](https://info.stormwind.com/training-samples)

**STRUCTURE (Markdown):**

**Subject Line Options:**
* Option 1: Recap: StormWind & {{CompanyName}} - [Primary Goal]
* Option 2: Next steps: {{TopicDiscussed}}

**Body:**

Hi {{ProspectFirstName}},

Thanks for discussing the team's training goals today.

**Current Priorities:**
* [Pain 1 - Max 10 words]
* [Pain 2 - Max 10 words]

**How We Help:**
[Direct mapping. Max 2 concise sentences.]
You mentioned [Pain 1]. Our [Solution 1] addresses this by [Result]. Regarding [Pain 2], our [Solution 2] allows your team to [Benefit].

See course examples here: [View Sample Courses](https://info.stormwind.com/training-samples).

**Agreed Next Steps:**
* [Action 1]
* [Action 2]

Find more details on our solutions here: [StormWind Website](https://info.stormwind.com/).
`;

interface CriticalGap {
  category: string;
  description: string;
  impact: string;
  suggested_question: string;
}

interface PsychologyContext {
  prospect_persona?: string;
  disc_profile?: string;
  communication_style?: {
    tone?: string;
    preference?: string;
  };
  dos_and_donts?: {
    do?: string[];
    dont?: string[];
  };
}

interface StrategicContext {
  strategic_threading?: {
    relevance_map?: Array<{
      pain_identified: string;
      feature_pitched: string;
      is_relevant: boolean;
      reasoning: string;
    }>;
    missed_opportunities?: string[];
  };
  critical_gaps?: CriticalGap[];
}

// Validate that the email contains required links
function validateEmailLinks(emailBody: string): { valid: boolean; missing: string[] } {
  const missing: string[] = [];
  
  if (!emailBody.includes(REQUIRED_LINKS.stormwind_website.url)) {
    missing.push('StormWind Website link');
  }
  if (!emailBody.includes(REQUIRED_LINKS.training_samples.url)) {
    missing.push('Training Samples link');
  }
  
  return { valid: missing.length === 0, missing };
}

// Validate email quality
function validateEmailQuality(emailBody: string): { valid: boolean; warnings: string[] } {
  const warnings: string[] = [];
  const wordCount = emailBody.split(/\s+/).filter(Boolean).length;
  
  if (wordCount < 75) {
    warnings.push(`Email too short (${wordCount} words, minimum 75)`);
  }
  if (wordCount > 200) {
    warnings.push(`Email too long (${wordCount} words, maximum 175 recommended)`);
  }
  
  // Check for placeholder integrity (shouldn't have hallucinated names)
  if (emailBody.match(/\bDear\s+[A-Z][a-z]+\b/) && !emailBody.includes('{{ProspectFirstName}}')) {
    warnings.push('Email may contain hallucinated name instead of placeholder');
  }
  
  return { valid: warnings.length === 0, warnings };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Verify auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Validate request body
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON in request body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const validation = generateSalesAssetsSchema.safeParse(body);
    if (!validation.success) {
      const errors = validation.error.errors.map(err => ({
        path: err.path.join('.'),
        message: err.message
      }));
      console.warn('[generate-sales-assets] Validation failed:', errors);
      return new Response(JSON.stringify({ error: 'Validation failed', issues: errors }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { call_id, transcript, strategic_context, psychology_context, account_name, stakeholder_name } = validation.data;

    console.log(`[generate-sales-assets] Generating assets for user ${user.id}${call_id ? `, call ${call_id}` : ''}`);

    // Build the context for the AI
    let contextSection = '';
    
    if (strategic_context) {
      const sc = strategic_context as StrategicContext;
      
      if (sc.strategic_threading?.relevance_map && sc.strategic_threading.relevance_map.length > 0) {
        contextSection += '\n\n**RELEVANCE MAP (Pain-to-Solution Connections):**\n';
        for (const mapping of sc.strategic_threading.relevance_map) {
          contextSection += `- Pain: "${mapping.pain_identified}" → Solution: "${mapping.feature_pitched}" (${mapping.is_relevant ? 'RELEVANT' : 'NOT RELEVANT'}: ${mapping.reasoning})\n`;
        }
      }
      
      if (sc.strategic_threading?.missed_opportunities && sc.strategic_threading.missed_opportunities.length > 0) {
        contextSection += '\n**MISSED OPPORTUNITIES (Pains not addressed):**\n';
        for (const missed of sc.strategic_threading.missed_opportunities) {
          contextSection += `- ${missed}\n`;
        }
      }

      if (sc.critical_gaps && sc.critical_gaps.length > 0) {
        contextSection += '\n**CRITICAL GAPS (Information missing from this deal):**\n';
        for (const gap of sc.critical_gaps) {
          contextSection += `- [${gap.impact} Impact] ${gap.category}: ${gap.description}\n`;
          contextSection += `  → Suggested question: "${gap.suggested_question}"\n`;
        }
      }
    }

    // Add psychology context if available
    let psychologySection = '';
    if (psychology_context) {
      const pc = psychology_context as PsychologyContext;
      psychologySection = `\n\n**PROSPECT PSYCHOLOGY:**
- **Persona:** ${pc.prospect_persona || 'Unknown'}
- **DISC Profile:** ${pc.disc_profile || 'Unknown'}
- **Preferred Tone:** ${pc.communication_style?.tone || 'Unknown'}
- **Communication Preference:** ${pc.communication_style?.preference || 'Unknown'}
- **DO:** ${pc.dos_and_donts?.do?.join('; ') || 'No specific guidance'}
- **DON'T:** ${pc.dos_and_donts?.dont?.join('; ') || 'No specific guidance'}`;
    }

    const userPrompt = `Generate a professional follow-up email and internal CRM notes for this sales call.

${account_name ? `**Account:** ${account_name}` : ''}
${stakeholder_name ? `**Primary Contact:** ${stakeholder_name}` : ''}
${contextSection}
${psychologySection}

**REMINDER:** 
- Use {{ProspectFirstName}}, {{CompanyName}} placeholders
- Include BOTH required links: [StormWind Website](https://info.stormwind.com/) and [View Sample Courses](https://info.stormwind.com/training-samples)
- Do NOT include a signature block
- Format the email body in Markdown (not HTML)

**CALL TRANSCRIPT:**
${transcript.substring(0, 30000)}`;

    const response = await fetch(LOVABLE_AI_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: COPYWRITER_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt }
        ],
        tools: [SALES_ASSETS_TOOL],
        tool_choice: { type: 'function', function: { name: 'generate_sales_assets' } },
        max_tokens: 4096,
        temperature: 0.5, // Reduced from 0.7 for more consistent output
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[generate-sales-assets] AI Gateway error ${response.status}:`, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'AI credits exhausted. Please add credits.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall || toolCall.function?.name !== 'generate_sales_assets') {
      console.error('[generate-sales-assets] No valid tool call in response:', aiResponse);
      throw new Error('Failed to generate sales assets - invalid AI response');
    }

    const salesAssets = JSON.parse(toolCall.function.arguments);
    
    // Validate the generated email
    const emailBody = salesAssets.recap_email?.body_markdown || salesAssets.recap_email?.body_html || '';
    const linkValidation = validateEmailLinks(emailBody);
    const qualityValidation = validateEmailQuality(emailBody);
    
    // Log warnings but don't fail
    if (!linkValidation.valid) {
      console.warn('[generate-sales-assets] Missing required links:', linkValidation.missing);
      salesAssets.validation_warnings = salesAssets.validation_warnings || [];
      salesAssets.validation_warnings.push(...linkValidation.missing.map(m => `Missing: ${m}`));
    }
    
    if (!qualityValidation.valid) {
      console.warn('[generate-sales-assets] Quality warnings:', qualityValidation.warnings);
      salesAssets.validation_warnings = salesAssets.validation_warnings || [];
      salesAssets.validation_warnings.push(...qualityValidation.warnings);
    }

    // Save to database if call_id is provided
    if (call_id) {
      console.log(`[generate-sales-assets] Saving assets to database for call ${call_id}`);
      
      const { error: updateError } = await supabase
        .from('ai_call_analysis')
        .update({
          sales_assets: salesAssets,
          sales_assets_generated_at: new Date().toISOString()
        })
        .eq('call_id', call_id);

      if (updateError) {
        console.error('[generate-sales-assets] Failed to save assets to database:', updateError);
        // Don't fail the request, just log the error
        salesAssets.save_error = 'Failed to persist assets to database';
      } else {
        console.log('[generate-sales-assets] Assets saved to database successfully');
        salesAssets.saved = true;
      }
    }
    
    console.log('[generate-sales-assets] Successfully generated sales assets');

    return new Response(JSON.stringify(salesAssets), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[generate-sales-assets] Error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});