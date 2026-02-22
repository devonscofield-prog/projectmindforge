# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Sales performance management platform (Project Mindforge) with role-based dashboards, AI call analysis, coaching, and task management. Built with React 18 + TypeScript on Vite, backed by Supabase (PostgreSQL, Auth, Edge Functions).

## Commands

```bash
npm run dev              # Dev server on port 8080
npm run build            # Production build
npm run build:dev        # Development build
npm run lint             # ESLint

# Testing
npx vitest run           # Unit tests (one-shot)
npx vitest run src/components/ui/heat-score-badge.test.tsx  # Single test file
npx vitest --watch       # Watch mode
npx playwright test      # E2E tests (requires `npx playwright install` first)

# Analysis
npm run build -- --mode analyze   # Bundle treemap → dist/stats.html
```

## Architecture

### Tech Stack
- **Frontend**: React 18, TypeScript (strict), Vite, Tailwind CSS, shadcn/ui (Radix primitives)
- **Backend**: Supabase — PostgreSQL with RLS, Auth (email/password + MFA), Deno Edge Functions
- **State**: TanStack React Query v5 (all server state), React Context (auth/theme only)
- **Forms**: react-hook-form + zod validation
- **Charts**: Recharts
- **Toasts**: Sonner (`toast()` from `sonner`)

### Path Alias
`@/*` maps to `./src/*` (configured in tsconfig and vite).

### Role System
Five roles: `rep`, `manager`, `admin`, `sdr`, `sdr_manager`. Routes are protected by `<ProtectedRoute allowedRoles={[...]}>`. RLS policies enforce data access at the database level (reps see own data, managers see team data, admins see all).

### Data Flow — Strict React Query
All server data fetching **must** use React Query. No `useState`/`useEffect` for server data.

- Query keys use the **factory pattern** (see `src/hooks/` for examples like `prospectKeys`, `callDetailKeys`)
- Global config: `staleTime: 30s`, `gcTime: 5min`, `refetchOnWindowFocus: false` (see `src/lib/queryClientConfig.ts`)
- Mutations should invalidate related query keys and use optimistic updates where beneficial
- Toast feedback via Sonner on mutation success/error

### API Layer
`src/api/` contains Supabase query functions organized by domain (prospects, calls, coaching, tasks, etc.). Hooks in `src/hooks/` wrap these with React Query. The pattern is:
1. API function in `src/api/featureName.ts` — raw Supabase queries
2. Hook in `src/hooks/useFeatureQueries.ts` — React Query wrapper with key factory
3. Component consumes the hook

### Supabase Integration
- Client: `src/integrations/supabase/client.ts` (auto-generated)
- Types: `src/integrations/supabase/types.ts` (auto-generated from DB schema)
- Edge Functions: `supabase/functions/` (55+ Deno functions), shared utils in `supabase/functions/_shared/`
- Migrations: `supabase/migrations/` (150+ SQL files)

### Component Organization
- `src/components/ui/` — shadcn/ui base components
- `src/components/{feature}/` — feature components (admin, calls, coaching, prospects, tasks, notifications, sdr, etc.)
- `src/pages/{role}/` — page components grouped by role (rep, manager, admin, sdr)
- Custom branded components: `branded-loader`, `heat-score-badge`, `coach-grade-badge`, `status-badge`, `kpi-card`, `empty-state`

### Error Handling
Three-tier error boundary hierarchy: `App ErrorBoundary` → `QueryErrorBoundary` (per feature) → `ComponentErrorBoundary` (per component).

### Code Splitting
All pages are lazy-loaded via `React.lazy()`. Vendor chunks are manually split in `vite.config.ts` (react, ui, query, charts, forms, date, supabase, icons).

## Key Conventions

- **Styling**: Tailwind with design system tokens (HSL CSS variables). Use `cn()` from `@/lib/utils` for conditional classes. No hardcoded colors — use semantic tokens like `bg-background`, `text-foreground`, `text-muted-foreground`.
- **Icons**: `lucide-react` exclusively.
- **Formatting**: Prettier with single quotes, semicolons, 100-char width, 2-space indent, Tailwind class sorting.
- **Components**: Named exports (not default). PascalCase filenames. Hooks use `use` prefix, camelCase.
- **TypeScript**: Strict mode. Interfaces for objects, type aliases for unions. `@typescript-eslint/no-explicit-any` is a warning.
- **Logging**: Use `createLogger(moduleName)` from `@/lib/logger` for structured logging, not raw `console.log`.
- **Sanitization**: HTML content sanitized with DOMPurify (`@/lib/sanitize`).

## Testing

- **Unit/Component**: Vitest + React Testing Library + jsdom. Tests co-located or in `__tests__/` dirs. Test utils in `src/test/test-utils.tsx`, Supabase mock in `src/test/mocks/supabase.ts`.
- **E2E**: Playwright across Chromium, Firefox, WebKit, and mobile Chrome (Pixel 5). RLS security tests in `e2e/`.
- **Edge function tests**: Also run via Vitest — pattern `supabase/functions/**/__tests__/*.test.ts`.

## Documentation

See `docs/` for detailed guides:
- `ARCHITECTURE.md` — system diagrams and data flow
- `DEVELOPMENT.md` — setup, scripts, conventions
- `REACT_QUERY_PATTERNS.md` — query key factories, staleTime guidelines, mutation templates
- `API.md` — hook and mutation reference
- `COMPONENTS.md` — UI component usage
