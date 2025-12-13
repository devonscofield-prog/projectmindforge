# API Reference

This document provides a comprehensive reference for all hooks, APIs, and services.

## Table of Contents

- [Authentication](#authentication)
- [Data Hooks](#data-hooks)
- [Mutation Hooks](#mutation-hooks)
- [API Functions](#api-functions)
- [Utility Functions](#utility-functions)

---

## Authentication

### useAuth

Access authentication state and methods.

```typescript
import { useAuth } from '@/contexts/AuthContext';

const {
  user,      // Supabase User | null
  session,   // Supabase Session | null
  profile,   // Profile | null
  role,      // 'rep' | 'manager' | 'admin' | null
  loading,   // boolean
  signIn,    // (email, password) => Promise<{ error }>
  signUp,    // (email, password, name) => Promise<{ error }>
  signOut,   // () => Promise<void>
} = useAuth();
```

#### Example

```tsx
function LoginForm() {
  const { signIn, loading } = useAuth();
  
  const handleSubmit = async (data) => {
    const { error } = await signIn(data.email, data.password);
    if (error) {
      toast.error(error.message);
    }
  };
  
  return <form onSubmit={handleSubmit}>...</form>;
}
```

---

## Data Hooks

### Teams

#### useTeams

Fetch all teams (basic info).

```typescript
import { useTeams } from '@/hooks/useTeams';

const { data: teams, isLoading, error } = useTeams();
// Returns: TeamBasic[] = { id: string, name: string }[]
```

#### useTeamsFull

Fetch all teams with complete details.

```typescript
import { useTeamsFull } from '@/hooks/useTeams';

const { data: teams } = useTeamsFull();
// Returns: Team[] (includes manager_id, created_at, updated_at)
```

#### useTeam

Fetch a single team by ID.

```typescript
import { useTeam } from '@/hooks/useTeams';

const { data: team } = useTeam(teamId);
// Returns: Team | null
```

#### useManagerTeams

Fetch teams managed by a specific manager.

```typescript
import { useManagerTeams } from '@/hooks/useTeams';

const { data: teams } = useManagerTeams(managerId);
// Returns: TeamBasic[]
```

#### useTeamMemberCounts

Get member counts for all teams.

```typescript
import { useTeamMemberCounts } from '@/hooks/useTeams';

const { data: counts } = useTeamMemberCounts();
// Returns: Map<string, number> (teamId -> count)
```

---

### Profiles

#### useProfilesBasic

Fetch all profiles with basic info.

```typescript
import { useProfilesBasic } from '@/hooks/useProfiles';

const { data: profiles } = useProfilesBasic();
// Returns: ProfileBasic[] = { id: string, name: string }[]
```

#### useProfilesFull

Fetch all profiles with complete details.

```typescript
import { useProfilesFull } from '@/hooks/useProfiles';

const { data: profiles } = useProfilesFull();
// Returns: Profile[]
```

#### useProfile

Fetch a single profile by ID.

```typescript
import { useProfile } from '@/hooks/useProfiles';

const { data: profile } = useProfile(profileId);
// Returns: Profile | null
```

#### useProfilesByIds

Fetch multiple profiles by IDs.

```typescript
import { useProfilesByIds } from '@/hooks/useProfiles';

const { data: profiles } = useProfilesByIds(['id1', 'id2']);
// Returns: Profile[]
```

#### useManagers

Fetch all users with manager role.

```typescript
import { useManagers } from '@/hooks/useProfiles';

const { data: managers } = useManagers();
// Returns: Profile[]
```

---

### Reps

#### useReps

Fetch reps with optional filtering.

```typescript
import { useReps } from '@/hooks/useReps';

const { data: reps } = useReps({ 
  teamId: 'optional-team-id',
  activeOnly: true 
});
// Returns: RepBasic[] = { id, name, team_id }[]
```

#### useRepsWithEmail

Fetch reps including email addresses.

```typescript
import { useRepsWithEmail } from '@/hooks/useReps';

const { data: reps } = useRepsWithEmail({ teamId });
// Returns: RepWithEmail[] = { id, name, team_id, email }[]
```

#### useRepCount

Get total count of reps.

```typescript
import { useRepCount } from '@/hooks/useReps';

const { data: count } = useRepCount({ activeOnly: true });
// Returns: number
```

#### useTeamReps

Fetch reps for a specific team.

```typescript
import { useTeamReps } from '@/hooks/useReps';

const { data: reps } = useTeamReps(teamId);
// Returns: RepBasic[]
```

#### useTeamRepIds

Fetch only rep IDs for a team.

```typescript
import { useTeamRepIds } from '@/hooks/useReps';

const { data: repIds } = useTeamRepIds(teamId);
// Returns: string[]
```

---

### Admin Stats

#### useAdminDashboardStats

Fetch system-wide statistics.

```typescript
import { useAdminDashboardStats } from '@/hooks/useAdminStats';

const { data: stats } = useAdminDashboardStats();
// Returns: AdminDashboardStats
```

**AdminDashboardStats Interface:**

```typescript
interface AdminDashboardStats {
  userCount: number;
  teamCount: number;
  callCount: number;
  prospectCount: number;
  repCount: number;
  managerCount: number;
  adminCount: number;
}
```

#### useProspectStats

Fetch prospect-specific statistics.

```typescript
import { useProspectStats } from '@/hooks/useAdminStats';

const { data: stats } = useProspectStats();
// Returns: ProspectStats
```

**ProspectStats Interface:**

```typescript
interface ProspectStats {
  total: number;
  active: number;
  hot: number;          // heat_score >= 7
  totalPipeline: number; // sum of potential_revenue
}
```

---

## Mutation Hooks

### Follow-Up Mutations

```typescript
import { 
  useCompleteFollowUp,
  useDismissFollowUp,
  useRestoreFollowUp,
  useDeleteFollowUp 
} from '@/hooks/useFollowUpMutations';
```

#### useCompleteFollowUp

Mark a follow-up as completed with optimistic update.

```typescript
const { mutate: complete, isPending } = useCompleteFollowUp();

complete(followUpId); // Updates status to 'completed'
```

#### useDismissFollowUp

Dismiss a follow-up with optimistic update.

```typescript
const { mutate: dismiss } = useDismissFollowUp();

dismiss(followUpId); // Updates status to 'dismissed'
```

#### useRestoreFollowUp

Restore a completed/dismissed follow-up.

```typescript
const { mutate: restore } = useRestoreFollowUp();

restore(followUpId); // Updates status to 'pending'
```

#### useDeleteFollowUp

Permanently delete a follow-up.

```typescript
const { mutate: deleteFollowUp } = useDeleteFollowUp();

deleteFollowUp(followUpId);
```

---

### Prospect Mutations

```typescript
import {
  useCreateProspect,
  useUpdateProspect,
  useDeleteProspect
} from '@/hooks/useProspectMutations';
```

#### useCreateProspect

Create a new prospect with optimistic update.

```typescript
const { mutate: create } = useCreateProspect();

create({
  prospect_name: 'Acme Corp',
  rep_id: repId,
  status: 'active',
  heat_score: 5,
  potential_revenue: 50000,
});
```

#### useUpdateProspect

Update an existing prospect.

```typescript
const { mutate: update } = useUpdateProspect();

update({
  id: prospectId,
  heat_score: 80,
  status: 'won',
});
```

#### useDeleteProspect

Delete a prospect.

```typescript
const { mutate: deleteProspect } = useDeleteProspect();

deleteProspect(prospectId);
```

---

### Stakeholder Mutations

```typescript
import {
  useCreateStakeholder,
  useUpdateStakeholder,
  useDeleteStakeholder
} from '@/hooks/useStakeholderMutations';
```

#### useCreateStakeholder

Create a new stakeholder.

```typescript
const { mutate: create } = useCreateStakeholder();

create({
  name: 'John Smith',
  job_title: 'CTO',
  email: 'john@acme.com',
  prospect_id: prospectId,
  rep_id: repId,
  influence_level: 'final_dm',
});
```

#### useUpdateStakeholder

Update an existing stakeholder.

```typescript
const { mutate: update } = useUpdateStakeholder();

update({
  id: stakeholderId,
  champion_score: 8,
});
```

---

## API Functions

### AI Call Analysis

```typescript
import { 
  analyzeCall,
  fetchAnalysis,
  getCoachingForCall 
} from '@/api/aiCallAnalysis';
```

#### analyzeCall

Submit a call transcript for AI analysis.

```typescript
const result = await analyzeCall({
  callId: 'uuid',
  transcript: 'Call transcript text...',
  callType: 'discovery',
  accountName: 'Acme Corp',
});
```

#### fetchAnalysis

Fetch existing analysis for a call.

```typescript
const analysis = await fetchAnalysis(callId);
// Returns: AICallAnalysis | null
```

---

### Account Follow-ups

```typescript
import {
  fetchAccountFollowUps,
  generateAccountFollowUps
} from '@/api/accountFollowUps';
```

#### fetchAccountFollowUps

Fetch follow-ups for a prospect.

```typescript
const followUps = await fetchAccountFollowUps(prospectId);
```

#### generateAccountFollowUps

Generate AI-suggested follow-ups.

```typescript
const result = await generateAccountFollowUps(prospectId);
```

---

### Prospects

```typescript
import {
  fetchProspects,
  fetchProspect,
  createProspect,
  updateProspect
} from '@/api/prospects';
```

---

### Stakeholders

```typescript
import {
  fetchStakeholders,
  createStakeholder,
  updateStakeholder
} from '@/api/stakeholders';
```

---

## Utility Functions

### Query Logger

```typescript
import { queryLogger } from '@/lib/queryLogger';

// Available in browser console as window.queryLogger
queryLogger.printSummary();  // Print performance summary
queryLogger.getHistory();    // Get recent query logs
queryLogger.clearHistory();  // Clear log history
```

### Route Preloader

```typescript
import { 
  preloadRoute,
  preloadRoleRoutes,
  useRoutePreload 
} from '@/lib/routePreloader';

// Preload a specific route
preloadRoute('/rep/prospects');

// Preload routes for a role
preloadRoleRoutes('manager');

// Hook for link preloading
const preloadHandlers = useRoutePreload('/admin');
<Link {...preloadHandlers} to="/admin">Admin</Link>
```

### General Utilities

```typescript
import { cn } from '@/lib/utils';

// Merge class names with tailwind-merge
const className = cn(
  'base-class',
  isActive && 'active-class',
  variant === 'primary' && 'primary-class'
);
```

---

## Query Keys Reference

Standard query keys used throughout the application:

| Key Pattern | Description |
|-------------|-------------|
| `['teams']` | All teams (basic) |
| `['teams-full']` | All teams (full details) |
| `['team', id]` | Single team |
| `['manager-teams', managerId]` | Teams by manager |
| `['profiles']` | All profiles (basic) |
| `['profiles-full']` | All profiles (full) |
| `['profile', id]` | Single profile |
| `['reps', options]` | Reps with filters |
| `['team-reps', teamId]` | Reps by team |
| `['admin-dashboard-stats']` | Admin statistics |
| `['prospect-stats']` | Prospect statistics |
| `['prospects', repId]` | Prospects by rep |
| `['prospect', id]` | Single prospect |
| `['follow-ups', prospectId]` | Follow-ups by prospect |
| `['stakeholders', prospectId]` | Stakeholders by prospect |
| `['call-analysis', callId]` | Call analysis |

---

## Error Handling

All hooks follow a consistent error pattern:

```typescript
const { data, error, isError, isLoading } = useQuery(...);

if (isError) {
  console.error('Query failed:', error);
}
```

Mutations include error handling with toast notifications:

```typescript
const { mutate } = useMutation({
  onError: (error) => {
    toast.error(`Failed: ${error.message}`);
  },
});
```
