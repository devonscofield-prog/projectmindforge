

# Fix: Restore RLS Policies Lost During Trainee Role Removal

## Root Cause

The migration that removed the `trainee` role used `DROP TYPE public.user_role CASCADE`, which cascaded and **silently dropped every RLS policy that referenced `has_role()` with `::user_role` type casting**. The functions were recreated, but the dependent RLS policies were not.

This means admins and managers currently have **no access** to most shared data -- call transcripts, profiles, user roles, prospects, email logs, analysis, coaching sessions, and more.

## What's Missing

A database migration to recreate all dropped admin/manager RLS policies. Based on cross-referencing what currently exists against what the migration history shows should exist, these policies need to be restored:

### Core Tables (Blocking Admin Call History)

| Table | Missing Policy |
|-------|---------------|
| `profiles` | "Admins can manage all profiles" (FOR ALL) |
| `profiles` | "Managers can view team profiles" (FOR SELECT) |
| `user_roles` | "Admins can manage all roles" (FOR ALL) |
| `call_transcripts` | "Admins can manage all transcripts" (FOR ALL) |
| `call_transcripts` | "Managers can view team transcripts" (FOR SELECT) |
| `call_transcripts` | "Admins can view deleted transcripts" (FOR SELECT) |

### Additional Tables (Also Affected)

| Table | Missing Policy |
|-------|---------------|
| `ai_call_analysis` | "Admins can view all analysis" (FOR SELECT) |
| `ai_call_analysis` | "Managers can view team analysis" (FOR SELECT) |
| `email_logs` | "Managers can view team email logs" (FOR SELECT) |
| `email_logs` | "Admins can manage all email logs" (FOR ALL) |
| `email_logs` | "Admins can view deleted email logs" (FOR SELECT) |
| `prospects` | "Admins can manage all prospects" (FOR ALL) |
| `prospects` | "Managers can view team prospects" (FOR SELECT) |
| `prospects` | "Admins can view deleted prospects" (FOR SELECT) |
| `teams` | "Admins can manage all teams" (FOR ALL) |
| `rep_performance_snapshots` | Admin/Manager SELECT policies |
| `coaching_sessions` | Admin/Manager policies |
| `account_follow_ups` | Admin/Manager policies |
| `prospect_activities` | Admin/Manager policies |
| `activity_logs` | Admin policies |
| `sales_coach_sessions` | "Admins can view all sessions" (FOR SELECT) |
| `sales_assistant_sessions` | "Admins can view all sessions" (FOR SELECT) |
| `performance_metrics` | "Admins can view all metrics" (FOR SELECT) |
| `data_access_logs` | "Admins can view all access logs" (FOR SELECT) |
| `roleplay_personas` | "Admins can manage personas" (FOR ALL) and rep view policy |

## Implementation

A single database migration that uses `DROP POLICY IF EXISTS` + `CREATE POLICY` for each missing policy, restoring the exact same definitions from the historical migrations. All policies use the existing `has_role()` and `is_manager_of_user()` security definer functions.

No frontend or edge function changes are needed -- the code already expects these policies to exist and is querying correctly. The data is simply invisible due to the missing RLS rules.

## Risk

Low. This is a restore operation using the exact policy definitions that previously existed and were working. The `has_role()` function is confirmed working. Using `DROP POLICY IF EXISTS` before each `CREATE POLICY` ensures idempotency.

