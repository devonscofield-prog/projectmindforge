
# Fix: Admins Can't See SDR Transcripts

## Problem

The admin SDR Oversight page filters all transcripts through `sdr_team_members` membership. Since there are currently **0 team members** configured (but 13 transcripts from 3 SDRs exist), the filter removes every transcript from view.

The relevant line in `AdminSDROverview.tsx`:
```
let result = transcripts.filter(t => allMemberIds.has(t.sdr_id));
```

This means if an SDR uploads a transcript but hasn't been added to a team, admins can't see it at all.

## Solution

For admins, skip the team-membership filter so all transcripts are visible regardless of team assignment. The team/rep filters will still work for narrowing results, but the base dataset won't exclude unassigned SDRs.

## Technical Changes

### 1. `src/pages/admin/AdminSDROverview.tsx`

Update the `filteredTranscripts` logic (around line 156-157):
- Remove the `allMemberIds.has(t.sdr_id)` base filter since admins should see everything
- Keep the team/rep/status/date filters as optional narrowing

Also update the member name lookup to gracefully handle SDRs not in any team by falling back to a direct profile lookup or showing the SDR ID.

### 2. `src/pages/admin/AdminSDROverview.tsx` - Member display

Add a fallback for transcript rows where the SDR isn't in `memberMap`:
- Show "Unassigned" or fetch profile names separately for SDRs not in teams
- This ensures transcript rows always show a meaningful name

### 3. Consider adding a query for SDR profiles

Add a small query to fetch profiles for all unique `sdr_id` values from transcripts, so names display correctly even for unassigned SDRs.
