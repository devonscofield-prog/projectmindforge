

# Comprehensive Audit: AI Advisor Follow-Up Suggestions System

## Executive Summary

I've audited the entire follow-up suggestions system from backend to frontend. The implementation is **mostly complete**, but I discovered **one critical issue** that will prevent real-time updates from working for the `ai_call_analysis` table.

---

## Audit Findings

### Backend: Edge Function `generate-call-follow-up-suggestions`

| Aspect | Status | Notes |
|--------|--------|-------|
| Model configuration | PASS | Uses `google/gemini-3-pro-preview` |
| System prompt quality | PASS | Detailed 20-year veteran persona with clear prioritization rules |
| Tool/schema definition | PASS | Defines all 8 fields with proper types and constraints |
| Context gathering | PASS | Fetches previous calls, stakeholders, email logs, existing follow-ups |
| Avoids duplicates | PASS | Lists existing pending follow-ups in prompt |
| Error handling | PASS | Returns gracefully on failures |
| Saves to DB | PASS | Updates `ai_call_analysis.follow_up_suggestions` |
| Triggered after analysis | PASS | Called from `analyze-call/index.ts` line 409 |

### Backend: `reanalyze-call` Function

| Aspect | Status | Notes |
|--------|--------|-------|
| Clears old suggestions | PASS | Sets `follow_up_suggestions: null` |
| Resets review timestamp | PASS | Sets `suggestions_reviewed_at: null` |
| Triggers new analysis | PASS | Invokes `analyze-call` which triggers Advisor |

### Database Schema

| Table | Column | Type | Status |
|-------|--------|------|--------|
| `ai_call_analysis` | `follow_up_suggestions` | JSONB | PASS - exists |
| `ai_call_analysis` | `deal_heat_analysis` | JSONB | PASS - exists |
| `account_follow_ups` | `source_call_id` | UUID | PASS - links tasks to source call |
| `account_follow_ups` | `due_date` | DATE | PASS - for reminders |
| `account_follow_ups` | `reminder_enabled` | BOOLEAN | PASS - for notifications |

### Frontend: Type Definitions

| File | Status | Notes |
|------|--------|-------|
| `src/api/aiCallAnalysis/types.ts` | PASS | `follow_up_suggestions: unknown[] \| null` at line 212 |
| `src/components/calls/suggestions/types.ts` | PASS | Full `FollowUpSuggestion` interface with all fields |

### Frontend: Data Adapter

| File | Status | Notes |
|------|--------|-------|
| `src/lib/supabaseAdapters.ts` | PASS | Line 344 maps `follow_up_suggestions` |

### Frontend: Real-time Subscription

| Aspect | Status | Issue |
|--------|--------|-------|
| Listens to `call_transcripts` | PASS | Line 39-92 |
| Listens to `ai_call_analysis` | PARTIAL | Code exists (lines 94-131) BUT table is **not in realtime publication** |
| Shows toast for suggestions | PASS | Line 127 |

### Frontend: UI Components

| Component | Status | Notes |
|-----------|--------|-------|
| `PostCallSuggestionsPanel` | PASS | Full implementation with Accept/Dismiss/Add Custom |
| `SuggestionCard` | PASS | Shows priority, category, due timing, AI reasoning |
| `AddCustomTaskDialog` | PASS | Full form with priority, category, due date, reminder toggle |
| `PostCallSuggestionsSkeleton` | PASS | Loading state |

### Frontend: Page Integration

| Aspect | Status | Notes |
|--------|--------|-------|
| Renders panel | PASS | Line 516-525 in `CallDetailPage.tsx` |
| Guards for `prospect_id` | PASS | Won't render if call isn't linked to account |
| Position in page | PASS | Right after CoachingCard, before DealHeatCard |

---

## Critical Issue Found

### Real-time Subscription for `ai_call_analysis` Won't Work

**Problem**: The `ai_call_analysis` table is **NOT** in the `supabase_realtime` publication.

```sql
-- Current publication tables:
call_transcripts     -- IN publication
performance_metrics  -- IN publication
user_activity_logs   -- IN publication
ai_call_analysis     -- NOT IN PUBLICATION ❌
```

Additionally, `ai_call_analysis` has `REPLICA IDENTITY = DEFAULT` (`d`), whereas `call_transcripts` has `REPLICA IDENTITY = FULL` (`f`). For real-time updates to properly include the old/new values, we need `FULL`.

**Impact**: The realtime code in `useCallAnalysisRealtime.ts` (lines 94-131) subscribes to `ai_call_analysis` updates, but these updates will never be received because the table isn't in the publication.

**Result**: Users won't see Deal Heat or suggestions automatically appear after analysis completes. They'll need to manually refresh.

---

## Required Fix

### Database Migration Needed

```sql
-- Add ai_call_analysis to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_call_analysis;

-- Set REPLICA IDENTITY to FULL for complete payload in realtime events
ALTER TABLE public.ai_call_analysis REPLICA IDENTITY FULL;
```

---

## Everything Else is Complete

Once the realtime publication issue is fixed:

1. User submits call → `analyze-call` runs
2. Analysis completes → `call_transcripts.analysis_status` changes to `completed`
3. Real-time fires → UI refetches → Shows coaching insights
4. Post-analysis triggers → Deal Heat + Advisor run (seconds later)
5. `ai_call_analysis` updates → Real-time fires → UI refetches again
6. User sees Deal Heat + Suggestions panel automatically
7. User can Accept/Dismiss suggestions or Add Custom tasks
8. Accepted tasks create `account_follow_ups` with due dates and reminder settings
9. Email reminders sent via `send-task-reminders` cron job

---

## Implementation Plan

### Step 1: Database Migration

Run SQL to add `ai_call_analysis` to realtime publication and set REPLICA IDENTITY to FULL.

### Step 2: Verify

Submit a new test call and verify:
- Deal Heat appears automatically
- Suggestions panel appears automatically
- "Follow-up suggestions ready" toast displays
- Accept/Dismiss/Add Custom all work

---

## Technical Details for Implementation

No code changes needed - only a database migration to enable realtime for the `ai_call_analysis` table.

