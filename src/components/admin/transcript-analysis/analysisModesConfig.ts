import {
  DollarSign,
  Trophy,
  AlertTriangle,
  Swords,
  Target,
  TrendingUp,
  Users,
  Zap,
  Search,
  Crosshair,
  BarChart3,
  MessageSquareWarning,
  FileQuestion,
  Gauge,
  LucideIcon,
  Layers,
  ClipboardCheck,
  Briefcase,
  GraduationCap,
  Microscope,
  Shield,
  Handshake,
  Sparkles,
  UserCheck,
  Brain,
} from 'lucide-react';

export interface AnalysisMode {
  id: string;
  label: string;
  icon: LucideIcon;
  description: string;
  systemPromptAddition: string;
  starterQuestions: {
    icon: LucideIcon;
    label: string;
    prompt: string;
  }[];
}

export const ANALYSIS_MODES: AnalysisMode[] = [
  {
    id: 'general',
    label: 'General Analysis',
    icon: Search,
    description: 'Flexible analysis across all dimensions',
    systemPromptAddition: '',
    starterQuestions: [
      {
        icon: DollarSign,
        label: 'Revenue at Risk',
        prompt: 'Which deals have the highest revenue at risk? Look for warning signs: vague timelines, missing economic buyers, competitor momentum, price objections without value anchors, or "we\'ll get back to you" endings. Prioritize by deal size and give me specific rescue actions for each.',
      },
      {
        icon: Target,
        label: 'Forecast Reality Check',
        prompt: 'Based on the actual conversations (not what reps reported), which deals are likely to slip from their expected close dates? What concrete evidence supports or contradicts the committed timelines? Flag any deals where the prospect hasn\'t confirmed next steps.',
      },
      {
        icon: Layers,
        label: 'Stakeholder Map',
        prompt: 'Using the extracted entities from these transcripts, build a stakeholder map showing all people mentioned, their roles, and their relationships. Identify the key decision-makers vs. influencers vs. blockers based on how they\'re discussed across calls.',
      },
      {
        icon: Crosshair,
        label: 'Topic Hotspots',
        prompt: 'Analyze the topic distribution across these calls. Which topics (pricing, objections, discovery, demo, next_steps, etc.) came up most frequently? What patterns do you see? Are there topics that should have been discussed but weren\'t?',
      },
      {
        icon: Swords,
        label: 'Competitive Intelligence',
        prompt: 'Using the extracted competitor entities, build me a competitive battle card: For each competitor mentioned, show every mention with context, whether it was positive/negative for us, and how our rep responded. Include exact quotes.',
      },
      {
        icon: Zap,
        label: 'Monday Morning Actions',
        prompt: 'Give me 5 specific, high-impact actions we should take THIS WEEK based on these calls. Focus on deals we can save, coaching we can deliver, and competitive responses we need to prepare. Be specific about who should do what.',
      },
    ],
  },
  {
    id: 'deal_scoring',
    label: 'Deal Scoring',
    icon: Gauge,
    description: 'MEDDPICC framework evaluation and qualification scoring',
    systemPromptAddition: `
## DEAL SCORING MODE - MEDDPICC FRAMEWORK ANALYSIS

In this mode, focus EXCLUSIVELY on deal qualification using MEDDPICC criteria. For each deal:

**SCORING RUBRIC (1-5 scale):**
- 5 = Fully qualified, explicit evidence in transcript
- 4 = Strong signals, minor gaps
- 3 = Moderate evidence, notable gaps
- 2 = Weak signals, significant gaps
- 1 = No evidence or red flags

**ALWAYS structure your response as:**

### Deal: [Account Name]
| Criterion | Score | Evidence |
|-----------|-------|----------|
| **M**etrics | X/5 | [Specific quote or observation] |
| **E**conomic Buyer | X/5 | [Specific quote or observation] |
| **D**ecision Criteria | X/5 | [Specific quote or observation] |
| **D**ecision Process | X/5 | [Specific quote or observation] |
| **P**aper Process | X/5 | [Specific quote or observation] |
| **I**dentify Pain | X/5 | [Specific quote or observation] |
| **C**hampion | X/5 | [Specific quote or observation] |
| **C**ompetition | X/5 | [Specific quote or observation] |

**Overall Score: XX/40**
**Risk Level:** High/Medium/Low
**Top Priority Gap:** [What to fix first]
`,
    starterQuestions: [
      {
        icon: Gauge,
        label: 'Score All Deals',
        prompt: 'Score every deal in these transcripts using MEDDPICC (1-5 each criterion). Create a ranked table showing overall scores, highlight the weakest criterion for each deal, and recommend specific qualification questions reps should ask next.',
      },
      {
        icon: Layers,
        label: 'MEDDPICC Element Coverage',
        prompt: 'Using the MEDDPICC tags on each section, assess which qualification elements are well-covered vs. missing across these calls. Show me a gap analysis: which elements have strong evidence, and which are dangerously absent? Reference the specific tagged sections.',
      },
      {
        icon: AlertTriangle,
        label: 'Qualification Red Flags',
        prompt: 'Which deals have the most dangerous qualification gaps? Focus on: missing economic buyers, unclear decision criteria, no compelling event, weak champion signals, or unknown competition. Rank by revenue at risk.',
      },
      {
        icon: Target,
        label: 'Champion Health Check',
        prompt: 'For each deal, assess champion strength: Are they selling internally? Do they have access to power? Are they sharing information about the buying process? Score each champion 1-5 with evidence from sections tagged with "champion".',
      },
      {
        icon: TrendingUp,
        label: 'Next Best Actions',
        prompt: 'Based on MEDDPICC gaps, what\'s the single most important thing each rep should do in their next call to improve deal qualification? Be specific and actionable.',
      },
    ],
  },
  {
    id: 'rep_comparison',
    label: 'Rep Comparison',
    icon: Users,
    description: 'Compare techniques and identify coaching opportunities',
    systemPromptAddition: `
## REP COMPARISON MODE - PERFORMANCE BENCHMARKING

In this mode, focus on comparing rep techniques and identifying coaching opportunities.

**ANALYSIS FRAMEWORK:**

1. **Discovery Skills** - Quality and depth of questions asked
2. **Objection Handling** - How effectively concerns are addressed
3. **Value Articulation** - Connecting features to business outcomes
4. **Call Control** - Talk ratio, agenda setting, next steps
5. **Closing Technique** - Commitment language, urgency creation

**OUTPUT FORMAT:**

### Rep Performance Matrix
| Rep Name | Discovery | Objections | Value | Control | Closing | Overall |
|----------|-----------|------------|-------|---------|---------|---------|
| [Name]   | X/5       | X/5        | X/5   | X/5     | X/5     | X/5     |

### Teachable Moments
For each skill gap, include:
- **Rep:** [Name]
- **Skill:** [Area]
- **What They Did:** [Quote/observation]
- **Better Approach:** [Specific coaching]

### Top Performer Techniques
Highlight specific techniques from best reps that others can emulate.
`,
    starterQuestions: [
      {
        icon: BarChart3,
        label: 'Compare All Reps',
        prompt: 'Create a performance matrix comparing all reps across: discovery depth, objection handling, value articulation, call control, and closing skills. Score each 1-5 with specific examples. Who\'s the benchmark?',
      },
      {
        icon: Trophy,
        label: 'Top Rep Playbook',
        prompt: 'What are the best performers doing that others aren\'t? Extract specific techniques, phrases, and questions that win. I want a playbook I can share in our next team meeting.',
      },
      {
        icon: AlertTriangle,
        label: 'Urgent Coaching Needs',
        prompt: 'Which reps need immediate intervention? Identify the top 3 coaching priorities with evidence: specific mistakes, missed opportunities, or skill gaps. Include exact quotes.',
      },
      {
        icon: MessageSquareWarning,
        label: 'Talk Ratio Analysis',
        prompt: 'Analyze talk ratios and conversation balance. Who\'s talking too much vs letting the prospect speak? Include specific examples of reps who dominated vs. those who listened well.',
      },
    ],
  },
  {
    id: 'competitive',
    label: 'Competitive War Room',
    icon: Swords,
    description: 'Extract competitive intelligence and battle card insights',
    systemPromptAddition: `
## COMPETITIVE WAR ROOM MODE

In this mode, focus EXCLUSIVELY on competitive intelligence gathering.

**EXTRACT AND ORGANIZE:**

1. **Competitor Mentions** - Every competitor named and context
2. **Competitive Objections** - Specific concerns about us vs. them
3. **Their Strengths** - What prospects said competitors do well
4. **Their Weaknesses** - Gaps or concerns mentioned about competitors
5. **Win/Loss Themes** - Patterns in why we win or lose

**OUTPUT FORMAT:**

### Competitor: [Name]
**Frequency:** Mentioned in X of Y calls

**Positioning Against Us:**
- [Quote] - [Context]

**Their Perceived Strengths:**
- [Quote] - [Impact]

**Their Perceived Weaknesses:**
- [Quote] - [Opportunity]

**Effective Counter-Responses (from our reps):**
- [What worked]

**Battle Card Recommendation:**
[How to position against this competitor]
`,
    starterQuestions: [
      {
        icon: Swords,
        label: 'Build Battle Cards',
        prompt: 'Build comprehensive battle cards from these calls: For each competitor mentioned (look for ⚔️ competitor annotations), list their perceived strengths, weaknesses, objections they trigger, and our best counter-responses. Include exact quotes.',
      },
      {
        icon: Target,
        label: 'Competitor Mentions Deep Dive',
        prompt: 'Using the extracted competitor entities, show me every mention of each competitor across these calls. For each mention, note: the exact context, whether it was positive/negative for us, the prospect\'s sentiment, and how our rep responded.',
      },
      {
        icon: AlertTriangle,
        label: 'Where We\'re Losing',
        prompt: 'Where are we losing to competition and why? Identify specific gaps in our positioning, product concerns, or sales execution issues. Cross-reference competitor mentions with objection topics to find patterns.',
      },
      {
        icon: FileQuestion,
        label: 'Objection Library',
        prompt: 'Build an objection library: What competitive objections come up in sections tagged with both "objections" and "competitor_discussion"? How do our best reps handle them? Create a reference guide with proven responses.',
      },
    ],
  },
  {
    id: 'discovery_audit',
    label: 'Discovery Audit',
    icon: FileQuestion,
    description: 'Evaluate discovery call quality and identify gaps',
    systemPromptAddition: `
## DISCOVERY AUDIT MODE

In this mode, deeply analyze the quality of discovery conversations.

**EVALUATION CRITERIA:**

1. **Situation Questions** - Understanding current state
2. **Problem Questions** - Uncovering pain points  
3. **Implication Questions** - Expanding impact
4. **Need-Payoff Questions** - Building value

**DISCOVERY QUALITY INDICATORS:**
- Multi-level questioning (surface → root cause)
- Business impact quantification
- Stakeholder discovery
- Timeline/urgency establishment
- Budget/resource discussion

**OUTPUT FORMAT:**

### Discovery Scorecard: [Account/Rep]
| Dimension | Score | Evidence |
|-----------|-------|----------|
| Pain Depth | X/5 | [Quote showing pain uncovered or missed] |
| Business Impact | X/5 | [Was ROI/impact quantified?] |
| Stakeholder Map | X/5 | [Were all buyers identified?] |
| Urgency Established | X/5 | [Compelling event found?] |
| Budget Discussed | X/5 | [Investment comfort explored?] |

**Best Discovery Question Asked:**
[Quote]

**Missed Opportunity:**
[What should have been asked]
`,
    starterQuestions: [
      {
        icon: FileQuestion,
        label: 'Score Discovery Quality',
        prompt: 'Score the discovery quality in each call. Did reps uncover real pain? Quantify business impact? Map stakeholders? Establish urgency? Give each call a discovery score with specific evidence.',
      },
      {
        icon: Trophy,
        label: 'Best Discovery Questions',
        prompt: 'What were the best discovery questions asked across these calls? Find examples of questions that unlocked valuable information. I want to build a discovery question bank.',
      },
      {
        icon: AlertTriangle,
        label: 'Discovery Gaps',
        prompt: 'What critical discovery was missed? For each call, identify information that should have been uncovered but wasn\'t. What questions should reps have asked?',
      },
      {
        icon: TrendingUp,
        label: 'Pain Depth Analysis',
        prompt: 'How deep did reps go on pain? Did they stop at surface-level problems or dig into root causes and business impact? Show examples of shallow vs. deep pain discovery.',
      },
    ],
  },
  {
    id: 'forecast_validation',
    label: 'Forecast Validation',
    icon: BarChart3,
    description: 'Validate pipeline accuracy and close date commitments',
    systemPromptAddition: `
## FORECAST VALIDATION MODE

In this mode, act as a ruthless forecast auditor. Challenge every deal.

**VALIDATION CRITERIA:**

Look for CONCRETE evidence of:
1. **Verbal Commitments** - Did the prospect commit to dates/actions?
2. **Process Confirmation** - Is the buying process mapped?
3. **Budget Approval** - Is budget allocated/approved?
4. **Decision Timeline** - Is there a compelling event driving urgency?
5. **Next Steps Quality** - Are next steps specific and confirmed?

**RED FLAGS TO IDENTIFY:**
- Vague "we'll be in touch" endings
- No confirmed next meeting
- Missing stakeholders from discussions
- "We need to think about it" without timeline
- Price discussed without value anchor

**OUTPUT FORMAT:**

### Deal: [Account Name]
**Reported Close Date:** [If known]
**Likelihood Assessment:** High/Medium/Low/At Risk

**Evidence FOR this deal closing:**
- [Specific quote/commitment]

**Evidence AGAINST:**
- [Warning sign with quote]

**Forecast Recommendation:**
Commit / Best Case / Pipeline / Remove
`,
    starterQuestions: [
      {
        icon: Target,
        label: 'Forecast Reality Check',
        prompt: 'Challenge every deal\'s close date. What concrete evidence supports or contradicts committed timelines? Which deals will slip? Be ruthless - I\'d rather know now than at quarter end.',
      },
      {
        icon: AlertTriangle,
        label: 'Happy Ears Alert',
        prompt: 'Find instances of "happy ears" - where reps heard what they wanted to hear vs. reality. Look for vague prospect language that was interpreted too optimistically.',
      },
      {
        icon: DollarSign,
        label: 'Commit vs Best Case',
        prompt: 'Sort these deals into Commit, Best Case, or Pipeline based on actual conversation evidence (not rep optimism). What would need to happen to move Best Case to Commit?',
      },
      {
        icon: Zap,
        label: 'Deals to Save This Week',
        prompt: 'Which deals can we still save this quarter? Focus on deals with some positive signals but missing elements. What specific actions could move them forward?',
      },
    ],
  },
  {
    id: 'objection_library',
    label: 'Objection Library',
    icon: MessageSquareWarning,
    description: 'Catalog objections and effective responses',
    systemPromptAddition: `
## OBJECTION LIBRARY MODE

In this mode, build a comprehensive objection handling reference.

**CATEGORIZE OBJECTIONS:**
1. **Price/Budget** - Cost concerns
2. **Timing** - Not now, maybe later
3. **Authority** - Need to check with others
4. **Need** - Not sure we need this
5. **Competition** - Comparing alternatives
6. **Risk** - Concerns about change/implementation

**FOR EACH OBJECTION FOUND:**

### Objection: [Category] - [Specific concern]
**Frequency:** Found in X calls

**Verbatim Examples:**
- "[Exact quote]" - [Account, Date]

**Effective Responses Found:**
- "[How rep handled it]" - [Did it work?]

**Recommended Handling:**
[Best practice based on what worked]

**Prevention Strategy:**
[How to avoid this objection earlier in cycle]
`,
    starterQuestions: [
      {
        icon: MessageSquareWarning,
        label: 'Catalog All Objections',
        prompt: 'Build an objection library from these calls. Categorize every objection by type (price, timing, competition, authority, need). Include exact quotes and how reps responded.',
      },
      {
        icon: Trophy,
        label: 'Best Objection Handling',
        prompt: 'Find the best examples of objection handling across these calls. What techniques worked? What language turned concerns into momentum? Build a best practices guide.',
      },
      {
        icon: AlertTriangle,
        label: 'Poorly Handled Objections',
        prompt: 'Where did reps fumble objections? Find examples of weak responses, missed opportunities to address concerns, or objections that derailed deals. What should they have said?',
      },
      {
        icon: Crosshair,
        label: 'Price Objection Deep Dive',
        prompt: 'Focus specifically on price/budget objections. How are they being raised? Are reps anchoring value first? What responses work vs. fail? Build a price objection playbook.',
      },
    ],
  },
  {
    id: 'customer_voice',
    label: 'Customer Voice',
    icon: Users,
    description: 'Extract prospect needs, priorities, and buying criteria',
    systemPromptAddition: `
## CUSTOMER VOICE MODE

In this mode, focus on understanding the buyer's perspective.

**EXTRACT:**
1. **Stated Needs** - What they say they want
2. **Implied Needs** - What they actually need (between the lines)
3. **Decision Criteria** - How they'll choose
4. **Success Metrics** - How they'll measure value
5. **Fears/Concerns** - What keeps them up at night
6. **Buying Process** - How decisions get made

**OUTPUT FORMAT:**

### Voice of Customer: [Account]

**What They Said They Need:**
- "[Quote]" - [Interpretation]

**What They Actually Need:**
- [Implied need] - Evidence: [Quote]

**Their Decision Criteria:**
1. [Criterion] - "[Supporting quote]"

**Success Looks Like:**
- [How they define success]

**Their Concerns:**
- [Fear/risk] - "[Quote]"

**Key Insight:**
[What we learned about this buyer]
`,
    starterQuestions: [
      {
        icon: Users,
        label: 'Voice of Customer Summary',
        prompt: 'Synthesize the customer voice from these calls. What do prospects say they need? What do they actually need? What decision criteria matter most? Build a buyer persona from real data.',
      },
      {
        icon: Target,
        label: 'Decision Criteria Mapping',
        prompt: 'Map out how these prospects make decisions. What criteria do they use? Who needs to be involved? What process do they follow? Extract this intelligence from the conversations.',
      },
      {
        icon: AlertTriangle,
        label: 'Common Concerns',
        prompt: 'What concerns and fears come up repeatedly? What keeps these prospects up at night? Understand their risk perception so we can address it proactively.',
      },
      {
        icon: TrendingUp,
        label: 'Success Metrics',
        prompt: 'How will these prospects measure success? What ROI do they expect? What outcomes matter? Extract the success metrics they care about so we can align our pitch.',
      },
    ],
  },
];

