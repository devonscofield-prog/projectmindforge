

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

**Current Stats:**
- 23 total sessions, 18 completed, 2 abandoned, 2 stuck in "in_progress"
- Only 1 persona active (Steven Green - IT Director)
- Average session duration: ~2 minutes

---

## Priority 1: Critical Fixes

### 1.1 Stuck Sessions Recovery Not Automated

**Issue:** There are 2 sessions stuck in `in_progress` status (one from Jan 28, one from today). The `recover_stuck_roleplay_sessions` function exists but isn't being called automatically.

**Solution:**
- Create a scheduled CRON trigger (or edge function called periodically) to run the recovery function
- Alternative: Add client-side heartbeat mechanism that auto-abandons sessions after inactivity

**Files to modify:**
- Create `supabase/functions/cleanup-stuck-sessions/index.ts` with CRON trigger

---

### 1.2 No Persona Management UI

**Issue:** Admins have no way to create, edit, or manage personas. Currently there's only 1 persona in the system, managed via direct database access.

**Solution:**
- Create admin persona management page at `/admin/training-personas`
- Include CRUD operations for personas with form fields for:
  - Basic info (name, type, industry, difficulty)
  - DISC profile selection
  - Communication style configuration
  - Pain points and objections editors
  - Voice selection (dropdown of valid OpenAI voices)
  - Custom grading criteria editor
  - Toggle for `is_active`

**Files to create:**
- `src/pages/admin/AdminTrainingPersonas.tsx`
- `src/components/admin/PersonaFormDialog.tsx`

---

### 1.3 Session Abandonment via sendBeacon Doesn't Work

**Issue:** The `beforeunload` handler uses `navigator.sendBeacon` which doesn't include auth headers. The edge function requires JWT authentication.

**Solution:**
- Modify `roleplay-session-manager/abandon-session` to accept requests without auth when a valid session ID is provided (using service role internally to verify ownership)
- Add `verify_jwt = false` for abandon-session action with internal validation
- Alternative: Store session ID in a signed cookie/token that can be verified without auth header

**Files to modify:**
- `supabase/functions/roleplay-session-manager/index.ts` (add special handling for beacon requests)
- `supabase/config.toml` (potentially create separate function for abandon)

---

## Priority 2: UX Improvements

### 2.1 Session Type Selection Missing in UI

**Issue:** The code supports 4 session types (discovery, demo, objection_handling, negotiation), but the UI defaults to "discovery" without letting users choose. The sessionType state exists but no selector is shown.

**Solution:**
- Add session type dropdown/radio buttons to RoleplaySession page before call starts
- Update persona cards to show which session types are recommended

**Files to modify:**
- `src/pages/training/RoleplaySession.tsx` (add session type selector UI)

---

### 2.2 No Pre-Call Briefing Screen

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

### 2.3 Missing Post-Session Summary Before Navigation

**Issue:** When the session ends, users see "Session Complete!" but no immediate summary. They have to navigate to session details to see their grade.

**Solution:**
- Fetch and display the grade inline after session ends
- Show quick stats: grade, duration, top strength, top improvement
- Provide "View Full Feedback" button to go to details

**Files to modify:**
- `src/pages/training/RoleplaySession.tsx` (add post-session summary component)

---

### 2.4 Transcript Not Visible During Call (Intentional but Could Be Optional)

**Issue:** The current UI shows only a voice activity indicator during calls, hiding the transcript. This is intentional for focus, but some users may want to see what was said.

**Solution:**
- Add a collapsible/expandable transcript panel that users can toggle during calls
- Keep it collapsed by default to maintain current UX

**Files to modify:**
- `src/pages/training/RoleplaySession.tsx` (add collapsible transcript component)

---

### 2.5 No Retry Grading Option

**Issue:** If grading fails (e.g., session with `duration_seconds: 2` that has no grade), there's no way to retry.

**Solution:**
- Add "Retry Grading" button on SessionDetail for admins/managers when a completed session has no grade
- Create `roleplay-retry-grading` edge function endpoint

**Files to modify:**
- `src/pages/training/SessionDetail.tsx` (add retry button)
- `supabase/functions/roleplay-grade-session/index.ts` (allow re-grading)

---

## Priority 3: Analytics & Tracking

### 3.1 Limited Progress Metrics

**Issue:** TrainingProgress only shows basic stats. No trend charts, no comparison to team averages, no specific skill improvement tracking over time.

**Solution:**
- Add line chart showing score trends over last 10 sessions
- Add comparison to team average (for trainees)
- Add "sessions this week" goal tracking
- Show streak/consistency metrics

**Files to modify:**
- `src/pages/training/TrainingProgress.tsx` (add charts, enhanced metrics)

---

### 3.2 No Persona-Specific Performance Tracking

**Issue:** Users can't see how they perform with different personas or session types.

**Solution:**
- Add breakdown by persona in progress page
- Add breakdown by session type
- Show which persona/type combos need more practice

