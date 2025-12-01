import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ResearchRequest {
  companyName: string;
  website?: string;
  industry?: string;
  stakeholders?: Array<{ name: string; title?: string; role?: string }>;
  productPitch?: string;
  dealStage?: string;
  knownChallenges?: string;
  additionalNotes?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const requestData: ResearchRequest = await req.json();
    const { companyName, website, industry, stakeholders, productPitch, dealStage, knownChallenges, additionalNotes } = requestData;

    if (!companyName) {
      return new Response(
        JSON.stringify({ error: 'Company name is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Starting account research for:', companyName);

    // Build context sections for the prompt
    const contextSections: string[] = [];
    
    if (website) {
      contextSections.push(`**Website**: ${website}`);
    }
    if (industry) {
      contextSections.push(`**Industry**: ${industry}`);
    }
    if (stakeholders && stakeholders.length > 0) {
      const stakeholderList = stakeholders
        .map(s => `- ${s.name}${s.title ? ` (${s.title})` : ''}${s.role ? ` - ${s.role}` : ''}`)
        .join('\n');
      contextSections.push(`**Key People**:\n${stakeholderList}`);
    }
    if (productPitch) {
      contextSections.push(`**What We're Selling**: ${productPitch}`);
    }
    if (dealStage) {
      contextSections.push(`**Deal Stage**: ${dealStage}`);
    }
    if (knownChallenges) {
      contextSections.push(`**Known Challenges**: ${knownChallenges}`);
    }
    if (additionalNotes) {
      contextSections.push(`**Additional Context**: ${additionalNotes}`);
    }

    const contextBlock = contextSections.length > 0 
      ? `\n\n## Context Provided by Sales Rep\n${contextSections.join('\n\n')}`
      : '';

    const systemPrompt = `You are a seasoned marketing and sales intelligence expert with 25+ years of experience at Fortune 500 companies. You've led competitive intelligence teams, closed multi-million dollar enterprise deals, and know exactly what information moves deals forward.

Your task is to research a company and provide actionable intelligence that helps close deals. Think like a VP of Sales who has seen thousands of deals—focus on what actually matters for winning business.

## Your Research Approach:
1. Synthesize information about the company from your training data
2. Identify specific pain points and challenges based on their industry and context
3. Research key stakeholders if provided (think LinkedIn-style insights)
4. Connect their likely challenges to potential solutions
5. Provide specific, actionable conversation hooks

## Your Response Style:
- Be specific and actionable, not generic
- Use bullet points for easy scanning
- Include specific names, dates, and facts when available
- If you're uncertain about something, say so rather than making things up
- Focus on insights that help WIN DEALS, not just general company info`;

    const userPrompt = `# Research Request: ${companyName}${contextBlock}

---

Please provide comprehensive sales intelligence in the following structure:

## 📊 Company Overview
- What they do, company size, headquarters, market position
- Recent news, announcements, or notable changes (from your training data)
- Key metrics or financial indicators if known

## 🎯 Industry Analysis & Pain Points
- Top 3-5 challenges companies in this industry typically face
- How these challenges specifically apply to ${companyName}
- Market pressures or competitive dynamics affecting them

${stakeholders && stakeholders.length > 0 ? `## 👥 Stakeholder Insights
For each key person provided, analyze:
- Their likely priorities based on their role
- What they probably care about most
- How to tailor your message to them
- Questions to ask them specifically
` : ''}

## 💡 Sales Conversation Hooks
- 3-5 specific talking points tailored to this company
- Opening lines that will resonate with their situation
- Ways to personalize outreach that show you've done your homework

## ❓ Discovery Questions
- 8-10 targeted questions to ask in discovery calls
- Questions that uncover budget, timeline, and decision process
- Questions that reveal pain points and priorities

${productPitch ? `## 🎯 Solution Alignment
- How what you're selling connects to their likely needs
- Specific benefits to emphasize for this company
- Potential objections and how to handle them
` : ''}

## 📈 Signals to Watch
- Hiring patterns that indicate buying intent
- Tech investments or changes to watch for
- Funding, M&A, or financial moves that matter

## ⚠️ Risks & Considerations
- Potential blockers or red flags for this deal
- Competitive threats to watch out for
- Timing considerations

Be specific and actionable. I'm preparing for a sales conversation and need intelligence that helps me WIN this deal.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-pro',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Payment required. Please add funds to continue.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: 'AI research failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Streaming research response for:', companyName);

    return new Response(response.body, {
      headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
    });

  } catch (error) {
    console.error('Account research error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
