

# SDR Coaching Platform -- New Module

## Overview
Add a completely separate SDR (Sales Development Representative) module to the existing app with two new roles: **SDR** and **SDR Manager**. This module will ingest full-day dialer transcripts, intelligently split them into individual cold calls, filter out voicemails/hangups/inter-call chatter, and grade each meaningful conversation -- giving SDR managers visibility into their team's performance with customizable coaching criteria.

## Key Challenges
1. **Full-day transcripts**: A single upload can contain 1,300+ lines covering dozens of calls, voicemails, dead air, and inter-call banter all mushed together
2. **Call boundary detection**: Must reliably identify where one call ends and another begins using timestamp gaps, speaker changes, and contextual clues
3. **Filtering noise**: Voicemails, instant hangups, and "in-between" conversations (rep talking to coworkers while waiting) must be excluded
4. **Grading cold calls**: Scoring criteria are fundamentally different from demo calls -- focused on opener effectiveness, objection handling speed, appointment setting, etc.

## Architecture Approach
Zero changes to existing tables, roles, edge functions, or routes. Everything is additive:
- New DB enum values (`sdr`, `sdr_manager`) added to `user_role`
- New DB tables prefixed with `sdr_`
- New edge functions prefixed with `sdr-`
- New frontend routes under `/sdr/` and `/sdr-manager/`
- Existing `ProtectedRoute`, `AuthContext`, and routing infrastructure are extended (not modified) to support the new roles

## Phase 1: Database Foundation

### 1a. Extend the `user_role` enum
Add two new values to the existing Postgres enum:
```
ALTER TYPE user_role ADD VALUE 'sdr';
ALTER TYPE user_role ADD VALUE 'sdr_manager';
```

### 1b. New tables

**`sdr_teams`** -- SDR teams (separate from existing `teams` table)
- `id` (uuid, PK)
- `name` (text)
- `manager_id` (uuid, references profiles)
- `created_at`, `updated_at`

**`sdr_team_members`** -- Maps SDRs to SDR teams
- `id` (uuid, PK)
- `team_id` (uuid, FK to sdr_teams)
- `user_id` (uuid, FK to profiles)
- `created_at`

**`sdr_daily_transcripts`** -- Full-day uploaded transcripts
- `id` (uuid, PK)
- `sdr_id` (uuid, FK to profiles)
- `transcript_date` (date)
- `raw_text` (text) -- the full day transcript
- `processing_status` (enum: pending, processing, completed, failed)
- `processing_error` (text, nullable)
- `total_calls_detected` (int, default 0)
- `meaningful_calls_count` (int, default 0)
- `uploaded_by` (uuid) -- could be SDR or manager
- `created_at`, `updated_at`

**`sdr_calls`** -- Individual calls extracted from daily transcripts
- `id` (uuid, PK)
- `daily_transcript_id` (uuid, FK to sdr_daily_transcripts)
- `sdr_id` (uuid)
- `call_index` (int) -- order within the day
- `raw_text` (text) -- extracted call text
- `call_type` (text: 'conversation', 'voicemail', 'hangup', 'internal', 'reminder') 
- `is_meaningful` (boolean) -- true = real conversation worth grading
- `prospect_name` (text, nullable)
- `prospect_company` (text, nullable)
- `duration_estimate_seconds` (int, nullable) -- estimated from timestamps
- `start_timestamp` (text, nullable) -- timestamp from transcript
- `analysis_status` (enum: pending, processing, completed, skipped, failed)
- `created_at`, `updated_at`

**`sdr_call_grades`** -- AI grading results for meaningful calls
- `id` (uuid, PK)
- `call_id` (uuid, FK to sdr_calls)
- `sdr_id` (uuid)
- `overall_grade` (text: A+, A, B, C, D, F)
- `opener_score` (numeric) -- How well they opened
- `engagement_score` (numeric) -- Did they hook the prospect
- `objection_handling_score` (numeric) -- How they handled pushback
- `appointment_setting_score` (numeric) -- Did they set a meeting
- `professionalism_score` (numeric) -- Tone, pace, courtesy
- `call_summary` (text)
- `strengths` (jsonb)
- `improvements` (jsonb)
- `key_moments` (jsonb)
- `coaching_notes` (text)
- `model_name` (text)
- `raw_json` (jsonb) -- full AI response
- `created_at`

**`sdr_coaching_prompts`** -- Customizable coaching prompts (SDR Manager configurable)
- `id` (uuid, PK)
- `team_id` (uuid, FK to sdr_teams, nullable for global defaults)
- `created_by` (uuid)
- `agent_key` (text) -- which agent this customizes (e.g., 'splitter', 'grader', 'filter')
- `prompt_name` (text)
- `system_prompt` (text)
- `scoring_weights` (jsonb, nullable) -- custom weights for grading categories
- `is_active` (boolean, default true)
- `created_at`, `updated_at`

### 1c. RLS Policies
- SDRs can see their own daily transcripts and calls
- SDR Managers can see all data for their team members
- Admin can see everything
- SDR Managers can CRUD coaching prompts for their team

## Phase 2: AI Agent Pipeline (Edge Functions)

### Pipeline Overview
The processing pipeline has 3 stages, all using GPT-5.2 via the existing OpenAI API:

