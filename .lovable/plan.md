

# Add SDR Team Management to Admin SDR Oversight

## Current State

The SDR team data (Lonnell's team with 7 members) was set up via direct database inserts. There is currently **no admin UI** to manage SDR teams -- the existing Admin Teams page at `/admin/teams` manages the regular sales rep `teams` table, not the `sdr_teams` / `sdr_team_members` tables that control SDR manager visibility.

Without this UI, admins cannot:
- Create or edit SDR teams
- Assign/change team managers
- Add or remove SDR members from teams

## Solution

Add an **SDR Teams management tab** to the existing Admin SDR Oversight page (`/admin/sdr`), which already has tabs for "Teams and SDRs", "All Transcripts", and "Grade Distribution".

### What will be built

**A new "Manage Teams" tab** on the Admin SDR Oversight page with:

1. **Team list** showing each SDR team with its manager name, member count, and created date
2. **Create Team** dialog -- name field + manager dropdown (filtered to users with `sdr_manager` role)
3. **Edit Team** dialog -- update name and manager assignment
4. **Delete Team** confirmation with member-unassign warning
5. **Member management** -- clicking a team expands to show members with ability to add/remove SDRs (users with `sdr` role)

### Manager dropdown

The manager selector will query `user_roles` for users with the `sdr_manager` role and join with `profiles` for their names, ensuring only valid SDR managers can be assigned.

### Member management

The member add dialog will show users with the `sdr` role who are not already assigned to a team, allowing the admin to assign them.

## Technical Details

### Files to modify

- **`src/pages/admin/AdminSDROverview.tsx`** -- Add a fourth tab "Manage Teams" with CRUD for `sdr_teams` and `sdr_team_members`

### Files to create

- **`src/components/admin/sdr/SDRTeamManagement.tsx`** -- New component containing the team management UI (table, create/edit/delete dialogs, member management)

### Data queries

- Teams: `SELECT * FROM sdr_teams`
- Members: `SELECT stm.*, p.name, p.email FROM sdr_team_members stm JOIN profiles p ON p.id = stm.user_id WHERE stm.team_id = ?`
- Manager options: `SELECT p.id, p.name FROM profiles p JOIN user_roles ur ON ur.user_id = p.id WHERE ur.role = 'sdr_manager'`
- SDR options (for adding): `SELECT p.id, p.name FROM profiles p JOIN user_roles ur ON ur.user_id = p.id WHERE ur.role = 'sdr' AND p.id NOT IN (SELECT user_id FROM sdr_team_members)`

### RLS

No changes needed -- existing RLS policies on `sdr_teams` and `sdr_team_members` already allow admins full access via the `has_role(auth.uid(), 'admin')` policies.

