
# Fix Roleplay WebRTC Connection Issue

## Problem Diagnosis

The roleplay call is stuck on "Connecting" because the client-side code is using an **outdated OpenAI Realtime API endpoint**.

### Evidence Collected

1. **Edge function works correctly** - Returns valid ephemeral token (verified via curl test)
2. **Console shows session created** - `Session created: 660d4de1-5dca-450d-82c3-f49fa386e0c1`
3. **No WebRTC connection established** - Status never changes from "connecting" to "connected"

### Root Cause

OpenAI updated their Realtime API endpoints (GA release). The code is using the **pre-GA endpoints** which may no longer work reliably:

| Component | Current (Pre-GA) | Required (GA) |
|-----------|------------------|---------------|
| Token endpoint | `/v1/realtime/sessions` | `/v1/realtime/client_secrets` |
| WebRTC SDP endpoint | `/v1/realtime?model=...` | `/v1/realtime/calls` |

The client code at line 294-298 uses:
```javascript
const baseUrl = 'https://api.openai.com/v1/realtime';
const response = await fetch(`${baseUrl}?model=${model}`, {...});
```

Should use:
```javascript
const response = await fetch('https://api.openai.com/v1/realtime/calls', {...});
```

---

## Solution

### Option A: Update Client Endpoint Only (Quick Fix)

Update the WebRTC SDP endpoint in the client to use `/v1/realtime/calls`:

**File:** `src/pages/training/RoleplaySession.tsx`

```typescript
// Line 293-298: Change from
const baseUrl = 'https://api.openai.com/v1/realtime';
const model = 'gpt-realtime-mini-2025-12-15';
const response = await fetch(`${baseUrl}?model=${model}`, {...});

// To:
const response = await fetch('https://api.openai.com/v1/realtime/calls', {...});
```

This keeps the ephemeral token approach but uses the new GA endpoint.

---

### Option B: Full GA Migration (Recommended)

Update both the edge function and client to use the new GA endpoints for better long-term reliability.

**1. Edge Function Update**

**File:** `supabase/functions/roleplay-session-manager/index.ts`

```typescript
// Line 767: Change from
const openAIResponse = await fetch('https://api.openai.com/v1/realtime/sessions', {...});

// To:
const openAIResponse = await fetch('https://api.openai.com/v1/realtime/client_secrets', {...});

// Also update how we extract the token (line 801):
// From:
ephemeralToken: openAIData.client_secret?.value,
// To:
ephemeralToken: openAIData.value,  // New format returns { value: "ek_..." } directly
```

**2. Client Update**

**File:** `src/pages/training/RoleplaySession.tsx`

```typescript
// Lines 293-305: Replace entire WebRTC connection block
const response = await fetch('https://api.openai.com/v1/realtime/calls', {
  method: 'POST',
  body: offer.sdp,
  headers: {
    'Authorization': `Bearer ${sessionData.ephemeralToken}`,
    'Content-Type': 'application/sdp'
  }
});
```

---

### Option C: Unified Interface (Server-Side SDP)

Use the new "unified interface" where the edge function handles the entire SDP exchange:

This moves the OpenAI API call entirely to the edge function, providing better security since the ephemeral token never reaches the client. However, this is more complex and may increase latency.

---

## Recommended Approach

**Implement Option A first** as a quick fix to verify the issue, then migrate to Option B for long-term reliability.

### Files to Modify

| File | Changes |
|------|---------|
| `src/pages/training/RoleplaySession.tsx` | Update WebRTC endpoint from `/v1/realtime` to `/v1/realtime/calls` |
| `supabase/functions/roleplay-session-manager/index.ts` | (Option B) Update token endpoint and response parsing |

### Additional Improvements

1. **Add connection timeout** - If WebRTC doesn't connect within 15 seconds, show error and allow retry
2. **Add ICE connection state logging** - Log `pc.iceConnectionState` changes for debugging
3. **Add error handling for OpenAI endpoint changes** - Catch specific HTTP errors and provide helpful messages

---

## Technical Implementation Details

### WebRTC Connection Flow (Current vs Fixed)

```text
CURRENT (BROKEN):
┌─────────┐    ┌─────────────┐    ┌─────────────────────┐
│ Browser │───▶│ Edge Func   │───▶│ /v1/realtime/sessions│ ✓ Works
└─────────┘    └─────────────┘    └─────────────────────┘
     │                                      
     └───────────────────────────▶ /v1/realtime?model=... ✗ Fails
                                   (Old endpoint)

FIXED:
┌─────────┐    ┌─────────────┐    ┌──────────────────────────┐
│ Browser │───▶│ Edge Func   │───▶│ /v1/realtime/client_secrets│ ✓ 
└─────────┘    └─────────────┘    └──────────────────────────┘
     │                                      
     └───────────────────────────▶ /v1/realtime/calls ✓
                                   (New GA endpoint)
```

### Code Changes Summary

**RoleplaySession.tsx (lines 293-305):**
```typescript
// BEFORE:
const baseUrl = 'https://api.openai.com/v1/realtime';
const model = 'gpt-realtime-mini-2025-12-15';

const response = await fetch(`${baseUrl}?model=${model}`, {
  method: 'POST',
  body: offer.sdp,
  headers: {
    'Authorization': `Bearer ${sessionData.ephemeralToken}`,
    'Content-Type': 'application/sdp'
  }
});

// AFTER:
const response = await fetch('https://api.openai.com/v1/realtime/calls', {
  method: 'POST',
  body: offer.sdp,
  headers: {
    'Authorization': `Bearer ${sessionData.ephemeralToken}`,
    'Content-Type': 'application/sdp'
  }
});
```

### Testing After Fix

1. Navigate to Training → Practice Roleplay
2. Select any persona (e.g., Dr. Patricia Okonkwo)
3. Click "Start Call" button
4. Verify status changes from "Connecting" to "Connected"
5. Speak and verify the AI persona responds
