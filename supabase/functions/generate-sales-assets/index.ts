import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MAX_AI_RETRIES = 2;
const AI_RETRY_DELAY_MS = 1000;

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Required links that MUST be included in every email
const REQUIRED_LINKS = {
  skill_assessments: {
    url: 'https://info.stormwind.com/skills-assessments',
    text: 'Skills Assessments',
    context: 'Skills testing and validation'
  },
  stormwind_ranges: {
    url: 'https://info.stormwind.com/ranges',
    text: 'Ranges',
    context: 'Hands-on lab environments'
  },
  course_samples: {
    url: 'https://info.stormwind.com/training-samples',
    text: 'Course Samples',
    context: 'Sample training content'
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
      // Accept both legacy strings and new structured objects
      missed_opportunities: z.array(z.union([
        z.string().max(1000),
        z.object({
          pain: z.string().max(500),
          severity: z.enum(['High', 'Medium']),
          suggested_pitch: z.string().max(500),
          talk_track: z.string().max(1000)
        })
      ])).max(20).optional()
    }).optional(),
    critical_gaps: z.array(z.object({
      category: z.string().max(100),
      description: z.string().max(500),
      impact: z.string().max(100),
      suggested_question: z.string().max(500)
    })).max(20).optional()
  }).optional(),
  psychology_context: z.object({
    prospect_persona: z.string().max(500).optional(),
    disc_profile: z.string().max(100).optional(),
    communication_style: z.object({
      tone: z.string().max(500).optional(),
      preference: z.string().max(1000).optional()
    }).optional(),
    dos_and_donts: z.object({
      do: z.array(z.string().max(500)).max(10).optional(),
      dont: z.array(z.string().max(500)).max(10).optional()
    }).optional()
  }).optional().transform((ctx) => {
    // Truncate overly long dos_and_donts strings as a fallback
    if (ctx?.dos_and_donts) {
      if (ctx.dos_and_donts.do) {
        ctx.dos_and_donts.do = ctx.dos_and_donts.do.map(s => s.length > 500 ? s.substring(0, 497) + '...' : s);
      }
      if (ctx.dos_and_donts.dont) {
        ctx.dos_and_donts.dont = ctx.dos_and_donts.dont.map(s => s.length > 500 ? s.substring(0, 497) + '...' : s);
      }
    }
    return ctx;
  }),
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
          description: `CRM-ready internal notes in markdown format. MUST use this exact structure with bold section headers and bullet points:

**Call Summary**
* One-sentence overview of the call purpose and outcome

**Key Discussion Points**
* Bullet 1: Important topic discussed
* Bullet 2: Another key point
* Bullet 3: Additional details

**Next Steps**
* Action item 1 with owner and deadline
* Action item 2 with owner and deadline

**Critical Gaps/Unknowns**
* Information still needed before deal can progress

**Competitor Intel**
* Any competitors mentioned and context (or "None mentioned" if not applicable)

**Deal Health**
* Current deal temperature (Hot/Warm/Cold) and reasoning`
        }
      },
      required: ["recap_email", "internal_notes_markdown"]
    }
  }
};

const COPYWRITER_SYSTEM_PROMPT = `You are an expert Enterprise Sales Copywriter for StormWind Studios.

**YOUR TASK:** Write a professional, personalized post-call recap email AND internal CRM notes.

**EMAIL TONE:**
- Professional and polished, but warm and personable
- Match the formality level to how the call actually went
- Confident without being pushy

**STRUCTURE:**
- Opening: 1-2 sentences acknowledging the conversation and their specific situation
- Body: 2-4 outcome-focused sections with **bold titles** (e.g., "Risk Mitigation", "Operational Speed")
  - Each section: 1-2 sentences focused on business value, not features
- Resources: Mention relevant links naturally within the body or as a single sentence
- Closing: Reference any attachments + clear next step with specific date if discussed
- Length: 150-300 words

**CRITICAL - DO NOT:**
- ❌ Create a "your needs" bullet list followed by a "our solutions" bullet list
- ❌ Use phrases like "To recap your needs..." or "Here are resources that address..."
- ❌ Map every pain point to a feature in a 1:1 list format
- ❌ Sound like a proposal template or marketing brochure
- ❌ Generic openers like "Thank you for taking the time to meet"

**DO:**
- ✅ Use bold outcome-focused headers (e.g., "**Risk Mitigation (Sandboxes):**")
- ✅ Keep each section to 1-2 sentences focused on their specific situation
- ✅ Reference specific details from the call (team size, concerns mentioned, etc.)
- ✅ Include clear next steps with dates when available

**REQUIRED LINKS (integrate naturally within sections):**
- [Skills Assessments](https://info.stormwind.com/skills-assessments)
- [Ranges](https://info.stormwind.com/ranges)
- [Course Samples](https://info.stormwind.com/training-samples)

**EXAMPLE OF GOOD EMAIL:**
---
{{ProspectFirstName}},

Great connecting with you. Given the history with previous training tools at {{CompanyName}}, it is clear that simply buying content isn't enough - you need adoption and practical application.

Based on our discussion, here is how we are structuring the partnership to ensure this doesn't become "shelfware" and delivers immediate value to the infrastructure team:

**Risk Mitigation (Sandboxes):** Your team can break/fix Azure, Server, and Security environments in our [Ranges](https://info.stormwind.com/ranges) rather than testing in production.

**Operational Speed (Storm AI):** Reducing troubleshooting time by giving the team instant answers based on verified documentation.

**Realistic Adoption:** Moving away from "certification mills" to a quarterly skill development plan (20-30 hours/year) that fits a busy 16-person team's schedule.

I've attached the Executive Brief we discussed. This highlights the ROI and specifically addresses the retention/adoption concerns for your leadership. You should have an email from Pandadoc with the official quote, once you have approval all we need to get you started is a signature and we can invoice with Net30 terms.

Here is a link to [Course Samples](https://info.stormwind.com/training-samples) with the full course list and detailed platform info.

I look forward to touching base on the 30th to review the feedback and hopefully schedule an onboarding.
---

**PLACEHOLDERS:**
- Use {{ProspectFirstName}} and {{CompanyName}} where names aren't available
- Do NOT include a signature block

**INTERNAL CRM NOTES:**
Use this structure with **bold headers** and bullet points:
- **Call Summary** - One sentence on purpose/outcome
- **Key Discussion Points** - What was actually discussed
- **Next Steps** - Who does what by when
- **Critical Gaps** - What info is still needed
- **Competitor Intel** - Any mentions (or "None")
- **Deal Health** - Hot/Warm/Cold with brief reasoning`;

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

