

# Fix: Migrate Roleplay Session to OpenAI Realtime GA Format

## Problem
Starting a roleplay call produces a "Session Voice" validation error. This follows the same pattern as the previous "Session Modalities" error -- the `session.update` payload uses the **legacy flat format** which the GA API rejects.

## Root Cause
The `session.update` sent over the WebRTC data channel in `src/pages/training/RoleplaySession.tsx` uses legacy top-level fields:
- `voice` (should be `audio.output.voice`)
- `input_audio_format` (should be `audio.input.format.type`)
- `output_audio_format` (removed -- WebRTC determines this)
- `input_audio_transcription` (should be `audio.input.transcription`)

The GA API expects a nested `audio` object structure and rejects unknown top-level fields.

## Fix

Single file change in `src/pages/training/RoleplaySession.tsx` (lines 362-381). Convert the session.update payload from legacy to GA format:

**Before:**
```typescript
dc.send(JSON.stringify({
  type: 'session.update',
  session: {
    type: 'realtime',
    voice,
    instructions,
    input_audio_format: 'pcm16',
    output_audio_format: 'pcm16',
    input_audio_transcription: {
      model: 'whisper-1'
    },
    turn_detection: {
      type: 'server_vad',
      threshold: 0.5,
      prefix_padding_ms: 300,
      silence_duration_ms: silenceDurationMs
    }
  }
}));
```

**After:**
```typescript
dc.send(JSON.stringify({
  type: 'session.update',
  session: {
    type: 'realtime',
    instructions,
    audio: {
      output: {
        voice
      },
      input: {
        format: { type: 'pcm16' },
        transcription: { model: 'whisper-1' },
        noise_reduction: { type: 'near_field' }
      }
    },
    turn_detection: {
      type: 'server_vad',
      threshold: 0.5,
      prefix_padding_ms: 300,
      silence_duration_ms: silenceDurationMs
    }
  }
}));
```

## Key Changes
- `voice` moved into `audio.output.voice`
- `input_audio_format` moved into `audio.input.format.type`
- `output_audio_format` removed (WebRTC handles output format)
- `input_audio_transcription` moved into `audio.input.transcription`
- Added `noise_reduction` for cleaner audio input

## Scope
One file: `src/pages/training/RoleplaySession.tsx`, lines 362-381

No database, edge function, or other changes needed.
