

# Fix: Add Missing `session.type` to Realtime WebRTC Configuration

## Problem

Two symptoms, one root cause:

1. **"Session type" error** -- The OpenAI Realtime GA API now requires a `type` field inside the `session.update` event. Valid values are `"realtime"` (speech-to-speech) or `"transcription"`. The current code omits this field entirely, causing OpenAI to return an error.

2. **Steven Green acts as a helpful assistant** -- Because the `session.update` fails due to the missing `type` field, the `instructions` (persona system prompt) never get applied. The model falls back to its default behavior: a generic helpful AI assistant.

## Fix

**File:** `src/pages/training/RoleplaySession.tsx` (around line 363)

Add `type: 'realtime'` to the session configuration object sent via the data channel:

**Before:**
```typescript
dc.send(JSON.stringify({
  type: 'session.update',
  session: {
    modalities: ['text', 'audio'],
    voice,
    instructions,
    input_audio_format: 'pcm16',
    output_audio_format: 'pcm16',
    ...
  }
}));
```

**After:**
```typescript
dc.send(JSON.stringify({
  type: 'session.update',
  session: {
    type: 'realtime',           // <-- required by GA API
    modalities: ['text', 'audio'],
    voice,
    instructions,
    input_audio_format: 'pcm16',
    output_audio_format: 'pcm16',
    ...
  }
}));
```

This is a single-line addition. No edge function or database changes needed -- the system prompt construction is already correct. The issue is purely that the frontend fails to deliver it to OpenAI because the `session.update` event is rejected.

