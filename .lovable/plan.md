
# Practice Roleplay System Audit & Improvement Plan

## Executive Summary

After a comprehensive audit of the Practice Roleplay system, I've identified 15 improvement areas spanning UX, reliability, persona management, analytics, and feature gaps. The system has a solid foundation with sophisticated persona logic, DISC-based voice mapping, and AI grading, but there are significant opportunities to improve the overall experience.

---

## Current System Overview

**Architecture:**
- **Edge Functions**: `roleplay-session-manager` (create/end/abandon sessions) and `roleplay-grade-session` (AI grading)
- **Frontend Pages**: TrainingDashboard, RoleplaySession, TrainingHistory, TrainingProgress, SessionDetail, ManagerTrainingDashboard
- **Database Tables**: `roleplay_personas`, `roleplay_sessions`, `roleplay_transcripts`, `roleplay_grades`
- **Features**: WebRTC voice with OpenAI Realtime API, screen sharing, DISC-based personas, AI grading with custom criteria

---

## ✅ Phase 1: Critical Fixes (COMPLETED)

### ✅ 1.1 Stuck Sessions Recovery - DONE

**Implemented:**
- Created `supabase/functions/cleanup-stuck-sessions/index.ts` edge function
- Set up CRON job to run every 15 minutes
- Automatically marks sessions stuck in `in_progress` for >10 minutes as `abandoned`

---

### ✅ 1.2 Admin Persona Management UI - DONE

**Implemented:**
- Created `src/pages/admin/AdminTrainingPersonas.tsx` - Full CRUD management page
- Created `src/components/admin/PersonaFormDialog.tsx` - Create/edit form with tabs for:
  - Basic info (name, type, industry, difficulty, voice, DISC profile)
  - Behavior (dos and don'ts)
  - Challenges (pain points and objections)
- Added route at `/admin/training-personas`

---

### ✅ 1.3 Session Abandonment via sendBeacon - DONE

**Implemented:**
- Created dedicated `supabase/functions/roleplay-abandon-session/index.ts`
- Set `verify_jwt = false` to allow sendBeacon requests without auth headers
- Updated `RoleplaySession.tsx` to use the new endpoint
- Validates session exists and is in abandonable state before updating

---

### ✅ 1.4 Session Type Selection - DONE

**Implemented:**
- Added session type selector UI in `RoleplaySession.tsx` (Discovery / Demo buttons)
- Shows description of selected session type
- Session type is passed to the edge function and affects persona behavior

---

## Priority 2: UX Improvements (NEXT)

### 2.1 Pre-Call Briefing Screen

**Issue:** Users jump straight into the call without understanding the persona's background, likely objections, or session goals.

**Solution:**
- Add a "briefing" screen before starting the call that shows:
  - Persona name, role, industry, DISC profile
  - Key challenges to uncover
  - Common objections to expect
  - Session tips based on type
  - A "Start Call" button to proceed

**Files to modify:**
- `src/pages/training/RoleplaySession.tsx` (add briefing state/component)

---

### 2.2 Post-Session Summary

**Issue:** When the session ends, users see "Session Complete!" but no immediate summary.

**Solution:**
- Fetch and display the grade inline after session ends
- Show quick stats: grade, duration, top strength, top improvement
- Provide "View Full Feedback" button to go to details

**Files to modify:**
- `src/pages/training/RoleplaySession.tsx` (add post-session summary component)

---

### 2.3 Key Moments Display

**Issue:** The grading system returns `key_moments` array with specific transcript moments, but SessionDetail doesn't display them.

**Solution:**
- Add "Key Moments" section to SessionDetail showing the AI-highlighted moments with assessments

**Files to modify:**
- `src/pages/training/SessionDetail.tsx` (add key moments display)

---

### 2.4 Retry Grading Option

**Issue:** If grading fails, there's no way to retry.

**Solution:**
- Add "Retry Grading" button on SessionDetail for admins/managers when a completed session has no grade

**Files to modify:**
- `src/pages/training/SessionDetail.tsx` (add retry button)

---

### 2.5 Collapsible Transcript During Call

**Issue:** The current UI shows only a voice activity indicator during calls.

**Solution:**
- Add a collapsible/expandable transcript panel that users can toggle during calls
- Keep it collapsed by default to maintain current UX

**Files to modify:**
- `src/pages/training/RoleplaySession.tsx` (add collapsible transcript component)

---

## Priority 3: Analytics & Tracking

### 3.1 Limited Progress Metrics

**Solution:**
- Add line chart showing score trends over last 10 sessions
- Add comparison to team average (for trainees)
- Add "sessions this week" goal tracking
- Show streak/consistency metrics

**Files to modify:**
- `src/pages/training/TrainingProgress.tsx` (add charts, enhanced metrics)

---

### 3.2 No Persona-Specific Performance Tracking

**Solution:**
- Add breakdown by persona in progress page
- Add breakdown by session type
- Show which persona/type combos need more practice

**Files to modify:**
- `src/pages/training/TrainingProgress.tsx` (add persona/type breakdown)

---

### 3.3 Manager Dashboard Missing Key Insights

**Solution:**
- Add "trainees needing attention" section (those with declining scores or low activity)
- Add average score by persona/type charts
- Add ability to assign practice goals to trainees
- Add drill-down to view individual trainee transcripts

**Files to modify:**
- `src/pages/training/ManagerTrainingDashboard.tsx` (enhance analytics)

---

## Priority 4: Feature Additions

### 4.1 No Coaching Integration

**Solution:**
- Add "Discuss with Sales Coach" button in SessionDetail that pre-populates context about the session
- Store roleplay coaching_prescription in a way the Sales Coach can reference

**Files to modify:**
- `src/pages/training/SessionDetail.tsx` (add button to open coach with context)
- `supabase/functions/sales-coach-chat/index.ts` (accept roleplay context)

---

### 4.2 No Custom Scenarios

**Solution:**
- Add optional "Custom Scenario" input when starting a session
- Provide scenario templates (e.g., "Price objection focus", "Technical deep-dive", "Executive stakeholder")

**Files to modify:**
- `src/pages/training/RoleplaySession.tsx` (add scenario input)

---

### 4.3 No Demo Mode with Product Knowledge Integration

**Solution:**
- When starting a demo session, inject relevant product knowledge into the persona's context
- Allow persona to ask realistic product questions based on scraped/uploaded knowledge

**Files to modify:**
- `supabase/functions/roleplay-session-manager/index.ts` (fetch and inject product knowledge for demo sessions)

---

## Implementation Progress

| Phase | Status | Items |
|-------|--------|-------|
| Phase 1 - Critical | ✅ COMPLETE | Admin Persona UI, Stuck Sessions CRON, sendBeacon Fix, Session Type Selector |
| Phase 2 - UX Polish | ⏳ PENDING | Pre-call briefing, Post-session summary, Key moments, Retry grading, Collapsible transcript |
| Phase 3 - Analytics | ⏳ PENDING | Progress charts, Persona breakdown, Manager insights |
| Phase 4 - Features | ⏳ PENDING | Custom scenarios, Sales Coach integration, Product Knowledge integration |
