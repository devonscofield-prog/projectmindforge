
# AI-Powered Follow-Up Suggestions After Call Analysis

## Overview

Transform the follow-up task creation flow from an immediate post-submission popup to a smart, context-aware suggestion system that activates after analysis completes. A new AI agent ("The Advisor") will analyze the call AND account history to recommend specific follow-up actions with suggested timing.

---

## Current Flow vs. New Flow

```text
CURRENT FLOW:
Rep submits call → PostCallTasksDialog opens immediately → Rep manually enters tasks → Navigate to call detail

NEW FLOW:
Rep submits call → Navigate to call detail (analysis pending) → Analysis completes → 
AI Advisor generates suggestions → PostCallSuggestionsPanel appears on call detail page →
Rep reviews AI suggestions + can add manual tasks → Accept/modify/dismiss suggestions
```

---

## Architecture Changes

### 1. New AI Agent: "The Advisor"

Add a new agent to the registry that generates follow-up suggestions after analysis completes. This agent runs as part of the post-analysis chain (similar to Deal Heat and RAG chunking).

**Agent Configuration:**
| Property | Value |
|----------|-------|
| ID | `advisor` |
| Model | `google/gemini-3-pro-preview` |
| Phase | Post-analysis (triggered after main pipeline) |
| Inputs | Call transcript, analysis results, account history, stakeholder data, email logs |
| Output | 3-7 follow-up suggestions with timing recommendations |

**Output Schema:**
```typescript
interface FollowUpSuggestion {
  title: string;                    // Action verb + specific outcome (max 60 chars)
  description: string;              // Why this matters (1-2 sentences)
  priority: 'high' | 'medium' | 'low';
  category: 'discovery' | 'stakeholder' | 'objection' | 'proposal' | 'relationship' | 'competitive';
  suggested_due_days: number | null;  // Days from now (e.g., 3 = in 3 days)
  urgency_signal: string | null;      // Time-sensitive cue from conversation
  ai_reasoning: string;               // Why this suggestion
  related_evidence: string | null;    // Quote from transcript
}
```

### 2. Database Schema Changes

**New column on `ai_call_analysis` table:**
```sql
ALTER TABLE ai_call_analysis 
ADD COLUMN follow_up_suggestions JSONB DEFAULT NULL;
```

This stores the AI-generated suggestions tied to the specific call analysis.

**New status tracking on `call_transcripts`:**
```sql
-- Optional: Track if suggestions have been reviewed
ALTER TABLE call_transcripts 
ADD COLUMN suggestions_reviewed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;
```

### 3. Edge Function Changes

**Update `analyze-call/index.ts`:**

After successful analysis completion (after Deal Heat and RAG chunking), trigger a new function:

```typescript
// After line 379 (after triggerBackgroundChunking)
await triggerFollowUpSuggestions(
  targetCallId!,
  transcript.prospect_id,
  result,  // Full analysis results
  supabaseUrl,
  supabaseServiceKey
);
```

**New Edge Function: `generate-call-follow-up-suggestions`**

This function:
1. Receives the call_id and analysis results
2. Fetches account history (previous calls, emails, stakeholders)
3. Calls the AI with structured tool calling
4. Saves suggestions to `ai_call_analysis.follow_up_suggestions`
5. Updates a flag so the frontend knows suggestions are ready

### 4. Frontend Changes

**Remove from `RepDashboard.tsx`:**
- Remove `PostCallTasksDialog` import and usage
- Remove `showPostCallTasks` and `submittedCallData` state
- After successful submission, navigate directly to call detail page

**New Component: `PostCallSuggestionsPanel.tsx`**

Location: `src/components/calls/suggestions/`

This component appears on the CallDetailPage when:
- Analysis has completed
- AI suggestions are available
- User hasn't dismissed them yet

**Features:**
- Shows 3-7 AI-suggested follow-ups with timing recommendations
- Each suggestion shows: title, description, priority badge, suggested due date
- "Accept" button converts suggestion to actual follow-up task
- "Accept All" button for quick action
- "Add Custom Task" button for manual entries
- "Dismiss" option for suggestions that don't apply
- Collapsible AI reasoning for transparency

