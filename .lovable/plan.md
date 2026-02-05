
# Roleplay System Improvements

## Overview
This plan addresses 10 items across security, code quality, and missing features in the Sales Roleplay system.

---

## Security Fixes

### 7. Ephemeral Token TTL -- Document/Verify Scope and Expiration
The OpenAI Realtime API's `client_secrets` endpoint returns ephemeral tokens with a default 60-second TTL. Currently, the code doesn't document this or handle expiration gracefully.

**Changes:**
- Add inline documentation in `roleplay-session-manager/index.ts` explaining the token scope (single WebRTC handshake) and ~60s expiration
- Add a client-side timeout in `RoleplaySession.tsx` that shows an error if the WebRTC handshake hasn't completed within 30 seconds of receiving the token, prompting the user to retry

### 8. Rate Limiting on Session Creation
No rate limiting exists on `create-session`, allowing potential API credit abuse.

**Changes:**
- Add in-memory rate limiting in `roleplay-session-manager/index.ts` (similar to the pattern already used in `reset-database`)
- Limit: 5 sessions per user per hour (sliding window)
- Return 429 status with `Retry-After` header when exceeded
- Add client-side handling in `RoleplaySession.tsx` to display a user-friendly message when rate limited

### 9. Auth Check (Already Fixed)
Noted as fixed as part of fix 6 -- no action needed.

---

## Code Quality / Maintenance

### 17. Extract Shared Persona Interface
The `Persona` interface is duplicated across 5 files with slight variations.

**Changes:**
- Create `src/types/persona.ts` with two variants:
  - `PersonaBase` -- the common subset (id, name, persona_type, disc_profile, difficulty_level, industry, backstory, voice)
  - `PersonaFull` -- extends base with admin fields (is_active, communication_style as Json, common_objections as Json, etc.)
  - `PersonaClient` -- the typed version used in RoleplaySession/RoleplayBriefing with parsed fields
- Update imports in: `RoleplaySession.tsx`, `RoleplayBriefing.tsx`, `TrainingDashboard.tsx`, `AdminTrainingPersonas.tsx`, `PersonaFormDialog.tsx`

### 18. Extract Shared gradeColors Map
The `gradeColors` map is duplicated identically in 3 files (TrainingHistory, SessionDetail, RoleplayPostSession). A 4th variant exists in `coach-grade-badge.tsx` with different styling.

**Changes:**
- Create `src/constants/training.ts` with exported `gradeColors` (the `bg-X text-white` variant used in 3 files)
- Update imports in: `TrainingHistory.tsx`, `SessionDetail.tsx`, `RoleplayPostSession.tsx`
- Leave `coach-grade-badge.tsx` as-is since it uses a different style pattern (border-based)

### 19. Break Up 526-line buildPersonaSystemPrompt
The function is a single monolithic string concatenation spanning lines 99-625.

**Changes:**
- Split into composable builder functions within the same file (keeping edge function single-file requirement):
  - `buildDiscBehaviorSection(persona)` -- DISC profile instructions
  - `buildOpeningMoodSection(commStyle)` -- randomized mood selection
  - `buildResponseDepthSection()` -- discovery ladder rules
  - `buildGuardModeSection()` -- initial guarded behavior
  - `buildPainPointRevealSection(persona)` -- pain point progressive disclosure
  - `buildSessionTypeSection(sessionType, screenShareEnabled)` -- session-specific instructions
  - `buildVisionSection(screenShareEnabled)` -- screen sharing instructions
  - `buildGradingCriteriaSection(persona)` -- success criteria and negative triggers
  - `buildAbsoluteRulesSection(persona)` -- never-break rules
- Main `buildPersonaSystemPrompt` becomes a simple orchestrator calling these functions and joining results

### 20. SessionDetail Missing AppLayout Wrapper
`SessionDetail.tsx` renders without `AppLayout`, making navigation inconsistent with all other training pages.

**Changes:**
- Import `AppLayout` and wrap the component's return JSX
- Wrap loading and error states as well

---

## Missing Features

### 21. Pause/Resume Capability During Sessions
Allow users to temporarily pause the mic and AI interaction during a session (e.g., to take a note or handle an interruption).

**Changes in `RoleplaySession.tsx`:**
- Add `isPaused` state
- When paused: mute the mic, send a `response.cancel` event via data channel, show a "Paused" overlay on the call card
- Pause the elapsed timer (adjust `callStartTimeRef` to exclude paused time)
- Add a Pause/Resume button in the call controls bar (using `Pause`/`Play` icons from lucide)
- "Paused" status badge and visual overlay

### 22. Audio Recording (DB Column Exists But Unused)
The database has an `audio_recording_url` column on `roleplay_sessions` but no recording is captured.

**Changes:**
- In `RoleplaySession.tsx`, use `MediaRecorder` API to record the user's mic stream when the session starts
- On session end, upload the audio blob to storage via the Supabase storage bucket
- Update the `end-session` handler in `roleplay-session-manager` to save the storage URL to `audio_recording_url`
- Add a playback button in `SessionDetail.tsx` when `audio_recording_url` is present
- Create a `roleplay-recordings` storage bucket with appropriate RLS

### 24. Real-Time Mic Audio Level Indicator
Show the user a visual indicator of their microphone input level during active calls.

**Changes in `RoleplaySession.tsx`:**
- Create an `AudioLevelMeter` component using `AnalyserNode` from Web Audio API
- Connect it to the user's mic stream when the call starts
- Display as a small animated bar/arc near the mic button or in the status area
- Shows the user their mic is picking up audio (useful feedback for "am I being heard?")

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/types/persona.ts` | Shared Persona type definitions |
| `src/constants/training.ts` | Shared gradeColors and other training constants |
| `src/components/training/AudioLevelMeter.tsx` | Real-time mic level visualizer |

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/roleplay-session-manager/index.ts` | Rate limiting, token TTL docs, prompt refactor into composable parts, storage URL on end-session |
| `src/pages/training/RoleplaySession.tsx` | Pause/resume, audio recording, mic level indicator, rate limit handling, token timeout |
| `src/pages/training/SessionDetail.tsx` | Add AppLayout wrapper, audio playback button, import shared gradeColors |
| `src/pages/training/TrainingHistory.tsx` | Import shared gradeColors |
| `src/pages/training/TrainingDashboard.tsx` | Import shared Persona type |
| `src/components/training/RoleplayPostSession.tsx` | Import shared gradeColors |
| `src/components/training/RoleplayBriefing.tsx` | Import shared Persona type |
| `src/pages/admin/AdminTrainingPersonas.tsx` | Import shared Persona type |
| `src/components/admin/PersonaFormDialog.tsx` | Import shared Persona type |

## Implementation Sequence

1. Create shared types and constants files (17, 18)
2. Update all imports to use shared types/constants
3. Refactor `buildPersonaSystemPrompt` into composable parts (19)
4. Add rate limiting to session creation (8)
5. Add token TTL documentation and client-side timeout (7)
6. Wrap SessionDetail in AppLayout (20)
7. Implement pause/resume capability (21)
8. Implement audio recording with storage (22)
9. Add mic audio level indicator (24)
