# Development Guide

This guide covers development setup, conventions, and best practices.

## Table of Contents

- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Code Conventions](#code-conventions)
- [Data Fetching with React Query](#data-fetching-with-react-query)
- [Testing](#testing)
- [Performance](#performance)
- [Debugging](#debugging)
- [Deployment](#deployment)

---

## Getting Started

### Prerequisites

- Node.js 18+ (recommend using [nvm](https://github.com/nvm-sh/nvm))
- npm or pnpm

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd sales-performance-tracker

# Install dependencies
npm install

# Start development server
npm run dev
```

### Environment Setup

The project uses Lovable Cloud (Supabase) for backend services. Environment variables are automatically configured.

For local development with custom Supabase:

```bash
# .env.local (optional - for custom backend)
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_anon_key
```

---

## Development Workflow

### Available Scripts

```bash
# Development
npm run dev          # Start dev server on port 8080
npm run build        # Production build
npm run preview      # Preview production build

# Testing
npm run test         # Run unit tests
npm run test:watch   # Run tests in watch mode
npm run test:e2e     # Run E2E tests (Playwright)

# Code Quality
npm run lint         # Run ESLint
npm run format       # Format with Prettier

# Analysis
npm run build -- --mode analyze  # Bundle analysis
```

### Project Structure

```
src/
├── api/          # API layer (Supabase queries)
├── components/   # React components
│   ├── ui/       # Base UI components
│   └── ...       # Feature components
├── contexts/     # React contexts
├── hooks/        # Custom hooks
├── lib/          # Utilities
├── pages/        # Page components
└── types/        # TypeScript types

e2e/              # E2E tests
docs/             # Documentation
supabase/
└── functions/    # Edge functions
```

### Git Workflow

1. Create feature branch from `main`
2. Make changes with atomic commits
3. Push and create PR
4. Lovable syncs changes automatically

```bash
git checkout -b feature/my-feature
git commit -m "feat: add new feature"
git push origin feature/my-feature
```

---

## Data Fetching with React Query

**CRITICAL RULE**: All server data fetching MUST use React Query. No manual `useState`/`useEffect` patterns.

See **[React Query Patterns & Guidelines](./REACT_QUERY_PATTERNS.md)** for comprehensive documentation including:
- Query key factory pattern
- `staleTime` guidelines
- Mutation patterns with optimistic updates
- Cache invalidation strategies
- Ready-to-use templates

### Quick Example

```typescript
// ❌ WRONG - Don't do this
const [data, setData] = useState([]);
useEffect(() => {
  fetchData().then(setData);
}, []);

// ✅ CORRECT - Use React Query
const { data } = useQuery({
  queryKey: featureKeys.list(),
  queryFn: fetchData,
  staleTime: 2 * 60 * 1000,
});
```

---

## Code Conventions

### File Naming

```
components/MyComponent.tsx      # PascalCase for components
hooks/useMyHook.ts              # camelCase with 'use' prefix
api/myApi.ts                    # camelCase for modules
types/database.ts               # camelCase for type files
pages/rep/RepDashboard.tsx      # PascalCase for pages
```

### Component Structure

```tsx
// 1. Imports (external, then internal, then types)
import React from 'react';
import { useQuery } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';

import type { Prospect } from '@/types/database';

// 2. Types/Interfaces
interface Props {
  prospect: Prospect;
  onEdit: () => void;
}

// 3. Component
export function ProspectCard({ prospect, onEdit }: Props) {
  // Hooks first
  const { role } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  // Handlers
  const handleClick = () => {
    setIsOpen(true);
  };

  // Render
  return (
    <Card>
      {/* ... */}
    </Card>
  );
}
```

### Hook Conventions

```tsx
// Custom hook pattern
export function useMyData(id: string) {
  return useQuery({
    queryKey: ['my-data', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('my_table')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
}
```

### Styling Conventions

```tsx
// ✅ Use design system tokens
<div className="bg-background text-foreground">
  <h1 className="text-2xl font-bold text-primary">Title</h1>
  <p className="text-muted-foreground">Description</p>
</div>

// ✅ Use cn() for conditional classes
<Button className={cn(
  'base-class',
  isActive && 'active-class',
  variant === 'large' && 'text-lg'
)}>

// ❌ Avoid inline styles
<div style={{ backgroundColor: 'white' }}>

// ❌ Avoid hardcoded colors
<div className="bg-white text-black">
```

### TypeScript Guidelines

```typescript
// ✅ Use interfaces for objects
interface User {
  id: string;
  name: string;
}

// ✅ Use type for unions/intersections
type Status = 'active' | 'pending' | 'completed';
type UserWithRole = User & { role: string };

// ✅ Prefer explicit return types for public APIs
export function useUsers(): UseQueryResult<User[]> {
  // ...
}

// ✅ Use satisfies for type checking with inference
const config = {
  timeout: 5000,
  retries: 3,
} satisfies Config;
```

---

## Testing

### Unit Tests (Vitest)

```tsx
// src/hooks/__tests__/useMyHook.test.ts
import { describe, it, expect, vi } from 'vitest';
import { renderHookWithClient } from '@/test/test-utils';
import { useMyHook } from '../useMyHook';

describe('useMyHook', () => {
  it('should return data', async () => {
    const { result } = renderHookWithClient(() => useMyHook('id'));
    
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    
    expect(result.current.data).toBeDefined();
  });
});
```

### E2E Tests (Playwright)

```typescript
// e2e/my-feature.spec.ts
import { test, expect } from '@playwright/test';

test('user can complete action', async ({ page }) => {
  await page.goto('/');
  await page.click('button[data-testid="action"]');
  await expect(page.locator('.result')).toBeVisible();
});
```

### Visual Regression Tests

```typescript
// e2e/visual/my-page.spec.ts
import { test, expect } from '@playwright/test';

test('page matches snapshot', async ({ page }) => {
  await page.goto('/my-page');
  await expect(page).toHaveScreenshot('my-page.png');
});
```

### Running Tests

```bash
# Unit tests
npm run test                    # Run once
npm run test -- --watch         # Watch mode
npm run test -- --coverage      # With coverage

# E2E tests
npx playwright install          # First time setup
npx playwright test             # Run all E2E
npx playwright test --ui        # Interactive mode
npx playwright test --update-snapshots  # Update visual baselines
```

---

## Performance

### Bundle Analysis

```bash
# Generate bundle analysis report
npm run build -- --mode analyze

# Opens dist/stats.html with interactive treemap
```

### Code Splitting

Routes are automatically code-split:

```tsx
// Lazy load pages
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));

// Use in routes with Suspense
<Suspense fallback={<PageLoader />}>
  <AdminDashboard />
</Suspense>
```

### Route Preloading

```tsx
import { PreloadLink } from '@/components/PreloadLink';

// Preloads on hover/focus
<PreloadLink to="/dashboard">Dashboard</PreloadLink>
```

### Query Optimization

```tsx
// Enable stale-while-revalidate
const { data } = useQuery({
  queryKey: ['data'],
  queryFn: fetchData,
  staleTime: 5 * 60 * 1000, // Consider fresh for 5 minutes
});

// Prefetch data
queryClient.prefetchQuery({
  queryKey: ['user', userId],
  queryFn: () => fetchUser(userId),
});
```

### Image Optimization

```tsx
// Use lazy loading for images
<img 
  src={imageUrl} 
  loading="lazy"
  decoding="async"
  alt="Description"
/>
```

---

## Debugging

### React Query DevTools

Open DevTools panel (bottom-left button in development):
- View all queries and their states
- Inspect cache contents
- Manually invalidate queries
- Time-travel through query states

### Query Logger

```javascript
// In browser console
window.queryLogger.printSummary()  // Performance summary
window.queryLogger.getHistory()    // Recent query logs
window.queryLogger.clearHistory()  // Clear logs
```

### Console Logging

Query events are logged in development with:
- Query start/success/error
- Mutation events
- Duration tracking
- Colored output for easy scanning

### Network Debugging

1. Open browser DevTools → Network tab
2. Filter by `supabase` to see API calls
3. Check request/response payloads

### Common Issues

**Query not updating:**
```tsx
// Ensure proper query invalidation
queryClient.invalidateQueries({ queryKey: ['my-data'] });
```

**Optimistic update rollback:**
```tsx
// Check onError handler
onError: (err, variables, context) => {
  // Rollback to previous state
  queryClient.setQueryData(['key'], context.previousData);
}
```

**Auth issues:**
```tsx
// Check session in AuthContext
const { session, user } = useAuth();
console.log('Session:', session);
console.log('User:', user);
```

---

## Deployment

### Lovable Deployment

1. Open Lovable project
2. Click **Share** → **Publish**
3. Frontend deploys to Lovable CDN
4. Edge functions deploy automatically

### Custom Domain

1. Go to Project → Settings → Domains
2. Click "Connect Domain"
3. Follow DNS configuration instructions

### Environment Variables

Backend secrets are managed in Lovable Cloud:
- Navigate to Cloud → Secrets
- Add/update secret values
- Secrets are available in edge functions

### Database Migrations

Migrations run automatically when applied in Lovable:
1. AI generates migration SQL
2. User approves migration
3. Migration executes on database
4. Types regenerate automatically

---

## Best Practices

### Do's

- ✅ Use React Query for all server state
- ✅ Implement optimistic updates for mutations
- ✅ Use TypeScript strictly (no `any`)
- ✅ Follow component composition patterns
- ✅ Write meaningful test descriptions
- ✅ Use semantic design tokens
- ✅ Handle loading and error states

### Don'ts

- ❌ Don't use `useEffect` for data fetching
- ❌ Don't store server state in `useState`
- ❌ Don't use hardcoded colors
- ❌ Don't skip error handling
- ❌ Don't create large monolithic components
- ❌ Don't ignore TypeScript errors

### Code Review Checklist

- [ ] Types are properly defined
- [ ] **All data fetching uses React Query** (no manual `useState`/`useEffect`)
- [ ] **Query keys use factory pattern** for consistency
- [ ] **Appropriate `staleTime` set** based on data volatility (see [patterns doc](./REACT_QUERY_PATTERNS.md))
- [ ] **`enabled` flag used** for conditional queries
- [ ] Loading/error states handled
- [ ] Queries use appropriate cache settings
- [ ] **Mutations include cache invalidation** for related queries
- [ ] Mutations include optimistic updates where beneficial
- [ ] Components are reasonably sized
- [ ] Design tokens used for styling
- [ ] Tests cover critical paths
- [ ] No console.log statements left in code
