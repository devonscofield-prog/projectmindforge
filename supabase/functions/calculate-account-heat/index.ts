import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AccountHeatAnalysis {
  score: number;
  temperature: "Hot" | "Warm" | "Lukewarm" | "Cold";
  trend: "Heating Up" | "Cooling Down" | "Stagnant";
  confidence: "High" | "Medium" | "Low";
  factors: {
    engagement: { score: number; weight: number; signals: string[] };
    relationship: { score: number; weight: number; signals: string[] };
    deal_progress: { score: number; weight: number; signals: string[] };
    call_quality: { score: number; weight: number; signals: string[] };
    timing: { score: number; weight: number; signals: string[] };
  };
  open_critical_gaps: { category: string; count: number }[];
  competitors_active: string[];
  recommended_actions: string[];
  risk_factors: string[];
  calculated_at: string;
}

function getTemperature(score: number): "Hot" | "Warm" | "Lukewarm" | "Cold" {
  if (score >= 70) return "Hot";
  if (score >= 50) return "Warm";
  if (score >= 25) return "Lukewarm";
  return "Cold";
}

function gradeToScore(grade: string | null): number {
  if (!grade) return 50;
  const gradeMap: Record<string, number> = {
    'A+': 100, 'A': 95, 'A-': 90,
    'B+': 85, 'B': 80, 'B-': 75,
    'C+': 70, 'C': 65, 'C-': 60,
    'D+': 55, 'D': 50, 'D-': 45,
    'F': 30
  };
  return gradeMap[grade] ?? 50;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prospect_id } = await req.json();
    
    if (!prospect_id) {
      return new Response(JSON.stringify({ error: 'prospect_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    console.log(`[AccountHeat] Calculating for prospect: ${prospect_id}`);

    // Fetch all relevant data in parallel
    const [
      prospectResult,
      callsResult,
      stakeholdersResult,
      activitiesResult,
      emailsResult,
      followUpsResult
    ] = await Promise.all([
      supabase.from('prospects').select('*').eq('id', prospect_id).single(),
      supabase.from('call_transcripts')
        .select('id, call_date, analysis_status')
        .eq('prospect_id', prospect_id)
        .is('deleted_at', null)
        .order('call_date', { ascending: false }),
      supabase.from('stakeholders')
        .select('*')
        .eq('prospect_id', prospect_id)
        .is('deleted_at', null),
      supabase.from('prospect_activities')
        .select('*')
        .eq('prospect_id', prospect_id)
        .gte('activity_date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]),
      supabase.from('email_logs')
        .select('*')
        .eq('prospect_id', prospect_id)
        .is('deleted_at', null)
        .gte('email_date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]),
      supabase.from('account_follow_ups')
        .select('*')
        .eq('prospect_id', prospect_id)
        .eq('status', 'pending')
    ]);

    if (prospectResult.error || !prospectResult.data) {
      console.error('[AccountHeat] Prospect not found:', prospectResult.error);
      return new Response(JSON.stringify({ error: 'Prospect not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const prospect = prospectResult.data;
    const calls = callsResult.data || [];
    const stakeholders = stakeholdersResult.data || [];
    const activities = activitiesResult.data || [];
    const emails = emailsResult.data || [];
    const pendingFollowUps = followUpsResult.data || [];

    // Fetch analyses for calls
    const callIds = calls.filter(c => c.analysis_status === 'completed').map(c => c.id);
    let analyses: any[] = [];
    if (callIds.length > 0) {
      const analysesResult = await supabase
        .from('ai_call_analysis')
        .select('call_id, analysis_coaching, analysis_strategy, deal_heat_analysis')
        .in('call_id', callIds)
        .is('deleted_at', null);
      analyses = analysesResult.data || [];
    }

    // Calculate each factor
    const now = new Date();

    // 1. ENGAGEMENT (15%)
    const engagementSignals: string[] = [];
    let engagementScore = 0;
    
    const lastContactDate = prospect.last_contact_date ? new Date(prospect.last_contact_date) : null;
    if (lastContactDate) {
      const daysSinceContact = Math.floor((now.getTime() - lastContactDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysSinceContact <= 7) {
        engagementScore += 30;
        engagementSignals.push(`Contacted within ${daysSinceContact} days`);
      } else if (daysSinceContact <= 14) {
        engagementScore += 20;
        engagementSignals.push(`Last contact ${daysSinceContact} days ago`);
      } else if (daysSinceContact <= 30) {
        engagementScore += 10;
        engagementSignals.push(`Last contact ${daysSinceContact} days ago`);
      } else {
        engagementSignals.push(`No contact in ${daysSinceContact}+ days`);
      }
    } else {
      engagementSignals.push('No contact date recorded');
    }

    const inboundEmails = emails.filter(e => e.direction === 'inbound').length;
    engagementScore += Math.min(inboundEmails * 20, 40);
    if (inboundEmails > 0) {
      engagementSignals.push(`${inboundEmails} inbound emails in 30 days`);
    }

    const activityCount = activities.length;
    engagementScore += Math.min(activityCount * 10, 30);
    if (activityCount > 0) {
      engagementSignals.push(`${activityCount} activities logged`);
    }

    engagementScore = Math.min(engagementScore, 100);

    // 2. RELATIONSHIP (20%)
    const relationshipSignals: string[] = [];
    let relationshipScore = 0;

    const highInfluenceStakeholders = stakeholders.filter(s => s.influence_level === 'high');
    const champions = stakeholders.filter(s => s.champion_score && s.champion_score >= 7);
    const primaryContact = stakeholders.find(s => s.is_primary_contact);

    if (primaryContact) {
      relationshipScore += 20;
      relationshipSignals.push(`Primary contact: ${primaryContact.name}`);
    }

    if (highInfluenceStakeholders.length > 0) {
      relationshipScore += Math.min(highInfluenceStakeholders.length * 20, 40);
      relationshipSignals.push(`${highInfluenceStakeholders.length} high-influence stakeholder(s)`);
    }

    if (champions.length > 0) {
      relationshipScore += Math.min(champions.length * 15, 30);
      relationshipSignals.push(`${champions.length} champion(s) identified`);
    }

    if (stakeholders.length === 0) {
      relationshipSignals.push('No stakeholders mapped');
    }

    relationshipScore = Math.min(relationshipScore, 100);

    // 3. DEAL PROGRESS (25%)
    const dealProgressSignals: string[] = [];
    let dealProgressScore = 0;

    // Aggregate critical gaps from all analyses
    const allGaps: Record<string, number> = {};
    let competitorsActive: string[] = [];
    
    for (const analysis of analyses) {
      const strategy = analysis.analysis_strategy;
      if (strategy?.critical_gaps) {
        for (const gap of strategy.critical_gaps) {
          allGaps[gap.category] = (allGaps[gap.category] || 0) + 1;
        }
      }
      if (strategy?.competitors_mentioned) {
        competitorsActive = [...new Set([...competitorsActive, ...strategy.competitors_mentioned])];
      }
    }

    const hasBudgetGap = allGaps['Budget'] > 0;
    const hasAuthorityGap = allGaps['Authority'] > 0;

    if (!hasBudgetGap && !hasAuthorityGap) {
      dealProgressScore += 40;
      dealProgressSignals.push('No Budget/Authority gaps');
    } else {
      if (hasBudgetGap) dealProgressSignals.push('Budget gap unresolved');
      if (hasAuthorityGap) dealProgressSignals.push('Authority gap unresolved');
    }

    if (prospect.active_revenue && prospect.active_revenue > 0) {
      dealProgressScore += 20;
      dealProgressSignals.push(`Active revenue: $${prospect.active_revenue.toLocaleString()}`);
    }

    if (prospect.status === 'active') {
      dealProgressScore += 20;
      dealProgressSignals.push('Status: Active');
    }

    const totalGapCount = Object.values(allGaps).reduce((a, b) => a + b, 0);
    if (totalGapCount > 3) {
      dealProgressScore -= 20;
      dealProgressSignals.push(`${totalGapCount} critical gaps across calls`);
    }

    dealProgressScore = Math.max(0, Math.min(dealProgressScore, 100));

    // 4. CALL QUALITY (20%)
    const callQualitySignals: string[] = [];
    let callQualityScore = 0;

    const grades: number[] = [];
    const heatScores: number[] = [];

    for (const analysis of analyses) {
      const coaching = analysis.analysis_coaching;
      if (coaching?.overall_grade) {
        grades.push(gradeToScore(coaching.overall_grade));
      }
      const heat = analysis.deal_heat_analysis;
      if (heat?.heat_score) {
        heatScores.push(heat.heat_score);
      }
    }

    if (grades.length > 0) {
      const avgGrade = grades.reduce((a, b) => a + b, 0) / grades.length;
      callQualityScore += avgGrade * 0.5;
      callQualitySignals.push(`Avg coach grade: ${Math.round(avgGrade)}%`);
    }

    if (heatScores.length > 0) {
      const avgHeat = heatScores.reduce((a, b) => a + b, 0) / heatScores.length;
      callQualityScore += avgHeat * 0.5;
      callQualitySignals.push(`Avg deal heat: ${Math.round(avgHeat)}`);
      
      // Check trend
      if (heatScores.length >= 2) {
        const recentHeat = heatScores.slice(0, Math.ceil(heatScores.length / 2));
        const olderHeat = heatScores.slice(Math.ceil(heatScores.length / 2));
        const recentAvg = recentHeat.reduce((a, b) => a + b, 0) / recentHeat.length;
        const olderAvg = olderHeat.reduce((a, b) => a + b, 0) / olderHeat.length;
        if (recentAvg > olderAvg + 5) {
          callQualityScore += 10;
          callQualitySignals.push('Deal heat trending up');
        } else if (recentAvg < olderAvg - 5) {
          callQualityScore -= 10;
          callQualitySignals.push('Deal heat trending down');
        }
      }
    }

    if (calls.length === 0) {
      callQualitySignals.push('No calls recorded');
    } else {
      callQualitySignals.push(`${calls.length} call(s) total`);
    }

    callQualityScore = Math.max(0, Math.min(callQualityScore, 100));

    // 5. TIMING (20%)
    const timingSignals: string[] = [];
    let timingScore = 0;

    const opportunityDetails = prospect.opportunity_details as any;
    const aiExtractedInfo = prospect.ai_extracted_info as any;

    // Check for timeline signals
    if (opportunityDetails?.timeline || aiExtractedInfo?.timeline) {
      timingScore += 40;
      timingSignals.push('Timeline identified');
    }

    if (opportunityDetails?.budget_confirmed || aiExtractedInfo?.budget_range) {
      timingScore += 30;
      timingSignals.push('Budget information available');
    }

    if (aiExtractedInfo?.compelling_event) {
      timingScore += 30;
      timingSignals.push('Compelling event identified');
    }

    if (timingScore === 0) {
      timingSignals.push('No timing signals detected');
    }

    timingScore = Math.min(timingScore, 100);

    // Calculate weighted total
    const weights = {
      engagement: 15,
      relationship: 20,
      deal_progress: 25,
      call_quality: 20,
      timing: 20
    };

    const totalScore = Math.round(
      (engagementScore * weights.engagement +
       relationshipScore * weights.relationship +
       dealProgressScore * weights.deal_progress +
       callQualityScore * weights.call_quality +
       timingScore * weights.timing) / 100
    );

    // Determine trend
    let trend: "Heating Up" | "Cooling Down" | "Stagnant" = "Stagnant";
    if (heatScores.length >= 2) {
      const recent = heatScores[0];
      const older = heatScores[heatScores.length - 1];
      if (recent > older + 10) trend = "Heating Up";
      else if (recent < older - 10) trend = "Cooling Down";
    }

    // Determine confidence
    let confidence: "High" | "Medium" | "Low" = "Low";
    if (calls.length >= 3 && stakeholders.length >= 2) {
      confidence = "High";
    } else if (calls.length >= 1 || stakeholders.length >= 1) {
      confidence = "Medium";
    }

    // Format open critical gaps
    const openCriticalGaps = Object.entries(allGaps).map(([category, count]) => ({
      category,
      count
    }));

    // Generate recommendations and risks using AI
    let recommendedActions: string[] = [];
    let riskFactors: string[] = [];

    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (lovableApiKey) {
      try {
        const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${lovableApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [{
              role: 'system',
              content: 'You are a sales strategy advisor. Provide concise, actionable recommendations.'
            }, {
              role: 'user',
              content: `Based on this account analysis, provide 3 recommended actions and 2-3 risk factors.

Account Score: ${totalScore}/100 (${getTemperature(totalScore)})
Engagement: ${engagementScore}/100 - ${engagementSignals.join(', ')}
Relationship: ${relationshipScore}/100 - ${relationshipSignals.join(', ')}
Deal Progress: ${dealProgressScore}/100 - ${dealProgressSignals.join(', ')}
Call Quality: ${callQualityScore}/100 - ${callQualitySignals.join(', ')}
Timing: ${timingScore}/100 - ${timingSignals.join(', ')}
Critical Gaps: ${openCriticalGaps.map(g => g.category).join(', ') || 'None'}
Competitors: ${competitorsActive.join(', ') || 'None identified'}

Respond in JSON format:
{
  "recommended_actions": ["action1", "action2", "action3"],
  "risk_factors": ["risk1", "risk2"]
}`
            }],
            max_tokens: 500
          })
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const content = aiData.choices?.[0]?.message?.content;
          if (content) {
            try {
              const jsonMatch = content.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                recommendedActions = parsed.recommended_actions || [];
                riskFactors = parsed.risk_factors || [];
              }
            } catch (e) {
              console.warn('[AccountHeat] Failed to parse AI response:', e);
            }
          }
        }
      } catch (e) {
        console.warn('[AccountHeat] AI enhancement failed:', e);
      }
    }

    // Fallback recommendations if AI failed
    if (recommendedActions.length === 0) {
      if (engagementScore < 50) recommendedActions.push('Schedule follow-up call to re-engage');
      if (relationshipScore < 50) recommendedActions.push('Identify and map key decision makers');
      if (hasBudgetGap) recommendedActions.push('Clarify budget availability and approval process');
      if (hasAuthorityGap) recommendedActions.push('Identify economic buyer and get them involved');
      if (timingScore < 50) recommendedActions.push('Establish clear timeline and compelling event');
    }

    if (riskFactors.length === 0) {
      if (hasBudgetGap || hasAuthorityGap) riskFactors.push('Critical gaps in Budget/Authority');
      if (engagementScore < 30) riskFactors.push('Low engagement - deal may be stalling');
      if (competitorsActive.length > 0) riskFactors.push(`Active competition: ${competitorsActive.join(', ')}`);
    }

    const analysis: AccountHeatAnalysis = {
      score: totalScore,
      temperature: getTemperature(totalScore),
      trend,
      confidence,
      factors: {
        engagement: { score: engagementScore, weight: weights.engagement, signals: engagementSignals },
        relationship: { score: relationshipScore, weight: weights.relationship, signals: relationshipSignals },
        deal_progress: { score: dealProgressScore, weight: weights.deal_progress, signals: dealProgressSignals },
        call_quality: { score: callQualityScore, weight: weights.call_quality, signals: callQualitySignals },
        timing: { score: timingScore, weight: weights.timing, signals: timingSignals }
      },
      open_critical_gaps: openCriticalGaps,
      competitors_active: competitorsActive,
      recommended_actions: recommendedActions.slice(0, 3),
      risk_factors: riskFactors.slice(0, 3),
      calculated_at: new Date().toISOString()
    };

    // Save to database
    const { error: updateError } = await supabase
      .from('prospects')
      .update({
        account_heat_score: totalScore,
        account_heat_analysis: analysis,
        account_heat_updated_at: new Date().toISOString()
      })
      .eq('id', prospect_id);

    if (updateError) {
      console.error('[AccountHeat] Failed to save:', updateError);
      return new Response(JSON.stringify({ error: 'Failed to save analysis' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[AccountHeat] Calculated score ${totalScore} (${analysis.temperature}) for prospect ${prospect_id}`);

    return new Response(JSON.stringify({ 
      success: true, 
      account_heat_score: totalScore,
      account_heat_analysis: analysis 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[AccountHeat] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
