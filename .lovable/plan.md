

# Add "Meeting Scheduled" Label to SDR Call Grades

## What Changes

Add a `meeting_scheduled` boolean to the grader output so each graded call shows whether a meeting was booked, displayed alongside the letter grade.

## Changes Required

### 1. Database: Add column to `sdr_call_grades`

Add a `meeting_scheduled` boolean column (nullable, defaults to null for existing records):

```sql
ALTER TABLE sdr_call_grades ADD COLUMN meeting_scheduled boolean DEFAULT null;
```

### 2. Edge Functions: Update grader prompts to include `meeting_scheduled`

Both `sdr-grade-call/index.ts` and `sdr-process-transcript/index.ts` contain the default grader prompt. Update the JSON response format in both to include:

```
"meeting_scheduled": true/false  (was a meeting/demo actually booked on this call?)
```

Add a brief instruction in the prompt: "Set meeting_scheduled to true ONLY if a concrete meeting, demo, or appointment was confirmed with a specific date/time. Vague interest or 'call me back' does not count."

Then update the insert statements in both files to include `meeting_scheduled: grade.meeting_scheduled ?? null`.

### 3. Frontend: Display meeting status in 3 locations

**A. `SDRTranscriptDetail.tsx` (call list rows, line ~106-113)**
Next to the grade badge, add a small label:
- If `meeting_scheduled === true`: green "Meeting Set" badge
- If `meeting_scheduled === false`: subtle gray "No Meeting" text
- If `null` (old data): show nothing

**B. `SDRCallDetail.tsx` (call detail header, line ~50-55)**
Next to the large grade badge, add the same meeting status indicator.

**C. `useSDR.ts` type definition**
Add `meeting_scheduled: boolean | null` to the `SDRCallGrade` interface.

### 4. Stats (optional bonus)
Update `useSDRStats` to also count meetings scheduled today for the stats cards on the dashboard.

## Files Modified

| File | Change |
|------|--------|
| Database migration | Add `meeting_scheduled` column |
| `supabase/functions/sdr-grade-call/index.ts` | Update prompt + insert |
| `supabase/functions/sdr-process-transcript/index.ts` | Update prompt + insert |
| `src/hooks/useSDR.ts` | Update `SDRCallGrade` type |
| `src/pages/sdr/SDRTranscriptDetail.tsx` | Show meeting badge in call list |
| `src/pages/sdr/SDRCallDetail.tsx` | Show meeting badge in header |

