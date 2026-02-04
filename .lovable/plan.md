

# Add "The Scribe" Agent to the Analysis Pipeline

## Overview

Transform call notes generation from an on-demand feature into an automatic part of the analysis pipeline by adding a new agent called **"The Scribe"**. This will:
- Generate CRM-ready notes automatically during analysis
- Store notes in the existing `sales_assets` column
- Replace the "Generate Call Notes" button with "View Call Notes"
- Ensure notes are immediately available when analysis completes

---

## Architecture

The current analysis pipeline has three phases:
- **Phase 0**: Speaker Labeler + Sentinel (parallel pre-processing)
- **Phase 1**: 10 agents in 2 batches (Census, Historian, Spy, Profiler, Strategist, Referee, Interrogator, Skeptic, Negotiator, Auditor)
- **Phase 2**: Coach (synthesis agent)

The Scribe agent will run in **Phase 2** alongside the Coach, since:
- It needs outputs from Phase 1 agents (summary, critical gaps, competitor intel)
- It can run in parallel with the Coach (no dependencies between them)
- Running in Phase 2 won't slow down Phase 1 analysis

---

## Implementation Plan

### 1. Create The Scribe Agent Schema

**File**: `supabase/functions/_shared/agent-schemas.ts`

Add a new Zod schema:

```typescript
export const ScribeSchema = z.object({
  internal_notes_markdown: z.string().describe("CRM-ready internal notes in markdown format"),
});

export type ScribeOutput = z.infer<typeof ScribeSchema>;
```

### 2. Create The Scribe Agent Prompt

**File**: `supabase/functions/_shared/agent-prompts.ts`

Add a focused prompt based on the existing `generate-sales-assets` prompt:

```typescript
export const SCRIBE_PROMPT = `You are 'The Scribe', creating concise CRM notes.

**OUTPUT STRUCTURE (use exactly):**

**Call Summary**
* One clear sentence on purpose and outcome

**Key Discussion Points**
* What topics were actually discussed
* Pain points mentioned
* Solutions proposed

**Next Steps**
* Specific action items with owners
* Deadlines when mentioned

**Critical Gaps/Unknowns**
* Information still needed to progress the deal

**Competitor Intel**
* Any competitors mentioned by name (or "None mentioned")

**Deal Health**
* Temperature: Hot/Warm/Cold with brief reasoning

**GUIDELINES:**
- Be specific and factual
- Include names, numbers, dates when available
- Keep each bullet concise but complete
- Use markdown formatting (bold, bullets)`;
```

### 3. Add The Scribe to Agent Registry

**File**: `supabase/functions/_shared/agent-registry.ts`

Add the agent configuration:

```typescript
const DEFAULT_SCRIBE = {
  internal_notes_markdown: 'Call notes generation failed. Please regenerate manually.',
};

// Add to AGENT_REGISTRY array as Phase 2 agent:
{
  id: 'scribe',
  name: 'The Scribe',
  description: 'Generate CRM-ready internal notes from call analysis',
  schema: ScribeSchema,
  systemPrompt: SCRIBE_PROMPT,
  userPromptTemplate: (input) => `Generate internal CRM notes for this sales call:\n\n${input}`,
  toolName: 'generate_crm_notes',
  toolDescription: 'Generate CRM-ready internal notes from call analysis',
  options: { model: 'google/gemini-2.5-flash', temperature: 0.4, maxTokens: 4096 },
  isCritical: false,
  default: DEFAULT_SCRIBE,
  phase: 2,
}
```

### 4. Update Pipeline to Run Scribe in Phase 2

**File**: `supabase/functions/_shared/pipeline.ts`

Modifications needed:

1. **Add ScribeOutput to imports**
2. **Add `sales_assets` to PipelineResult interface**
3. **Build Scribe input from Phase 1 outputs** (summary, critical gaps, competitors, next steps)
4. **Run Scribe in parallel with Coach** in Phase 2
5. **Return `sales_assets` in pipeline result**

