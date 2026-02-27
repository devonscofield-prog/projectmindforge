

# SDR Assistant Chatbots: Manager + Rep

## Overview

Create two AI chatbots following the exact same pattern as the existing Sales Assistant Chat -- floating button, slide-out sheet, streaming responses, session persistence -- but tailored for the SDR module:

1. **SDR Manager Assistant** -- Helps managers identify coaching opportunities, analyze team performance, and ask questions about their team's transcripts/grades
2. **SDR Rep Assistant** -- Helps individual SDRs get coaching advice, review their call grades, and improve their performance

Both will use the same OpenAI `gpt-5.2` API as the Sales Assistant (not Lovable AI Gateway), matching the existing architecture.

---

## What Gets Built

### 1. Edge Function: `sdr-assistant-chat`

A single edge function that handles both SDR and SDR Manager chat, differentiating by the caller's role.

**For SDR Managers:**
- Fetches all team members via `sdr_teams` + `sdr_team_members`
- Fetches recent transcripts for all team SDRs
- Fetches all calls + grades for the team
- Builds context showing: team roster, grade distribution per rep, recent coaching notes, lowest-performing areas, reps with the most D/F grades, meetings scheduled rate
- System prompt focused on identifying coaching opportunities, comparing rep performance, and surfacing patterns

**For SDRs:**
- Fetches only that SDR's transcripts, calls, and grades
- Builds context showing: their grade history, strengths/improvements from grading, call summaries, trends over time
- System prompt focused on personal coaching, skill improvement, and call review

### 2. Database: `sdr_assistant_sessions` table

New table mirroring `sales_assistant_sessions` structure for session persistence:
- `id`, `user_id`, `messages` (jsonb), `title`, `is_active`, `created_at`, `updated_at`
- RLS: users can only access their own sessions

### 3. Client API: `src/api/sdrAssistant.ts`

Streaming client matching `salesAssistant.ts` pattern -- calls the `sdr-assistant-chat` edge function with message windowing and truncation.

### 4. Session API: `src/api/sdrAssistantSessions.ts`

Session management matching `salesAssistantSessions.ts` -- fetch, save, archive, switch, delete sessions from `sdr_assistant_sessions`.

### 5. Chat Component: `src/components/SDRAssistantChat.tsx`

Floating chat component matching `SalesAssistantChat.tsx` UI:
- Floating sparkle button in bottom-right
- Slide-out sheet with streaming markdown responses
- Quick actions tailored per role:
  - **Manager**: "Team Performance", "Coaching Opportunities", "Grade Trends", "Weakest Areas"
  - **SDR**: "My Performance", "Improve My Calls", "Recent Grades", "Best Practices"
- Session history, new chat, delete chat
- Rate limit handling

### 6. Integration

- Add `<SDRAssistantChat />` to `SDRManagerDashboard.tsx` and related manager pages
- Add `<SDRAssistantChat />` to `SDRDashboard.tsx` and SDR history page

---

## Technical Details

### Edge Function Context Building

**Manager context includes:**
```
TEAM OVERVIEW
- Team name, member count
- Per-rep stats: total calls, meaningful calls, grade distribution, avg scores, meetings booked

COACHING PRIORITIES  
- Reps with lowest average grades
- Most common improvement areas across team
- Reps trending down vs up

RECENT CALL DETAILS
- Last 5 graded calls per rep with summaries, grades, coaching notes
```

**SDR context includes:**
```
PERFORMANCE SUMMARY
- Total transcripts, calls detected, meaningful calls
- Grade distribution, average scores per category
- Meetings scheduled count

RECENT CALLS
- Last 20 graded calls with summaries, grades, strengths, improvements, coaching notes

TRENDS
- Score trends over time
- Most frequent improvement areas
```

### Files to Create
| File | Purpose |
|------|---------|
| `supabase/functions/sdr-assistant-chat/index.ts` | Edge function |
| `src/api/sdrAssistant.ts` | Streaming client |
| `src/api/sdrAssistantSessions.ts` | Session persistence |
| `src/components/SDRAssistantChat.tsx` | Chat UI component |

### Files to Modify
| File | Change |
|------|--------|
| `src/pages/sdr-manager/SDRManagerDashboard.tsx` | Add `<SDRAssistantChat />` |
| `src/pages/sdr/SDRDashboard.tsx` | Add `<SDRAssistantChat />` |
| `supabase/config.toml` | Not edited (auto-configured) |

### Database Migration
- Create `sdr_assistant_sessions` table with RLS policies (users read/write own rows only)