export function getAnalysisModeById(id: string): AnalysisMode | undefined {
  return ANALYSIS_MODES.find(mode => mode.id === id);
}

export function getModePromptAddition(modeId: string): string {
  const mode = getAnalysisModeById(modeId);
  return mode?.systemPromptAddition || '';
}

// Mode Presets - Combined analysis modes for comprehensive reviews
export interface ModePreset {
  id: string;
  label: string;
  icon: LucideIcon;
  description: string;
  modeIds: string[];
  starterPrompt: string;
}

export const MODE_PRESETS: ModePreset[] = [
  {
    id: 'full_deal_review',
    label: 'Full Deal Review',
    icon: ClipboardCheck,
    description: 'MEDDPICC scoring + Champion health + Forecast validation',
    modeIds: ['deal_scoring', 'customer_voice', 'forecast_validation'],
    starterPrompt: `Perform a comprehensive deal review combining these analyses:

**PART 1: MEDDPICC QUALIFICATION**
Score each deal using MEDDPICC criteria (1-5 per criterion, 8 elements). Show a table with scores and evidence for each deal.

**PART 2: CHAMPION ASSESSMENT** 
For each deal, assess champion strength: Are they selling internally? Access to power? Sharing buying process info? Score 1-5.

**PART 3: FORECAST VALIDATION**
Challenge every close date. What evidence supports or contradicts timelines? Categorize as: Commit / Best Case / Pipeline / At Risk.

**FINAL SUMMARY**
Rank all deals by overall health and provide the top 3 actions to take this week.`,
  },
  {
    id: 'team_coaching',
    label: 'Team Coaching Session',
    icon: GraduationCap,
    description: 'Rep comparison + Discovery audit + Objection handling',
    modeIds: ['rep_comparison', 'discovery_audit', 'objection_library'],
    starterPrompt: `Prepare a comprehensive team coaching session:

**PART 1: REP PERFORMANCE COMPARISON**
Create a matrix comparing all reps across: discovery depth, objection handling, value articulation, call control, closing skills. Score each 1-5.

**PART 2: DISCOVERY QUALITY AUDIT**
Score discovery quality for each rep. Who's asking great questions? Who's surface-level? Include specific examples of excellent vs weak discovery.

**PART 3: OBJECTION HANDLING ANALYSIS**
What objections came up? How did each rep handle them? Build a best practices guide from top performers.

**COACHING PRIORITIES**
Identify the top 3 coaching priorities for the team with specific examples and recommended training focus.`,
  },
  {
    id: 'competitive_briefing',
    label: 'Competitive Briefing',
    icon: Briefcase,
    description: 'Competitive intel + Win/loss patterns + Battle cards',
    modeIds: ['competitive', 'customer_voice', 'objection_library'],
    starterPrompt: `Build a comprehensive competitive briefing:

**PART 1: COMPETITOR INTELLIGENCE**
For each competitor mentioned: frequency, their perceived strengths/weaknesses, how our reps position against them, what's working vs not.

**PART 2: BUYER PERSPECTIVE**
What do prospects say about us vs competition? What criteria matter most? What concerns come up repeatedly?

**PART 3: BATTLE CARDS**
Build actionable battle cards: key objections, proven responses, win themes, and positioning recommendations for each competitor.

**ACTION ITEMS**
What should sales enablement prioritize? What messaging needs refinement? What new collateral would help?`,
  },
  {
    id: 'pipeline_audit',
    label: 'Pipeline Health Audit',
    icon: BarChart3,
    description: 'Deal scoring + Forecast validation + Risk assessment',
    modeIds: ['deal_scoring', 'forecast_validation', 'general'],
    starterPrompt: `Conduct a rigorous pipeline health audit:

**PART 1: DEAL QUALIFICATION STATUS**
Score every deal on MEDDPICC. Create a ranked table showing qualification scores and the biggest gaps for each deal.

**PART 2: FORECAST ACCURACY CHECK**
For each deal: What evidence supports the expected close date? What evidence contradicts it? Categorize as Commit/Best Case/Pipeline/Remove.

**PART 3: RISK ASSESSMENT**
Identify all deals with warning signs: single-threaded, no compelling event, competitor momentum, vague next steps. Rank by revenue at risk.

**EXECUTIVE SUMMARY**
Provide a pipeline summary: total qualified value, likely slippage, deals to accelerate, and deals to deprioritize.`,
  },
  // COACHING-FOCUSED TEMPLATES
  {
    id: 'discovery_deep_dive',
    label: 'Discovery Deep Dive',
    icon: Microscope,
    description: 'In-depth discovery skill assessment with specific coaching',
    modeIds: ['discovery_audit', 'rep_comparison', 'customer_voice'],
    starterPrompt: `Perform a deep dive analysis of discovery skills:

**PART 1: DISCOVERY TECHNIQUE BREAKDOWN**
For each call, evaluate:
| Technique | Score | Evidence |
|-----------|-------|----------|
| Open-ended questions | X/5 | [Examples] |
| Follow-up probing | X/5 | [Examples] |
| Pain quantification | X/5 | [Examples] |
| Stakeholder mapping | X/5 | [Examples] |
| Timeline/urgency | X/5 | [Examples] |

**PART 2: QUESTION QUALITY ANALYSIS**
- List the 5 BEST discovery questions asked (with context)
- List 5 questions that SHOULD have been asked but weren't
- Identify surface-level vs. root-cause discovery examples

**PART 3: INFORMATION CAPTURED**
What valuable information was successfully uncovered? What gaps remain? Compare what was learned vs. what's still unknown.

**COACHING RECOMMENDATIONS**
Provide 3 specific, actionable coaching points with practice exercises for improving discovery skills.`,
  },
  {
    id: 'objection_handling_review',
    label: 'Objection Handling Review',
    icon: Shield,
    description: 'Evaluate objection responses with coaching playbook',
    modeIds: ['objection_library', 'rep_comparison', 'competitive'],
    starterPrompt: `Conduct a comprehensive objection handling review:

**PART 1: OBJECTION CATALOG**
List every objection encountered, categorized by type:
| Category | Objection | Frequency | How Handled | Effectiveness |
|----------|-----------|-----------|-------------|---------------|
| Price | [Quote] | X calls | [Response] | ✅/⚠️/❌ |
| Timing | [Quote] | X calls | [Response] | ✅/⚠️/❌ |
| Competition | [Quote] | X calls | [Response] | ✅/⚠️/❌ |

**PART 2: TECHNIQUE ANALYSIS**
- **Acknowledge-Explore-Respond:** Who used this effectively?
- **Feel-Felt-Found:** Any examples?
- **Reframing:** Who turned objections into opportunities?
Include specific quotes showing good vs. poor techniques.

**PART 3: OBJECTION PLAYBOOK**
For the top 5 most common objections, create a playbook entry:
- The objection (verbatim)
- Root cause / what they're really saying
- Recommended response with example language
- Prevention strategy (how to avoid it earlier)

**COACHING FOCUS**
Identify the rep who needs the most help with objections and provide a specific practice scenario.`,
  },
  {
    id: 'closing_skills_audit',
    label: 'Closing Skills Audit',
    icon: Handshake,
    description: 'Analyze closing techniques and commitment language',
    modeIds: ['forecast_validation', 'rep_comparison', 'deal_scoring'],
    starterPrompt: `Audit closing skills and commitment-getting techniques:

**PART 1: CLOSING MOMENTS ANALYSIS**
For each call, evaluate the close:
| Rep | Call | Close Attempt? | Technique Used | Outcome | Next Steps Clarity |
|-----|------|----------------|----------------|---------|-------------------|
| [Name] | [Account] | Yes/No | [Type] | [Result] | 1-5 |

**PART 2: COMMITMENT LANGUAGE**
- Find examples of strong commitment language ("Let's schedule..." vs "Maybe we could...")
- Identify missed closing opportunities where rep could have asked for commitment
- Compare reps: Who asks for next steps confidently? Who doesn't?

**PART 3: NEXT STEPS QUALITY**
Score the quality of agreed next steps:
- Specific date/time confirmed? 
- Clear action items assigned?
- Stakeholders committed?
- Mutual agenda for next meeting?

**PART 4: CLOSING TECHNIQUES OBSERVED**
- Assumptive closes
- Alternative choice closes  
- Summary closes
- Urgency-based closes
Which worked? Which fell flat?

**COACHING PLAYBOOK**
Provide 3 specific closing scenarios to role-play based on gaps observed.`,
  },
  {
    id: 'rapport_communication',
    label: 'Rapport & Communication',
    icon: Sparkles,
    description: 'Soft skills, rapport building, and communication style',
    modeIds: ['rep_comparison', 'customer_voice', 'general'],
    starterPrompt: `Analyze rapport building and communication effectiveness:

**PART 1: COMMUNICATION STYLE ASSESSMENT**
For each rep, evaluate:
| Skill | Score | Evidence |
|-------|-------|----------|
| Active listening | X/5 | [Examples of acknowledging/reflecting] |
| Empathy shown | X/5 | [Examples of understanding prospect's position] |
| Conversational flow | X/5 | [Natural vs. scripted feel] |
| Energy/enthusiasm | X/5 | [Tone and engagement level] |
| Talk-to-listen ratio | X/5 | [Estimate %] |

**PART 2: RAPPORT BUILDING MOMENTS**
- Find examples of effective rapport building (personal connection, shared experiences, humor)
- Identify missed rapport opportunities
- Note any rapport-breaking moments (interrupting, ignoring cues, being too pushy)

**PART 3: PROSPECT ENGAGEMENT SIGNALS**
How engaged were prospects? Look for:
- Long, detailed responses vs. short answers
- Questions they asked (interest signals)
- Verbal cues ("That's interesting," "Tell me more" vs. "Sure," "Okay")

**PART 4: COMMUNICATION COACHING**
Specific recommendations for each rep:
- What to keep doing
- What to adjust
- Practice exercise for improvement`,
  },
  {
    id: 'new_hire_review',
    label: 'New Hire Call Review',
    icon: UserCheck,
    description: 'Comprehensive new rep assessment with onboarding focus',
    modeIds: ['rep_comparison', 'discovery_audit', 'objection_library'],
    starterPrompt: `Conduct a new hire performance assessment:

**PART 1: FOUNDATIONAL SKILLS CHECK**
Score the new hire on core competencies:
| Skill | Score | Observations |
|-------|-------|--------------|
| Product knowledge | X/5 | [Accuracy of info shared] |
| Process adherence | X/5 | [Following sales methodology] |
| Discovery basics | X/5 | [Asking right questions] |
| Handling unknowns | X/5 | [When they don't know something] |
| Professionalism | X/5 | [Meeting management, follow-up] |

**PART 2: STRENGTHS TO BUILD ON**
What is this rep doing well naturally? Include specific examples that show promise.

**PART 3: SKILL GAPS TO ADDRESS**
Priority areas for development:
1. [Gap] - Evidence: [Quote/observation] - Training needed: [Specific]
2. [Gap] - Evidence: [Quote/observation] - Training needed: [Specific]
3. [Gap] - Evidence: [Quote/observation] - Training needed: [Specific]

**PART 4: COMPARE TO BENCHMARK**
How does this new hire compare to top performers on the same types of calls? What specific behaviors should they model?

**30-60-90 DAY RECOMMENDATIONS**
Specific milestones and focus areas for the new hire's development plan.`,
  },
  {
    id: 'self_coaching',
    label: 'Self-Coaching Review',
    icon: Brain,
    description: 'Personal performance analysis for self-improvement',
    modeIds: ['discovery_audit', 'objection_library', 'forecast_validation'],
    starterPrompt: `Generate a self-coaching analysis for personal improvement:

**PART 1: CALL-BY-CALL SCORECARD**
For each of my calls:
| Call | Discovery | Objections | Value Prop | Close | Overall | Key Moment |
|------|-----------|------------|------------|-------|---------|------------|
| [Account] | X/5 | X/5 | X/5 | X/5 | X/5 | [Best/worst moment] |

**PART 2: PATTERN RECOGNITION**
- What am I consistently doing well?
- What mistakes am I repeating?
- Are there specific call types or situations where I struggle?

**PART 3: BEST MOMENTS**
Pull out 3-5 moments from these calls where I performed at my best. What made them work? How can I replicate this?

**PART 4: LEARNING MOMENTS**
Identify 3-5 moments where I could have done better. For each:
- What I said/did
- What I should have said/done
- Why it matters

**PART 5: PERSONAL ACTION PLAN**
Based on this analysis, what are the 3 things I should focus on improving? Provide specific practice exercises or scripts I can use.

**WEEKLY FOCUS**
One specific skill to deliberately practice this week with a measurable goal.`,
  },
];

export function getPresetById(id: string): ModePreset | undefined {
  return MODE_PRESETS.find(preset => preset.id === id);
}

export function getCombinedModePrompts(modeIds: string[]): string {
  return modeIds
    .map(id => getModePromptAddition(id))
    .filter(Boolean)
    .join('\n\n');
}