```text
Upload Full-Day Transcript
         |
    [Stage 1: Splitter Agent]
    Reads full transcript, identifies call boundaries
    using timestamp gaps + contextual cues.
    Outputs: array of individual call segments
         |
    [Stage 2: Filter Agent]  
    Classifies each segment:
    - "conversation" (real prospect interaction)
    - "voicemail" (left or reached VM)
    - "hangup" (immediate disconnect)
    - "internal" (rep talking to coworkers)
    - "reminder" (calling to remind about existing meeting)
    Marks meaningful vs. not-meaningful
         |
    [Stage 3: Grader Agent]
    Only processes "meaningful" calls.
    Scores opener, engagement, objection handling,
    appointment setting, professionalism.
    Uses customizable prompts from sdr_coaching_prompts.
```

### Edge Function: `sdr-process-transcript`
- Accepts: `{ daily_transcript_id }` or `{ raw_text, sdr_id, transcript_date }`
- Orchestrates all 3 stages
- Uses `EdgeRuntime.waitUntil()` for background processing (same pattern as competitor-research)
- Returns 202 immediately, UI polls for status

### Edge Function: `sdr-grade-call`
- Accepts: `{ call_id }` or batch `{ call_ids: [] }`
- Loads the team's active coaching prompts (or defaults)
- Grades individual calls with customizable scoring weights
- Stores results in `sdr_call_grades`

### Prompt Customization
SDR Managers can customize:
- **Grader system prompt**: What to evaluate and prioritize (e.g., "Our team focuses on appointment setting, weight that 40%")
- **Grader scoring weights**: Adjust the 5 category weights
- **Filter sensitivity**: What counts as "meaningful" (e.g., minimum conversation turns)

Defaults are provided out of the box so the system works without any customization.

## Phase 3: Frontend -- SDR Views

### Routes (all under `/sdr/`)
- `/sdr` -- SDR Dashboard (today's stats, recent grades)
- `/sdr/upload` -- Upload daily transcript
- `/sdr/history` -- View past daily transcripts and extracted calls
- `/sdr/calls/:id` -- Individual call detail with grade breakdown

### Key Components
- **SDRDashboard**: Daily summary cards (calls made, conversations had, avg grade, appointments set)
- **TranscriptUploadForm**: Drag-and-drop or paste full-day transcript
- **SDRCallList**: Table of extracted calls with type badges and grades
- **SDRCallDetail**: Full call text with inline grade visualization, strengths, improvements

## Phase 4: Frontend -- SDR Manager Views

### Routes (all under `/sdr-manager/`)
- `/sdr-manager` -- Team dashboard (aggregate stats across SDRs)
- `/sdr-manager/team` -- Team member list with performance summaries
- `/sdr-manager/rep/:id` -- Individual SDR's performance drilldown
- `/sdr-manager/coaching` -- Customize coaching prompts and scoring weights
- `/sdr-manager/transcripts` -- View/upload transcripts for any team member

### Key Components
- **SDRManagerDashboard**: Team-wide metrics (total calls, avg grade, top performers, trends)
- **CoachingPromptEditor**: UI for editing grading prompts and weights per agent
- **SDRPerformanceCard**: Per-SDR stats with grade distribution chart
- **TeamLeaderboard**: Ranked view of SDRs by performance

## Phase 5: Auth and Navigation Integration

### Changes to existing infrastructure (minimal, additive only)
- **`src/types/database.ts`**: Add `'sdr' | 'sdr_manager'` to the `UserRole` type
- **`src/lib/routes.ts`**: Add `getDashboardUrl` cases for new roles
- **`src/components/ProtectedRoute.tsx`**: No changes needed (already supports any `UserRole`)
- **`src/contexts/AuthContext.tsx`**: No changes needed (role comes from DB)
- **`src/App.tsx`**: Add new route blocks for `/sdr/*` and `/sdr-manager/*`
- **`src/components/layout/AppLayout.tsx`**: Add SDR-specific navigation sidebar items based on role
- **`handle_new_user` DB function**: No changes (new users default to 'rep'; admin assigns SDR roles manually)
- **`src/lib/routePreloader.ts`**: Add preload entries for SDR routes

### Admin capabilities
Admins will be able to assign `sdr` and `sdr_manager` roles to users through the existing user management UI. The existing `AdminUserEdit` page will need the role dropdown extended to include the two new options.

## Implementation Order
Given the scope, this should be implemented incrementally:

1. **Database migration** -- enum extension + all new tables + RLS policies
2. **Type updates** -- `UserRole` type, route helpers
3. **Edge functions** -- `sdr-process-transcript` (splitter + filter + grader pipeline)
4. **SDR frontend** -- Upload, dashboard, call list, call detail pages
5. **SDR Manager frontend** -- Team dashboard, coaching prompt editor
6. **Navigation integration** -- Sidebar, route registration, role assignment in admin UI

## Technical Considerations
- The splitter agent is the most critical -- it needs to handle timestamp gaps (e.g., 04:41 to 12:26 = new call), speaker label changes, and contextual clues like "Hello, hi, is this [name]?" as call openers
- The uploaded transcript format uses `Speaker N | MM:SS` or `username | MM:SS` patterns -- the splitter must handle both
- Timestamp gaps of 30+ seconds with a new greeting pattern strongly indicate a new call
- GPT-5.2 with a large context window can handle 1,300+ line transcripts in a single pass for splitting
- Grading runs per-call so each is a smaller, focused AI task
