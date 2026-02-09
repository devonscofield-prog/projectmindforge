
# Fix: Remove Beta Header from Roleplay WebRTC Handshake

## Problem

The roleplay system uses the **GA (General Availability)** endpoint (`/v1/realtime/calls`) and GA client secrets (`/v1/realtime/client_secrets`), but the WebRTC handshake request still includes the **beta** header `OpenAI-Beta: realtime=v1`. OpenAI rejects this combination with a 400 error: "API version mismatch."

## Fix

One-line change in `src/pages/training/RoleplaySession.tsx` -- remove the `'OpenAI-Beta': 'realtime=v1'` header from the fetch call to `/v1/realtime/calls`.

### File: `src/pages/training/RoleplaySession.tsx` (line ~403)

**Before:**
```typescript
headers: {
  'Authorization': `Bearer ${sessionData.ephemeralToken}`,
  'Content-Type': 'application/sdp',
  'OpenAI-Beta': 'realtime=v1',
}
```

**After:**
```typescript
headers: {
  'Authorization': `Bearer ${sessionData.ephemeralToken}`,
  'Content-Type': 'application/sdp',
}
```

That's it -- the backend token generation is already correct (no beta header). Only the frontend WebRTC handshake needs the header removed.
