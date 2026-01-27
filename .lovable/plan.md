
# Plan: Fix Stuck Roleplay Sessions

## Problem Analysis

Grant's roleplay session with Steven Green from 4:52 AM is stuck in `in_progress` status. Based on my investigation:

### Session Details
| Field | Value |
|-------|-------|
| Session ID | `1942bd72-aab3-4c55-b5ad-b4e3c633f2ca` |
| Status | `in_progress` (stuck) |
| Started | 2026-01-27 04:52:52 UTC |
| Duration | ~22+ minutes since start (no activity) |
| Transcript | None saved |
| Trainee | Grant Kuhlmann |
| Persona | Steven Green |

### Root Cause
The session transitioned to `in_progress` when the ephemeral OpenAI token was retrieved, but the `end-session` call was never made. This typically happens when:
1. User closes the browser tab mid-session
2. Network disconnection during the call
3. Browser crash or refresh
4. The RTC connection failed before the user explicitly ended

The frontend cleanup on unmount calls `cleanup()` but does NOT call `endSession()` or `abandon-session`, leaving the database record orphaned.

---

## Two-Part Fix

### Part 1: Immediate Fix for Grant's Session

Create a database function to recover stuck roleplay sessions (similar to `recover_stuck_processing_transcripts`).

**New Database Function:** `recover_stuck_roleplay_sessions`
```sql
CREATE OR REPLACE FUNCTION public.recover_stuck_roleplay_sessions(
  p_threshold_minutes INTEGER DEFAULT 10
)
RETURNS TABLE(
  session_id uuid, 
  trainee_name text, 
  persona_name text, 
  stuck_since timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  UPDATE roleplay_sessions rs
  SET 
    status = 'abandoned',
    ended_at = now(),
    session_config = rs.session_config || '{"auto_recovered": true}'::jsonb
  FROM profiles p, roleplay_personas rp
  WHERE rs.trainee_id = p.id
    AND rs.persona_id = rp.id
    AND rs.status = 'in_progress'
    AND rs.started_at < now() - (p_threshold_minutes || ' minutes')::interval
  RETURNING 
    rs.id as session_id,
    p.name as trainee_name,
    rp.name as persona_name,
    rs.started_at as stuck_since;
END;
$$;
```

### Part 2: Prevent Future Stuck Sessions

Update the `RoleplaySession.tsx` cleanup to call `abandon-session` when the component unmounts during an active session.

**File:** `src/pages/training/RoleplaySession.tsx`

Current cleanup (line 444-450):
```tsx
useEffect(() => {
  return () => {
    cleanup();
    if (timerRef.current) clearInterval(timerRef.current);
  };
}, []);
```

Updated cleanup:
```tsx
useEffect(() => {
  return () => {
    // If session is active, mark it as abandoned in the database
    if (sessionId && status !== 'idle' && status !== 'ended') {
      // Fire and forget - we're unmounting so can't await
      supabase.functions.invoke('roleplay-session-manager/abandon-session', {
        body: { sessionId }
      }).catch(console.error);
    }
    cleanup();
    if (timerRef.current) clearInterval(timerRef.current);
  };
}, [sessionId, status]);
```

Also add a `beforeunload` handler to catch browser close/refresh:
```tsx
useEffect(() => {
  const handleBeforeUnload = () => {
    if (sessionId && status !== 'idle' && status !== 'ended') {
      // Use sendBeacon for reliability on page unload
      navigator.sendBeacon(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/roleplay-session-manager/abandon-session`,
        JSON.stringify({ sessionId })
      );
    }
  };
  
  window.addEventListener('beforeunload', handleBeforeUnload);
  return () => window.removeEventListener('beforeunload', handleBeforeUnload);
}, [sessionId, status]);
```

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| New migration | Create | Add `recover_stuck_roleplay_sessions` database function |
| `src/pages/training/RoleplaySession.tsx` | Modify | Add cleanup effect to abandon sessions on unmount + beforeunload handler |

---

## Execution Steps

1. **Database Migration**: Create the recovery function
2. **Run Recovery**: Execute `SELECT * FROM recover_stuck_roleplay_sessions()` to fix Grant's stuck session
3. **Update Frontend**: Add the cleanup logic to prevent future stuck sessions

---

## Expected Results

After implementation:
- Grant's stuck session will be marked as `abandoned`
- Any future sessions where users close their browser mid-call will auto-abandon
- A 10-minute threshold gives users time to reconnect if they had a brief network issue
- The `session_config` will include `{"auto_recovered": true}` flag for auditing

---

## Technical Notes

1. **sendBeacon vs fetch**: `sendBeacon` is reliable during page unload when `fetch` may be cancelled
2. **Fire-and-forget**: Cleanup effects can't await since the component is unmounting
3. **Threshold**: 10 minutes balances between giving users time to reconnect vs leaving sessions stuck too long
4. **Audit Trail**: The `auto_recovered` flag in `session_config` helps identify recovered sessions
