

# Fix Roleplay System Bugs

## Overview

Five bugs to fix across the roleplay training system: a missing Pause button, a broken Coach integration, stuck "pending" sessions, short-session grading failures, and confusing history navigation.

---

## Bug 1: Missing Pause/Resume Button

**Problem:** The `togglePause` function exists in `RoleplaySession.tsx` (line 627) but no button renders it. The call controls (lines 999-1043) only show Screen Share, Mute, and End Call.

**Fix:** Add a Pause/Resume button between the Screen Share and Mute buttons in the active call controls section (~line 1023). Use the `Pause`/`Play` icons already imported. Disable the button during the `ending` state.

**File:** `src/pages/training/RoleplaySession.tsx`

---

## Bug 2: "Discuss with Coach" Button Goes Nowhere

**Problem:** `SessionDetail.tsx` navigates to `/training?coachContext=...` but `TrainingDashboard.tsx` never reads or uses the `coachContext` query parameter. The toast says "Opening Sales Coach" but nothing happens.

**Fix:** In `TrainingDashboard.tsx`, read `coachContext` from the URL search params. When present, display a pre-filled Coach context card or modal that shows the roleplay feedback and offers a way to act on it (e.g., start a new session focused on the identified weakness). If the Sales Coach chat component exists elsewhere, integrate with it; otherwise, show the coaching prescription in a highlighted card with a "Practice This" action button that pre-selects the relevant persona and session type.

**Files:** `src/pages/training/TrainingDashboard.tsx`

---

## Bug 3: Stuck "Pending" Sessions Not Cleaned Up

**Problem:** The `cleanup-stuck-sessions` edge function only recovers sessions with `status = 'in_progress'`. Three sessions are stuck in `status = 'pending'` indefinitely because pending sessions are never cleaned up.

**Fix:** Update `cleanup-stuck-sessions/index.ts` to also target `pending` sessions. Use an OR filter: `.in('status', ['in_progress', 'pending'])`. Use the same 10-minute threshold. The `roleplay-abandon-session` function already handles both states, so this is consistent.

**File:** `supabase/functions/cleanup-stuck-sessions/index.ts`

---

## Bug 4: Short Sessions Stuck in "Grading" State

**Problem:** Very short sessions (under ~10 seconds) have empty or near-empty transcripts. When grading is triggered, it likely fails silently, leaving users on the post-session screen with a perpetual "Grading..." spinner and no timeout recovery path.

**Fix:** Add a minimum duration guard in `endSession()` in `RoleplaySession.tsx`. If `elapsedSeconds < 15`, skip the grading call entirely and set the session status to `completed` without triggering `roleplay-grade-session`. Show a toast explaining that the session was too short for meaningful feedback. The post-session screen will then show "View Session" instead of waiting for a grade.

**File:** `src/pages/training/RoleplaySession.tsx`

---

## Bug 5: Clicking Abandoned/Pending Sessions in History

**Problem:** `TrainingHistory.tsx` makes all sessions clickable regardless of status. Clicking an `abandoned` or `pending` session navigates to `SessionDetail`, which shows an empty/confusing state with no grade, no transcript, and a misleading "Grading in Progress" message.

**Fix:** Two changes:
1. In `TrainingHistory.tsx`, visually dim abandoned/pending sessions and either disable the click or add a subtle visual indicator that these sessions have no review data.
2. In `SessionDetail.tsx`, add status-aware messaging. If `session.status` is `abandoned` or `pending`, show a clear message like "This session was not completed" instead of the "Grading in Progress" fallback. Hide the "Practice Again" and "Discuss with Coach" actions for non-completed sessions.

**Files:** `src/pages/training/TrainingHistory.tsx`, `src/pages/training/SessionDetail.tsx`

---

## Implementation Sequence

1. Bug 1 -- Add Pause button (single line insertion, lowest risk)
2. Bug 3 -- Fix cleanup CRON to include pending sessions (edge function change)
3. Bug 4 -- Add minimum duration guard before grading
4. Bug 5 -- Improve history list and session detail for non-completed sessions
5. Bug 2 -- Wire up coachContext in TrainingDashboard

## Files Modified

| File | Bug |
|------|-----|
| `src/pages/training/RoleplaySession.tsx` | 1, 4 |
| `supabase/functions/cleanup-stuck-sessions/index.ts` | 3 |
| `src/pages/training/TrainingHistory.tsx` | 5 |
| `src/pages/training/SessionDetail.tsx` | 5 |
| `src/pages/training/TrainingDashboard.tsx` | 2 |
