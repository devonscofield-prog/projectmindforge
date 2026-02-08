
# Upgrade Admin AI Assistant: Full Platform Visibility

## Problem

The current implementation fetches context from **only the page the admin is viewing**. The `getPageContext` function (line 371) routes to a single fetcher, and the system prompt labels it `CURRENT PAGE DATA`. This means:

- On `/admin/users`, the AI knows nothing about calls, accounts, or coaching
- On `/admin/accounts`, the AI cannot answer questions about users or teams
- The admin cannot ask cross-cutting questions like "Which reps have the most calls but lowest coaching scores?"

## Solution

Fetch **all** context categories in parallel on every request, but clearly mark which page the admin is currently viewing so the AI prioritizes that data in its responses.

## Changes

### Edge Function: `supabase/functions/admin-assistant-chat/index.ts`

**1. Replace `getPageContext` with `fetchAllContext`**

Instead of routing to one fetcher, call all fetchers in parallel:

```text
async function fetchAllContext(supabase, pageContext):
  Run all fetchers concurrently:
    - fetchDashboardContext (stats, recent calls, recent coaching)
    - fetchUsersContext (all users, roles, teams)
    - fetchTeamsContext (team structure, members)
    - fetchAccountsContext (prospects, pipeline, heat scores)
    - fetchCallHistoryContext (recent calls by rep/type)
    - fetchCoachHistoryContext (coach sessions, usage by user)
    - fetchCoachingTrendsContext (trend analyses)
    - fetchPerformanceContext (last 24h metrics)

  Combine all results into one string, with a header indicating the active page
```

Each fetcher already returns a markdown section (e.g., `## USERS`, `## CALL HISTORY`), so combining them is straightforward.

**2. Update the system prompt injection (line 482)**

Change from:
```
The admin is currently viewing: {page_context}
## CURRENT PAGE DATA
{contextData}
```

To:
```
The admin is currently viewing: {page_context}
Prioritize data relevant to this page when answering, but you have visibility into ALL platform data below.

## PLATFORM DATA
{allContextData}
```

**3. Optimize individual fetchers for combined payload size**

Since all fetchers now run on every request, reduce limits slightly to stay within token budgets:
- Recent calls: 50 -> 30
- Coach sessions: 30 -> 20
- Accounts: 50 -> 30
- Coaching trends: 20 -> 10

This keeps the total context manageable while still providing comprehensive data.

### Frontend: Quick Actions Update

No changes needed -- the quick actions already suggest page-relevant prompts, and the AI will now be able to answer them using full platform data.

### Files Modified

| File | Change |
|------|--------|
| `supabase/functions/admin-assistant-chat/index.ts` | Replace `getPageContext` with `fetchAllContext`; update system prompt; trim individual fetcher limits |

No database changes, no frontend changes, no new files.

## Technical Details

The parallel fetch approach uses `Promise.allSettled` so that a failure in one fetcher (e.g., if `get_performance_summary` RPC errors) does not block the others. Failed fetchers return an empty string and log a warning.

Estimated total context size with all fetchers: ~3,000-5,000 tokens, well within the 32,768 completion token budget and GPT-5.2's context window.
