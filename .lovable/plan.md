

# Fix: AI Advisor Follow-Up Suggestions Not Appearing After Call Submission

## Root Cause Analysis

I traced through the entire data flow from call submission to UI rendering and identified **two critical bugs** in the realtime subscription logic that explain why you never see the suggestions panel.

### Timeline of what happened with your call (4b9f1227):

| Time | Event |
|------|-------|
| 06:00:42 | Call created |
| 06:00:45 | analyze-call started |
| **06:02:43-49** | **UI queries returned `[]` - analysis not saved yet** |
| 06:03:56 | Analysis saved, status → `completed` |
| **06:03:56** | **Realtime subscription torn down** (enabled=false) |
| 06:04:21 | Deal Heat saved (UPDATE to ai_call_analysis) - **no one listening!** |
| 06:04:50 | Suggestions saved (UPDATE to ai_call_analysis) - **no one listening!** |

### Bug #1: Missing INSERT Event

The realtime hook only subscribes to `UPDATE` events on `ai_call_analysis`:

```typescript
// Line 98 in useCallAnalysisRealtime.ts
event: 'UPDATE',  // ❌ Doesn't catch INSERT when analysis is first created
```

But when analysis is created for the first time, it's an **INSERT** event.

### Bug #2: Subscription Disabled Too Early

The realtime hook is controlled by `shouldPoll`, which becomes `false` immediately when `analysis_status = 'completed'`:

```typescript
// CallDetailPage.tsx lines 87-97
const shouldPoll = useMemo(() => {
  const status = callData.transcript.analysis_status;
  return status === 'pending' || status === 'processing';  // false when completed!
}, [callData?.transcript]);

useCallAnalysisRealtime(id, shouldPoll);  // Subscription torn down when shouldPoll=false
```

**The Problem**: Deal Heat and Suggestions are saved 30-60 seconds **after** status becomes `completed`. By then, the subscription no longer exists.

---

## Solution

### Part 1: Subscribe to INSERT + UPDATE Events

Change the ai_call_analysis subscription to catch both INSERT and UPDATE:

```typescript
// useCallAnalysisRealtime.ts
.on(
  'postgres_changes',
  {
    event: '*',  // ✅ Catches INSERT, UPDATE, DELETE
    // OR: event: ['INSERT', 'UPDATE'],
    schema: 'public',
    table: 'ai_call_analysis',
    filter: `call_id=eq.${callId}`,
  },
  // handler...
)
```

### Part 2: Keep Subscription Active Until Suggestions Arrive

Instead of using `shouldPoll` (which turns off at completion), we need a separate condition that stays active until we've received suggestions. The hook needs to know when to stop listening.

**New Logic:**

```typescript
// Keep listening until:
// 1. analysis_status is 'completed' AND
// 2. We've received follow_up_suggestions OR
// 3. A timeout has passed (e.g., 90 seconds after completion)
```

**Implementation Approach:**

1. Add a new parameter to the hook: `analysisHasSuggestions: boolean`
2. Modify `enabled` condition in CallDetailPage:
   ```typescript
   const shouldListenForUpdates = useMemo(() => {
     // Keep listening if:
     // - Analysis is pending/processing, OR
     // - Analysis is completed but suggestions haven't arrived yet
     if (!callData?.transcript) return false;
     const status = callData.transcript.analysis_status;
     if (status === 'pending' || status === 'processing') return true;
     
     // If completed, keep listening until we have suggestions
     const hasSuggestions = Array.isArray(analysis?.follow_up_suggestions) && 
                            analysis.follow_up_suggestions.length > 0;
     return status === 'completed' && !hasSuggestions;
   }, [callData?.transcript, analysis?.follow_up_suggestions]);
   
   useCallAnalysisRealtime(id, shouldListenForUpdates);
   ```

---

## Files to Modify

| File | Change |
|------|--------|
| `src/hooks/useCallAnalysisRealtime.ts` | Change event from `'UPDATE'` to `'*'` for ai_call_analysis subscription |
| `src/pages/calls/CallDetailPage.tsx` | Update `shouldPoll` logic to stay active until suggestions arrive |

---

## Technical Details

### useCallAnalysisRealtime.ts Changes:

```typescript
// Line 95-102: Change event type
.on(
  'postgres_changes',
  {
    event: '*',  // Was 'UPDATE', now catches all events
    schema: 'public',
    table: 'ai_call_analysis',
    filter: `call_id=eq.${callId}`,
  },
  // ...handler
)
```

### CallDetailPage.tsx Changes:

```typescript
// Replace shouldPoll with shouldListenForUpdates
const shouldListenForUpdates = useMemo(() => {
  if (!callData?.transcript) return false;
  const status = callData.transcript.analysis_status;
  
  // Always listen during pending/processing
  if (status === 'pending' || status === 'processing') return true;
  
  // After completion, keep listening until suggestions arrive
  if (status === 'completed') {
    const hasSuggestions = Array.isArray(analysis?.follow_up_suggestions) && 
                           analysis.follow_up_suggestions.length > 0;
    const hasDealHeat = !!analysis?.deal_heat_analysis;
    
    // Keep listening until we have both, or just suggestions at minimum
    return !hasSuggestions;
  }
  
  return false;
}, [callData?.transcript, analysis?.follow_up_suggestions, analysis?.deal_heat_analysis]);

// Use for realtime but keep polling behavior as-is
useCallAnalysisRealtime(id, shouldListenForUpdates);
```

---

## After Implementation

When a new call is submitted:

1. User navigates to call detail → realtime subscription starts
2. Analysis completes → UI refetches and shows coaching insights
3. **Subscription stays active** because suggestions haven't arrived
4. Deal Heat saved → realtime event fires → UI refetches and shows Deal Heat
5. Suggestions saved → realtime event fires → UI refetches and shows suggestions panel
6. **Now** subscription can be torn down (or stay active for future edits)

---

## Why This Wasn't Caught Before

The database audit confirmed:
- Data IS being saved correctly (5 suggestions, Deal Heat score 65)
- Realtime publication IS configured correctly
- RLS policies ARE correct (rep can see their own data)

The issue was purely timing: the subscription was being torn down before the post-analysis data was saved.

