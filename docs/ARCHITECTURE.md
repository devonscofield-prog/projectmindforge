# Architecture Overview

This document provides a comprehensive overview of the Sales Performance Tracker architecture.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (React)                         │
├─────────────────────────────────────────────────────────────────┤
│  Pages          │  Components      │  Hooks           │  Utils  │
│  ─────────      │  ──────────      │  ─────           │  ─────  │
│  Auth           │  UI (shadcn)     │  useAuth         │  cn()   │
│  Rep/*          │  Layout          │  useTeams        │  query  │
│  Manager/*      │  Forms           │  useReps         │  logger │
│  Admin/*        │  Coaching        │  useProfiles     │         │
│  Calls/*        │  Prospects       │  useMutations    │         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Supabase Client
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Lovable Cloud (Supabase)                     │
├─────────────────────────────────────────────────────────────────┤
│  Auth            │  Database        │  Edge Functions           │
│  ────            │  ────────        │  ──────────────           │
│  Email/Password  │  PostgreSQL      │  analyze-call             │
│  Session Mgmt    │  RLS Policies    │  sales-coach-chat         │
│  User Roles      │  Triggers        │  admin-transcript-chat    │
│                  │  Views           │  generate-coaching-trends │
└─────────────────────────────────────────────────────────────────┘
```

## Directory Structure

```
src/
├── api/                    # API layer - Supabase queries & mutations
│   ├── accountFollowUps.ts
│   ├── aiCallAnalysis/     # AI analysis module
│   ├── prospects.ts
│   ├── salesCoach.ts
│   └── stakeholders.ts
│
├── components/             # React components
│   ├── ui/                 # Base UI components (shadcn)
│   ├── admin/              # Admin-specific components
│   ├── calls/              # Call-related components
│   ├── coaching/           # Coaching components
│   ├── dashboard/          # Dashboard widgets
│   ├── forms/              # Form components
│   ├── layout/             # Layout components
│   └── prospects/          # Prospect management
│
├── contexts/               # React contexts
│   └── AuthContext.tsx     # Authentication state
│
├── hooks/                  # Custom React hooks
│   ├── useTeams.ts
│   ├── useReps.ts
│   ├── useProfiles.ts
│   ├── useFollowUpMutations.ts
│   └── ...
│
├── lib/                    # Utility libraries
│   ├── utils.ts            # General utilities
│   ├── queryClientConfig.ts # React Query setup
│   ├── queryLogger.ts      # Query debugging
│   └── routePreloader.ts   # Route prefetching
│
├── pages/                  # Page components
│   ├── auth/               # Authentication pages
│   ├── rep/                # Rep role pages
│   ├── manager/            # Manager role pages
│   ├── admin/              # Admin role pages
│   └── calls/              # Shared call pages
│
├── integrations/           # External integrations
│   └── supabase/
│       ├── client.ts       # Supabase client (auto-generated)
│       └── types.ts        # Database types (auto-generated)
│
└── types/                  # TypeScript type definitions
    └── database.ts
```

## Data Flow

### Authentication Flow

```
User Login
    │
    ▼
┌──────────────┐    ┌─────────────────┐    ┌──────────────┐
│ Auth Page    │───▶│ AuthContext     │───▶│ Supabase     │
│              │    │ signIn()        │    │ Auth         │
└──────────────┘    └─────────────────┘    └──────────────┘
                            │
                            ▼
                    ┌─────────────────┐
                    │ Fetch Profile   │
                    │ & Role          │
                    └─────────────────┘
                            │
                            ▼
                    ┌─────────────────┐
                    │ Preload Routes  │
                    │ for Role        │
                    └─────────────────┘
                            │
                            ▼
                    ┌─────────────────┐
                    │ Redirect to     │
                    │ Role Dashboard  │
                    └─────────────────┘
```

### Data Fetching Flow

```
Component Mount
    │
    ▼
┌──────────────┐    ┌─────────────────┐    ┌──────────────┐
│ useQuery     │───▶│ Query Client    │───▶│ Supabase     │
│ Hook         │    │ with Logging    │    │ Client       │
└──────────────┘    └─────────────────┘    └──────────────┘
                            │
                            ▼
                    ┌─────────────────┐
                    │ Cache Response  │
                    │ Log Performance │
                    └─────────────────┘
                            │
                            ▼
                    ┌─────────────────┐
                    │ Render with     │
                    │ Data            │
                    └─────────────────┘
```

### Mutation Flow (Optimistic Updates)

```
User Action (e.g., Complete Follow-up)
    │
    ▼
┌──────────────┐    ┌─────────────────┐
│ useMutation  │───▶│ onMutate:       │
│ Hook         │    │ Optimistic      │
└──────────────┘    │ Update Cache    │
                    └─────────────────┘
                            │
                    ┌───────┴───────┐
                    ▼               ▼
            ┌──────────────┐ ┌──────────────┐
            │ Success:     │ │ Error:       │
            │ Invalidate   │ │ Rollback     │
            │ Queries      │ │ Cache        │
            └──────────────┘ └──────────────┘
```

## Role-Based Access Control

### Roles

| Role    | Dashboard | Team Data | All Data | Admin Functions |
|---------|-----------|-----------|----------|-----------------|
| Rep     | ✓         | ✗         | ✗        | ✗               |
| Manager | ✓         | ✓         | ✗        | ✗               |
| Admin   | ✓         | ✓         | ✓        | ✓               |

### Route Protection

Routes are protected using the `ProtectedRoute` component:

```tsx
<Route path="/admin" element={
  <ProtectedRoute allowedRoles={['admin']}>
    <AdminDashboard />
  </ProtectedRoute>
} />
```

### Database RLS

Row-Level Security policies enforce access at the database level:

```sql
-- Example: Reps can only see their own data
CREATE POLICY "Reps can view own data"
ON prospects FOR SELECT
USING (rep_id = auth.uid());

-- Managers can see their team's data
CREATE POLICY "Managers can view team data"
ON prospects FOR SELECT
USING (
  has_role(auth.uid(), 'manager') AND
  is_manager_of_user(auth.uid(), rep_id)
);
```

## State Management

### React Query

All server state is managed through React Query:

- **Queries**: Fetch data with caching, stale-while-revalidate
- **Mutations**: Update data with optimistic updates
- **Query Keys**: Hierarchical keys for targeted invalidation

```typescript
// Query key examples
['teams']                    // All teams
['team', teamId]             // Specific team
['reps', { teamId }]         // Reps filtered by team
['prospect', prospectId]     // Specific prospect
```

### Context

Local/global UI state uses React Context:

- `AuthContext`: User session, profile, role
- `ThemeProvider`: Dark/light theme

## Performance Optimizations

### Code Splitting

- **Route-based**: Each page lazy-loaded with `React.lazy()`
- **Vendor chunks**: Libraries split into cacheable chunks
- **Component chunks**: Heavy components loaded on demand

### Bundle Configuration

```javascript
manualChunks: {
  'vendor-react': ['react', 'react-dom', 'react-router-dom'],
  'vendor-ui': ['@radix-ui/*'],
  'vendor-query': ['@tanstack/react-query'],
  'vendor-charts': ['recharts'],
  // ...
}
```

### Route Preloading

Routes preload on hover/focus and after authentication:

```typescript
// Preload on hover
<PreloadLink to="/rep/prospects">Prospects</PreloadLink>

// Preload by role after login
preloadRoleRoutes('manager'); // Preloads manager routes
```

## Error Handling

### Error Boundaries

```
┌─────────────────────────────────────────┐
│ App ErrorBoundary (Global)              │
│  ┌───────────────────────────────────┐  │
│  │ QueryErrorBoundary (Per Feature)  │  │
│  │  ┌─────────────────────────────┐  │  │
│  │  │ ComponentErrorBoundary      │  │  │
│  │  │ (Per Component)             │  │  │
│  │  └─────────────────────────────┘  │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

### Query Error Handling

```typescript
const { data, error, isError } = useQuery({
  queryKey: ['data'],
  queryFn: fetchData,
  retry: 1, // Retry once on failure
});
```

## Testing Strategy

### Unit Tests (Vitest)

- Hook tests with mock Supabase client
- Component tests with React Testing Library
- Utility function tests

### E2E Tests (Playwright)

- Authentication flows
- Critical user journeys
- Visual regression tests

### Test Structure

```
src/
├── hooks/__tests__/        # Hook unit tests
├── test/
│   ├── setup.ts            # Test setup
│   ├── test-utils.tsx      # Test utilities
│   └── mocks/              # Mock implementations
│
e2e/
├── fixtures/               # Page objects
├── visual/                 # Visual regression
├── auth.spec.ts            # Auth tests
├── navigation.spec.ts      # Navigation tests
└── call-submission.spec.ts # Feature tests
```

## Edge Functions

### Available Functions

| Function | Purpose | Trigger |
|----------|---------|---------|
| `analyze-call` | AI call analysis | On transcript submit |
| `sales-coach-chat` | AI sales coaching | Chat interaction |
| `admin-transcript-chat` | Bulk transcript analysis | Admin query |
| `generate-coaching-trends` | Coaching trend analysis | Scheduled/Manual |
| `generate-account-follow-ups` | AI follow-up suggestions | Account analysis |
| `chunk-transcripts` | Prepare transcripts for RAG | Pre-indexing |
| `seed-demo-data` | Populate demo data | Manual |

### Function Architecture

```
HTTP Request
    │
    ▼
┌──────────────┐    ┌─────────────────┐    ┌──────────────┐
│ Edge         │───▶│ Supabase        │───▶│ Lovable AI   │
│ Function     │    │ Service Client  │    │ (Optional)   │
└──────────────┘    └─────────────────┘    └──────────────┘
    │
    ▼
┌──────────────┐
│ Response     │
│ to Client    │
└──────────────┘
```

## Security Considerations

1. **Authentication**: All routes require authentication except `/auth`
2. **Authorization**: RLS policies enforce data access at database level
3. **Input Validation**: Zod schemas validate all form inputs
4. **XSS Prevention**: React's built-in escaping + CSP headers
5. **CSRF Protection**: Supabase handles CSRF for auth endpoints
6. **Secrets Management**: Environment variables for sensitive data
