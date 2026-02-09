

# Fix: Remove `modalities` from WebRTC Session Update

## Problem
When starting a roleplay call with Steven Green, OpenAI's Realtime API returns a "Session Modalities" error via the data channel. This is displayed as a toast error to the user.

## Root Cause
In `src/pages/training/RoleplaySession.tsx` (line 367), the `session.update` message sent over the WebRTC data channel includes `modalities: ['text', 'audio']`. With the GA (General Availability) version of the OpenAI Realtime API over WebRTC, modalities are determined by the connection type itself and should **not** be set in `session.update`. Including them causes a validation error.

## Fix
Remove the `modalities` line from the `session.update` payload in `RoleplaySession.tsx` (line 367). The `type: 'realtime'` field stays as it is required per GA requirements.

```typescript
// Before (line 363-382)
dc.send(JSON.stringify({
  type: 'session.update',
  session: {
    type: 'realtime',
    modalities: ['text', 'audio'],  // <-- REMOVE THIS
    voice,
    instructions,
    ...
  }
}));

// After
dc.send(JSON.stringify({
  type: 'session.update',
  session: {
    type: 'realtime',
    voice,
    instructions,
    ...
  }
}));
```

## Scope
Single line removal in one file: `src/pages/training/RoleplaySession.tsx`

No database, edge function, or other frontend changes needed.