**UI Layout:**
```text
┌─────────────────────────────────────────────────────────────────────┐
│ ✨ Suggested Follow-Up Actions                    [Dismiss] [Accept All] │
│ AI-generated based on your call with {AccountName}                  │
├─────────────────────────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────────────────────────────┐│
│ │ 🔴 HIGH | Schedule follow-up with CFO              Due: In 3 days ││
│ │ The CFO was mentioned as final decision maker but wasn't on call.││
│ │ [Show AI Reasoning ▼]                     [Dismiss] [Accept ✓]   ││
│ └──────────────────────────────────────────────────────────────────┘│
│ ┌──────────────────────────────────────────────────────────────────┐│
│ │ 🟡 MEDIUM | Send ROI comparison document           Due: Tomorrow ││
│ │ Prospect asked about competitive pricing - provide hard numbers. ││
│ │ [Show AI Reasoning ▼]                     [Dismiss] [Accept ✓]   ││
│ └──────────────────────────────────────────────────────────────────┘│
│ ┌──────────────────────────────────────────────────────────────────┐│
│ │ 🟢 LOW | Add technical champion to Slack channel   Due: In 1 week││
│ │ Build relationship with the IT lead who showed strong interest.  ││
│ │ [Show AI Reasoning ▼]                     [Dismiss] [Accept ✓]   ││
│ └──────────────────────────────────────────────────────────────────┘│
│                                                                     │
│ [+ Add Custom Task]                                                 │
└─────────────────────────────────────────────────────────────────────┘
```

**Integration with `CallDetailPage.tsx`:**

Add the suggestions panel to appear:
- After the CoachingCard (line ~511)
- Only when `analysis?.follow_up_suggestions` exists
- Conditionally hidden if user has reviewed/dismissed

### 5. Real-time Updates

Leverage existing `useCallAnalysisRealtime` hook:
- Already listens for analysis completion
- Extend to also trigger a refetch when suggestions become available
- Toast notification: "✨ AI follow-up suggestions ready!"

---

## Implementation Phases

### Phase 1: Backend (New Edge Function + Schema)
1. Add `follow_up_suggestions` column to `ai_call_analysis`
2. Create `generate-call-follow-up-suggestions` edge function
3. Wire into `analyze-call` post-completion chain
4. Add `suggestions_reviewed_at` tracking column

### Phase 2: Frontend (Suggestions Panel)
1. Create `PostCallSuggestionsPanel` component
2. Create `SuggestionCard` component for individual suggestions
3. Add accept/dismiss logic with database writes
4. Integrate into `CallDetailPage`

### Phase 3: Rep Dashboard Cleanup
1. Remove `PostCallTasksDialog` from `RepDashboard`
2. Navigate directly to call detail after submission
3. Update success toast messaging

### Phase 4: Polish
1. Add "Add Custom Task" modal within suggestions panel
2. Mobile-responsive design
3. Loading states for suggestion generation
4. Empty state if no suggestions generated

---

## Technical Details

### AI Agent Prompt (The Advisor)

```text
You are a 20-year B2B/SaaS sales veteran analyzing a just-completed call to recommend next actions.

You have access to:
1. The call transcript and full analysis (coaching scores, critical gaps, objection handling, etc.)
2. Previous calls with this account (summaries, critical gaps that were/weren't addressed)
3. Stakeholder profiles and champion scores
4. Recent email communications

Generate 3-7 SPECIFIC, ACTIONABLE follow-up steps. Each should be something the rep can execute within the suggested timeframe.

For each follow-up:
- title: Action verb + specific outcome (max 60 chars)
- description: 1-2 sentences with context on WHY this matters NOW
- priority: high/medium/low based on deal impact and urgency
- category: discovery/stakeholder/objection/proposal/relationship/competitive
- suggested_due_days: When should this be done? (1=tomorrow, 3=in 3 days, 7=next week, null=no specific timing)
- urgency_signal: Time-sensitive cue from the call (e.g., "they mentioned Q1 budget deadline")
- ai_reasoning: 2-3 sentences explaining your thinking
- related_evidence: Quote or paraphrase from the call that drove this

PRIORITIZATION RULES:
1. Address any critical gaps identified in the analysis
2. Follow up on unresolved objections
3. Expand stakeholder coverage if decision maker wasn't on call
4. Capitalize on urgency signals mentioned in call
5. Build on momentum if call went well
```