interface MissedOpportunityObject {
  pain: string;
  severity: 'High' | 'Medium';
  suggested_pitch: string;
  talk_track: string;
}

interface StrategicContext {
  strategic_threading?: {
    relevance_map?: Array<{
      pain_identified: string;
      feature_pitched: string;
      is_relevant: boolean;
      reasoning: string;
    }>;
    missed_opportunities?: Array<string | MissedOpportunityObject>;
  };
  critical_gaps?: CriticalGap[];
}

// Validate that the email contains required links
function validateEmailLinks(emailBody: string): { valid: boolean; missing: string[] } {
  const missing: string[] = [];
  
  if (!emailBody.includes(REQUIRED_LINKS.skill_assessments.url)) {
    missing.push('Skill Assessments link');
  }
  if (!emailBody.includes(REQUIRED_LINKS.stormwind_ranges.url)) {
    missing.push('StormWind Ranges link');
  }
  if (!emailBody.includes(REQUIRED_LINKS.course_samples.url)) {
    missing.push('Course Samples link');
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
  // Removed upper word limit - we want substantive emails
  
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
          // Handle both string and object formats
          if (typeof missed === 'string') {
            contextSection += `- ${missed}\n`;
          } else {
            contextSection += `- [${missed.severity}] ${missed.pain}\n`;
            if (missed.talk_track) {
              contextSection += `  → Suggested talk track: "${missed.talk_track}"\n`;
            }
          }
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

**REMINDERS:** 
- Use {{ProspectFirstName}}, {{CompanyName}} placeholders where names aren't in the transcript
- Weave in all three required links naturally within the prose - NO separate resource section
- Write ONE flowing narrative, NOT a needs list followed by a solutions list
- No signature block needed
- Format in Markdown

**CALL TRANSCRIPT:**
${transcript.substring(0, 30000)}`;

    // Retry logic for handling transient AI failures (e.g., MALFORMED_FUNCTION_CALL)
    let salesAssets;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= MAX_AI_RETRIES; attempt++) {
      if (attempt > 0) {
        console.warn(`[generate-sales-assets] Retry attempt ${attempt} after malformed response`);
        await delay(AI_RETRY_DELAY_MS);
      }

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
          temperature: 0.5,
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
      const finishReason = aiResponse.choices?.[0]?.finish_reason;
      const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];

      // Check for malformed function call - retry if this occurs
      if (finishReason === 'MALFORMED_FUNCTION_CALL' || !toolCall) {
        console.warn(`[generate-sales-assets] Attempt ${attempt + 1}: Malformed response, finish_reason=${finishReason}`);
        lastError = new Error(`Malformed AI response (attempt ${attempt + 1})`);
        continue; // Try again
      }

      if (toolCall.function?.name !== 'generate_sales_assets') {
        console.error('[generate-sales-assets] Unexpected tool call:', toolCall.function?.name);
        lastError = new Error('Unexpected tool call from AI');
        continue;
      }

      // Success - parse and break out of retry loop
      try {
        salesAssets = JSON.parse(toolCall.function.arguments);
        break; // Success!
      } catch (parseError) {
        console.error('[generate-sales-assets] Failed to parse tool arguments:', parseError);
        lastError = new Error('Failed to parse AI response');
        continue;
      }
    }

    if (!salesAssets) {
      throw lastError || new Error('Failed to generate sales assets after all retries');
    }
    
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