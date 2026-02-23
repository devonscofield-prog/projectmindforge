# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Sales performance management platform (Project Mindforge) with role-based dashboards, AI call analysis, coaching, and task management. Built with React 18 + TypeScript on Vite, backed by Supabase (PostgreSQL, Auth, Edge Functions). Originally scaffolded via Lovable.

## Commands

```bash
npm run dev              # Dev server on port 8080
npm run build            # Production build
npm run build:dev        # Development build
npm run lint             # ESLint (flat config)
npm run preview          # Preview production build locally

# Testing
npx vitest run                                                # Unit tests (one-shot)
npx vitest run src/components/ui/heat-score-badge.test.tsx     # Single test file
npx vitest --watch                                            # Watch mode
npx vitest run --coverage                                     # With coverage report
npx playwright test                                           # E2E tests (requires `npx playwright install` first)
npx playwright test e2e/auth.spec.ts                          # Single E2E spec
npx playwright test --ui                                      # Interactive E2E mode

# Analysis
npm run build -- --mode analyze   # Bundle treemap → dist/stats.html
```

Note: `package.json` does not define `test` or `format` scripts. Use `npx vitest` and `npx prettier --write .` directly.

## Architecture

### Tech Stack
- **Frontend**: React 18, TypeScript (strict mode), Vite, Tailwind CSS, shadcn/ui (Radix primitives, `default` style, `slate` base color)
- **Backend**: Supabase — PostgreSQL with RLS, Auth (email/password + MFA), Deno Edge Functions
- **State**: TanStack React Query v5 (all server state), React Context (auth/theme only)
- **Forms**: react-hook-form + zod validation
- **Charts**: Recharts
- **Routing**: react-router-dom v6
- **Toasts**: Sonner (`toast()` from `sonner`)
- **DnD**: @dnd-kit

### Path Alias
`@/*` maps to `./src/*` (configured in tsconfig and vite).

### Role System
Five roles: `rep`, `manager`, `admin`, `sdr`, `sdr_manager`. Routes are protected by `<ProtectedRoute allowedRoles={[...]}>`. RLS policies enforce data access at the database level (reps see own data, managers see team data, admins see all). Role-aware URL helpers live in `src/lib/routes.ts`.

### Data Flow — Strict React Query
All server data fetching **must** use React Query. No `useState`/`useEffect` for server data.

- Query keys use the **factory pattern** (see `src/hooks/` for examples like `prospectKeys`, `callDetailKeys`)
- Global defaults (`src/lib/queryClientConfig.ts`): `staleTime: 30s`, `gcTime: 5min`, `retry: 1`, `refetchOnWindowFocus: false`, `refetchOnMount: false`, `refetchOnReconnect: false`
- Mutations: `retry: 0`, should invalidate related query keys and use optimistic updates where beneficial
- Toast feedback via Sonner on mutation success/error
- Performance logging: queries >500ms are tracked; dev mode logs all query/mutation events to console

### API Layer
`src/api/` contains Supabase query functions organized by domain. Hooks in `src/hooks/` wrap these with React Query. The pattern is:
1. API function in `src/api/featureName.ts` — raw Supabase queries
2. Hook in `src/hooks/useFeatureQueries.ts` — React Query wrapper with key factory
3. Component consumes the hook

### Supabase Integration
- Client: `src/integrations/supabase/client.ts` (auto-generated)
- Types: `src/integrations/supabase/types.ts` (auto-generated from DB schema)
- Edge Functions: `supabase/functions/` (55+ Deno functions), shared utils in `supabase/functions/_shared/`
- Migrations: `supabase/migrations/` (150+ SQL files)

### Component Organization
- `src/components/ui/` — shadcn/ui base components (add new ones via `npx shadcn-ui@latest add <component>`)
- `src/components/{feature}/` — feature components (admin, calls, coaching, prospects, tasks, notifications, sdr, etc.)
- `src/pages/{role}/` — page components grouped by role (rep, manager, admin, sdr, sdr-manager)
- Custom branded components: `branded-loader`, `heat-score-badge`, `coach-grade-badge`, `status-badge`, `kpi-card`, `empty-state`

### Error Handling
Three-tier error boundary hierarchy: `App ErrorBoundary` → `QueryErrorBoundary` (per feature) → `ComponentErrorBoundary` (per component).

### Code Splitting
All pages are lazy-loaded via `React.lazy()`. Vendor chunks are manually split in `vite.config.ts` (react, ui, query, charts, forms, date, supabase, icons).

## Key Conventions

- **Styling**: Tailwind with design system tokens (HSL CSS variables). Use `cn()` from `@/lib/utils` for conditional classes. No hardcoded colors — use semantic tokens like `bg-background`, `text-foreground`, `text-muted-foreground`.
- **Icons**: `lucide-react` exclusively.
- **Formatting**: Prettier with single quotes, semicolons, 100-char width, 2-space indent, trailing commas (es5), Tailwind class sorting plugin.
- **Components**: Named exports (not default). PascalCase filenames. Hooks use `use` prefix, camelCase filenames.
- **TypeScript**: Strict mode (`tsconfig.app.json`). Interfaces for objects, type aliases for unions. `@typescript-eslint/no-explicit-any` is a warning. Unused vars prefixed with `_` are allowed.
- **Logging**: Use `createLogger(moduleName)` from `@/lib/logger` for structured logging, not raw `console.log`.
- **Sanitization**: HTML content sanitized with DOMPurify (`@/lib/sanitize`).

## Testing

- **Unit/Component**: Vitest + React Testing Library + jsdom. Tests co-located or in `__tests__/` dirs. Setup file: `src/test/setup.ts`. Test helpers: `renderHookWithClient()` and `createTestQueryClient()` in `src/test/test-utils.tsx`. Supabase mock in `src/test/mocks/supabase.ts`.
- **E2E**: Playwright across Chromium, Firefox, WebKit, and mobile Chrome (Pixel 5). Config auto-starts dev server on port 8080. RLS security tests in `e2e/` (e.g., `admin.rls.spec.ts`, `rep.rls.spec.ts`). Page objects in `e2e/fixtures/`.
- **Edge function tests**: Also run via Vitest — pattern `supabase/functions/**/__tests__/*.test.ts`.

## Documentation

See `docs/` for detailed guides:
- `ARCHITECTURE.md` — system diagrams and data flow
- `DEVELOPMENT.md` — setup, scripts, conventions
- `REACT_QUERY_PATTERNS.md` — query key factories, staleTime guidelines, mutation templates
- `API.md` — hook and mutation reference
- `COMPONENTS.md` — UI component usage
