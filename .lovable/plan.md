
# Fix: Prevent Roleplay Session Teardown on Tab Switch

## Problem
When you switch tabs during an active roleplay session, the session is abandoned and the WebRTC connection is torn down. You return to find the call has ended.

## Root Cause
The component unmount chain works like this:

1. You switch tabs
2. Supabase's auth listener fires (e.g., `INITIAL_SESSION` on tab refocus)
3. In some edge cases, the AuthContext briefly sets `loading = true`
4. `ProtectedRoute` sees `loading = true` and renders a spinner instead of children
5. This **unmounts** `RoleplaySession`
6. The unmount cleanup effect fires `abandonViaBeacon()` (marks session as abandoned in DB) and `cleanup()` (closes WebRTC, stops audio)
7. When auth resolves, `RoleplaySession` remounts from scratch -- but the session is already abandoned

## Fix (Two-Part)

### Part 1: Guard the unmount cleanup against tab-switch unmounts
Instead of unconditionally abandoning on unmount, check whether the page is actually being navigated away from vs. just being temporarily unmounted by React due to an auth state flicker.

Add an `intentionalLeaveRef` flag:
- Set it to `true` when the user explicitly navigates away (clicks "End Call", "Back", or browser navigation)
- The unmount cleanup only fires `abandonViaBeacon` if this flag is `true` OR if the document is being unloaded (`beforeunload`)
- Tab-switch unmounts (where `intentionalLeaveRef` is `false` and document is still visible) skip the abandon

### Part 2: Stabilize ProtectedRoute during active sessions
Add a `keepAlive` pattern so that when `loading` briefly flips during an active session, the `ProtectedRoute` continues rendering its children instead of unmounting them. This uses a ref to track that children were previously rendered and avoids the loading spinner for brief auth re-checks.

## Technical Details

### File: `src/pages/training/RoleplaySession.tsx`

1. Add an `intentionalLeaveRef = useRef(false)` flag
2. Set `intentionalLeaveRef.current = true` in:
   - The "End Call" / end session handler
   - Any explicit navigation (back button, navigate calls)
3. Update the unmount cleanup (lines ~680-700):
   ```
   return () => {
     window.removeEventListener('beforeunload', abandonViaBeacon);
     // Only abandon if user intentionally left or page is unloading
     if (intentionalLeaveRef.current) {
       abandonViaBeacon();
     }
     cleanup();
     if (timerRef.current) clearInterval(timerRef.current);
   };
   ```
4. The `beforeunload` listener remains as-is (always fires beacon on browser close/refresh)

### File: `src/components/ProtectedRoute.tsx`

Add a stabilization guard: if children were previously rendered and `loading` is now true, continue showing children (with optional subtle indicator) instead of unmounting. Use a ref to track "was previously authenticated":

```
const wasAuthenticatedRef = useRef(false);

if (user && role) wasAuthenticatedRef.current = true;

if (loading && wasAuthenticatedRef.current) {
  // Don't unmount children during brief auth re-checks
  return <MFAGate>{children}</MFAGate>;
}
```

This prevents the destructive unmount/remount cycle for any protected route, not just roleplay.

## Scope
- `src/pages/training/RoleplaySession.tsx` -- add intentional leave guard
- `src/components/ProtectedRoute.tsx` -- add stabilization during auth flickers