**Files to modify:**
- `src/pages/training/TrainingProgress.tsx` (add persona/type breakdown)

---

### 3.3 Manager Dashboard Missing Key Insights

**Issue:** ManagerTrainingDashboard shows basic stats but lacks actionable insights.

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

**Issue:** The Sales Coach chat exists but isn't connected to roleplay performance. Coaching recommendations from roleplay aren't linked to the main coaching system.

**Solution:**
- Add "Discuss with Sales Coach" button in SessionDetail that pre-populates context about the session
- Store roleplay coaching_prescription in a way the Sales Coach can reference

**Files to modify:**
- `src/pages/training/SessionDetail.tsx` (add button to open coach with context)
- `supabase/functions/sales-coach-chat/index.ts` (accept roleplay context)

---

### 4.2 No Custom Scenarios

**Issue:** The `scenario_prompt` field exists but there's no UI to enter custom scenarios.

**Solution:**
- Add optional "Custom Scenario" input when starting a session
- Provide scenario templates (e.g., "Price objection focus", "Technical deep-dive", "Executive stakeholder")

**Files to modify:**
- `src/pages/training/RoleplaySession.tsx` (add scenario input)

---

### 4.3 No Demo Mode with Product Knowledge Integration

**Issue:** Demo sessions exist but don't leverage the Product Knowledge Base for realistic product discussions.

**Solution:**
- When starting a demo session, inject relevant product knowledge into the persona's context
- Allow persona to ask realistic product questions based on scraped/uploaded knowledge

**Files to modify:**
- `supabase/functions/roleplay-session-manager/index.ts` (fetch and inject product knowledge for demo sessions)

---

### 4.4 No Audio Playback of Past Sessions

**Issue:** Transcripts are saved as text but audio isn't recorded. Users can't listen back to their sessions.

**Solution:**
- Option A: Record WebRTC audio stream to storage bucket
- Option B: Use text-to-speech to recreate the session from transcript
- Add audio player to SessionDetail page

**Files to create:**
- Audio recording utility in RoleplaySession
- Storage bucket for roleplay recordings

---

## Priority 5: Technical Debt

### 5.1 Hardcoded Production URL

**Issue:** The beforeunload handler hardcodes `import.meta.env.VITE_SUPABASE_URL` which should work, but the redirect URL in the session manager uses hardcoded URLs.

**Solution:**
- Ensure all URLs use environment variables consistently

---

### 5.2 Missing Error Boundary

**Issue:** If the WebRTC connection fails mid-session, there's no graceful recovery.

**Solution:**
- Add error boundary around the call component
- Add reconnection attempt logic
- Show friendly error message with "Try Again" option

**Files to modify:**
- `src/pages/training/RoleplaySession.tsx` (add error handling/reconnection)

---

### 5.3 Key Moments Not Displayed

**Issue:** The grading system returns `key_moments` array with specific transcript moments, but SessionDetail doesn't display them.

**Solution:**
- Add "Key Moments" section to SessionDetail showing the AI-highlighted moments with assessments

**Files to modify:**
- `src/pages/training/SessionDetail.tsx` (add key moments display)

---

## Implementation Phases

### Phase 1 - Critical (Week 1)
1. Create Admin Persona Management UI
2. Fix stuck session recovery (automated CRON)
3. Fix sendBeacon abandonment
4. Add session type selector

### Phase 2 - UX Polish (Week 2)
5. Add pre-call briefing screen
6. Add post-session summary
7. Add collapsible transcript during call
8. Display key moments in SessionDetail
9. Add retry grading option

### Phase 3 - Analytics (Week 3)
10. Enhance TrainingProgress with charts
11. Add persona/type breakdown
12. Enhance ManagerTrainingDashboard

### Phase 4 - Features (Week 4+)
13. Custom scenario input
14. Sales Coach integration
15. Product Knowledge integration for demos
16. Audio recording (optional - higher complexity)

---

## Files Summary

**New Files to Create:**
| File | Purpose |
|------|---------|
| `src/pages/admin/AdminTrainingPersonas.tsx` | Persona CRUD management |
| `src/components/admin/PersonaFormDialog.tsx` | Persona create/edit form |
| `supabase/functions/cleanup-stuck-sessions/index.ts` | CRON job for stuck sessions |

**Files to Modify:**
| File | Changes |
|------|---------|
| `src/pages/training/RoleplaySession.tsx` | Session type selector, briefing screen, post-session summary, collapsible transcript, scenario input |
| `src/pages/training/SessionDetail.tsx` | Key moments display, retry grading button, Sales Coach integration |
| `src/pages/training/TrainingProgress.tsx` | Charts, persona breakdown, enhanced metrics |
| `src/pages/training/ManagerTrainingDashboard.tsx` | Insights, alerts, drill-down views |
| `supabase/functions/roleplay-session-manager/index.ts` | Beacon abandonment handling, product knowledge injection |
| `supabase/functions/roleplay-grade-session/index.ts` | Allow re-grading |