The Scribe input will include:
- Call summary from Historian
- Critical gaps from Skeptic
- Competitor intel from Spy
- Next steps from Referee
- Account/stakeholder names from transcript metadata

### 5. Update analyze-call to Store Notes

**File**: `supabase/functions/analyze-call/index.ts`

Add to the `analysisData` object being saved:

```typescript
const analysisData = {
  // ... existing fields
  sales_assets: { internal_notes_markdown: result.sales_assets.internal_notes_markdown },
  sales_assets_generated_at: new Date().toISOString(),
};
```

### 6. Update UI to "View Call Notes"

**File**: `src/pages/calls/CallDetailPage.tsx`

- Change button label from "Generate Call Notes" to "View Call Notes"
- Change icon from `FileText` to `ScrollText` (or keep FileText)
- Add visual indicator if notes exist (checkmark badge)

**File**: `src/components/calls/SalesAssetsGenerator.tsx`

- Simplify component to be a "viewer" by default
- Remove the "generate" CTA when notes already exist
- Keep the ability to "Regenerate" for manual re-generation
- Keep edit/save functionality for manual adjustments

---

## Technical Details

### Pipeline Result Type Update

```typescript
export interface PipelineResult {
  metadata: CallMetadata;
  behavior: MergedBehaviorScore;
  strategy: StrategyAudit;
  psychology: ProfilerOutput;
  pricing: AuditorOutput;
  coaching: CoachOutput;
  sales_assets: ScribeOutput;  // NEW
  callClassification?: CallClassification;
  warnings: string[];
  // ... timing fields
}
```

### Scribe Input Builder

The Scribe will receive a structured input report (similar to Coach):

```text
## CALL ANALYSIS SUMMARY

**Account:** {account_name}
**Primary Contact:** {stakeholder_name}

**Call Summary:** {historian.summary}

**Key Topics:** {historian.key_topics.join(', ')}

**Next Steps:** {referee.next_steps.secured ? 'SECURED' : 'NOT SECURED'}: {referee.next_steps.details}

**Critical Gaps:**
{skeptic.critical_gaps.map(g => `- [${g.impact}] ${g.category}: ${g.description}`)}

**Competitors Mentioned:**
{spy.competitive_intel.map(c => `- ${c.competitor_name}: ${c.usage_status}`)}

**Transcript Excerpt (key points only):**
{first 5000 chars of transcript for additional context}
```

### Phase 2 Parallel Execution

```typescript
// Phase 2: Coach + Scribe in parallel
const [coachResult, scribeResult] = await Promise.all([
  executeCoachWithConsensus(coachConfig, coachingReport, supabase, callId),
  executeAgent(scribeConfig, scribeInput, supabase, callId),
]);
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/_shared/agent-schemas.ts` | Add ScribeSchema and ScribeOutput type |
| `supabase/functions/_shared/agent-prompts.ts` | Add SCRIBE_PROMPT |
| `supabase/functions/_shared/agent-registry.ts` | Add Scribe agent config with DEFAULT_SCRIBE |
| `supabase/functions/_shared/pipeline.ts` | Add Scribe to Phase 2, build input, update PipelineResult |
| `supabase/functions/analyze-call/index.ts` | Store sales_assets in analysisData |
| `src/pages/calls/CallDetailPage.tsx` | Update button to "View Call Notes" |
| `src/components/calls/SalesAssetsGenerator.tsx` | Simplify to viewer-first UX |

---

## Result

1. **Automatic notes** - Notes generated during analysis, no manual step required
2. **Faster user experience** - Notes ready immediately when analysis completes
3. **Parallel execution** - Scribe runs alongside Coach, minimal added latency
4. **Preserved functionality** - Users can still edit, copy, and regenerate notes
5. **Consistent architecture** - Follows the Agent Registry pattern like all other agents