### Accept Flow

When user clicks "Accept" on a suggestion:
1. Create entry in `account_follow_ups` with:
   - `source: 'ai_suggestion'`
   - `due_date`: Calculated from `suggested_due_days`
   - `source_call_id`: The originating call
   - `ai_reasoning`: From the suggestion
2. Mark suggestion as accepted in `follow_up_suggestions` array
3. Refresh follow-ups list

### Data Flow Diagram

```text
┌──────────────┐     ┌──────────────┐     ┌──────────────────────┐
│ analyze-call │────▶│ Deal Heat    │────▶│ RAG Chunking         │
│  (main)      │     │ Calculation  │     │                      │
└──────────────┘     └──────────────┘     └──────────────────────┘
                                                     │
                                                     ▼
                                          ┌──────────────────────┐
                                          │ generate-call-       │
                                          │ follow-up-suggestions│
                                          └──────────────────────┘
                                                     │
                                                     ▼
                                          ┌──────────────────────┐
                                          │ ai_call_analysis     │
                                          │ .follow_up_suggestions│
                                          └──────────────────────┘
                                                     │
                                                     ▼
                                          ┌──────────────────────┐
                                          │ CallDetailPage       │
                                          │ PostCallSuggestions  │
                                          │ Panel                │
                                          └──────────────────────┘
```

---

## Files to Create/Modify

### New Files
| File | Purpose |
|------|---------|
| `supabase/functions/generate-call-follow-up-suggestions/index.ts` | AI suggestion generation |
| `src/components/calls/suggestions/PostCallSuggestionsPanel.tsx` | Main suggestions UI |
| `src/components/calls/suggestions/SuggestionCard.tsx` | Individual suggestion card |
| `src/components/calls/suggestions/AddCustomTaskDialog.tsx` | Manual task entry |
| `src/components/calls/suggestions/index.ts` | Barrel export |
| `src/api/callSuggestions.ts` | API for accepting/dismissing suggestions |

### Modified Files
| File | Changes |
|------|---------|
| `supabase/functions/analyze-call/index.ts` | Trigger suggestion generation after analysis |
| `src/pages/calls/CallDetailPage.tsx` | Add suggestions panel |
| `src/pages/rep/RepDashboard.tsx` | Remove PostCallTasksDialog, simplify flow |
| `src/hooks/useCallDetailQueries.ts` | Add suggestions query |
| `src/integrations/supabase/types.ts` | Will auto-update with new column |

### Database Migration
```sql
-- Add suggestions storage
ALTER TABLE ai_call_analysis 
ADD COLUMN follow_up_suggestions JSONB DEFAULT NULL;

-- Track if suggestions were reviewed
ALTER TABLE call_transcripts 
ADD COLUMN suggestions_reviewed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Add 'ai_suggestion' as valid source
COMMENT ON COLUMN account_follow_ups.source IS 'ai, manual, or ai_suggestion';
```

---

## Benefits

1. **Smarter suggestions**: AI has full analysis context (gaps, objections, coaching scores)
2. **Account-aware**: Considers previous calls and relationship history
3. **Timing recommendations**: AI suggests WHEN to take action based on urgency signals
4. **Non-blocking**: Suggestions appear after analysis, not interrupting submission flow
5. **Optional adoption**: Reps can dismiss all suggestions if they prefer manual tracking
6. **Transparency**: AI reasoning visible for each suggestion

---

## Questions to Clarify (Optional)

1. Should accepted suggestions have reminders enabled by default?
2. Should we show suggestions on the Account Detail page as well as Call Detail?
3. Should managers see suggestion acceptance rates in their dashboards?
