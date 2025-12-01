# React Query Patterns & Guidelines

**Status**: Required for all new data fetching implementations  
**Last Updated**: 2024

This document establishes the standard patterns for data fetching using React Query across the application. **All data fetching MUST use React Query** - no direct `useState`/`useEffect` patterns for server data.

---

## Table of Contents

- [Why React Query](#why-react-query)
- [Query Key Factory Pattern](#query-key-factory-pattern)
- [staleTime Guidelines](#staletime-guidelines)
- [When to Create Dedicated Hook Files](#when-to-create-dedicated-hook-files)
- [Standard Hook Patterns](#standard-hook-patterns)
- [Mutation Patterns](#mutation-patterns)
- [Cache Invalidation](#cache-invalidation)
- [Polling Pattern](#polling-pattern)
- [Dependent Queries](#dependent-queries)
- [Error Handling](#error-handling)
- [Quick Reference Templates](#quick-reference-templates)

---

## Why React Query

React Query provides:
- **Automatic caching** - No duplicate requests
- **Background refetching** - Fresh data without user intervention
- **Optimistic updates** - Instant UI feedback
- **DevTools integration** - Debugging queries in development
- **Error boundaries** - Integrated error handling
- **Consistent patterns** - Predictable data flow

**Rule**: If you're fetching data from the server, use React Query. Period.

---

## Query Key Factory Pattern

Query keys must be organized using the factory pattern for consistency and easy invalidation.

### Standard Structure

```typescript
// src/hooks/use[Feature]Queries.ts

export const featureKeys = {
  all: ['feature-name'] as const,
  lists: () => [...featureKeys.all, 'list'] as const,
  list: (filters: string) => [...featureKeys.lists(), filters] as const,
  details: () => [...featureKeys.all, 'detail'] as const,
  detail: (id: string) => [...featureKeys.details(), id] as const,
  related: (id: string, relationType: string) => 
    [...featureKeys.detail(id), 'related', relationType] as const,
};
```

### Real Examples

```typescript
// Call detail queries
export const callDetailKeys = {
  all: ['call-detail'] as const,
  call: (id: string) => [...callDetailKeys.all, 'call', id] as const,
  analysis: (id: string) => [...callDetailKeys.all, 'analysis', id] as const,
  products: (id: string) => [...callDetailKeys.all, 'products', id] as const,
};

// Prospect queries
export const prospectKeys = {
  all: ['prospects'] as const,
  lists: () => [...prospectKeys.all, 'list'] as const,
  list: (repId: string) => [...prospectKeys.lists(), repId] as const,
  details: () => [...prospectKeys.all, 'detail'] as const,
  detail: (id: string) => [...prospectKeys.details(), id] as const,
  followUps: (id: string) => [...prospectKeys.detail(id), 'follow-ups'] as const,
};
```

### Benefits

- Easy to invalidate all related queries: `queryClient.invalidateQueries({ queryKey: featureKeys.all })`
- Easy to find all queries for a feature
- Type-safe query keys
- Prevents typos and inconsistencies

---

## staleTime Guidelines

`staleTime` determines how long data is considered fresh before refetching.

### Reference Table

| Data Type | staleTime | Example | Rationale |
|-----------|-----------|---------|-----------|
| Real-time data | `0` | Live dashboards, polling | Must always be fresh |
| User input data | `30s - 1min` | Call details, form data | Needs to be fresh for active editing |
| Session data | `1-2 min` | User profile, settings | Changes moderately during session |
| Reference data | `5 min` | Products list, teams list | Rarely changes, safe to cache |
| Static lookups | `1 hour` | Call types, status options | Almost never changes |

### Implementation Examples

```typescript
// Real-time polling (always fresh)
useQuery({
  queryKey: ['live-metrics'],
  queryFn: fetchMetrics,
  staleTime: 0,
  refetchInterval: 2000,
});

// Active user data (30 seconds)
useQuery({
  queryKey: callDetailKeys.call(id),
  queryFn: () => getCallWithAnalysis(id),
  staleTime: 30 * 1000,
});

// Reference data (5 minutes)
useQuery({
  queryKey: ['products'],
  queryFn: fetchProducts,
  staleTime: 5 * 60 * 1000,
});
```

---

## When to Create Dedicated Hook Files

### Create `use[Feature]Queries.ts` when:

✅ **Multiple related queries** for a feature  
✅ **Queries reused** across multiple components  
✅ **Complex mutations** with cache invalidation  
✅ **Query key factory** would benefit organization  

**Example**: `useCallDetailQueries.ts` with `useCallWithAnalysis`, `useAnalysisPolling`, `useCallProducts`

### Use inline `useQuery` when:

✅ **Simple, one-off query** in a single component  
✅ **Highly specific** to one view  
✅ **Unlikely to be reused**  

**Example**: Trend chart that's only shown in one dashboard component

---

## Standard Hook Patterns

### Basic Query Hook

```typescript
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useFeatureData(id: string | undefined) {
  return useQuery({
    queryKey: featureKeys.detail(id || ''),
    queryFn: async () => {
      if (!id) throw new Error('ID is required');
      
      const { data, error } = await supabase
        .from('feature_table')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!id, // Only run when ID exists
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}
```

### Dependent Query Hook

```typescript
export function useRelatedData(
  parentId: string | undefined, 
  shouldFetch: boolean
) {
  return useQuery({
    queryKey: featureKeys.related(parentId || '', 'type'),
    queryFn: async () => {
      if (!parentId) return [];
      // Fetch logic
    },
    enabled: !!parentId && shouldFetch, // Multiple conditions
    staleTime: 2 * 60 * 1000,
  });
}
```

### Polling Query Hook

```typescript
export function useRealtimeData(id: string | undefined, shouldPoll: boolean) {
  return useQuery({
    queryKey: featureKeys.realtime(id || ''),
    queryFn: async () => {
      if (!id) return null;
      // Fetch logic
    },
    enabled: !!id && shouldPoll,
    refetchInterval: shouldPoll ? 2000 : false, // Poll every 2s when enabled
    staleTime: 0, // Always fresh when polling
  });
}
```

---

## Mutation Patterns

### Basic Mutation

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

export function useUpdateFeature() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateData }) => {
      const { error } = await supabase
        .from('feature_table')
        .update(data)
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: featureKeys.detail(variables.id) 
      });
      
      toast({
        title: 'Success',
        description: 'Updated successfully',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
```

### Mutation with Optimistic Updates

```typescript
export function useCompleteFollowUp(prospectId: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (followUpId: string) => {
      const { error } = await supabase
        .from('account_follow_ups')
        .update({ 
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', followUpId);
      
      if (error) throw error;
    },
    onMutate: async (followUpId) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ 
        queryKey: prospectKeys.followUps(prospectId) 
      });

      // Snapshot previous value
      const previousFollowUps = queryClient.getQueryData(
        prospectKeys.followUps(prospectId)
      );

      // Optimistically update
      queryClient.setQueryData(
        prospectKeys.followUps(prospectId),
        (old: FollowUp[] | undefined) =>
          old?.map(f => 
            f.id === followUpId 
              ? { ...f, status: 'completed', completed_at: new Date().toISOString() }
              : f
          ) || []
      );

      return { previousFollowUps };
    },
    onError: (err, followUpId, context) => {
      // Rollback on error
      queryClient.setQueryData(
        prospectKeys.followUps(prospectId),
        context?.previousFollowUps
      );
      
      toast({
        title: 'Error',
        description: 'Failed to complete follow-up',
        variant: 'destructive',
      });
    },
    onSuccess: () => {
      toast({
        title: 'Completed',
        description: 'Follow-up marked as complete',
      });
    },
  });
}
```

---

## Cache Invalidation

### Invalidation Strategies

```typescript
const queryClient = useQueryClient();

// Invalidate all queries for a feature
queryClient.invalidateQueries({ queryKey: featureKeys.all });

// Invalidate specific detail
queryClient.invalidateQueries({ queryKey: featureKeys.detail(id) });

// Invalidate all lists
queryClient.invalidateQueries({ queryKey: featureKeys.lists() });

// Invalidate related data across features
queryClient.invalidateQueries({ queryKey: ['prospects'] });
queryClient.invalidateQueries({ queryKey: ['call-detail'] });
```

### Common Invalidation Scenarios

**After creating a new record:**
```typescript
// Invalidate lists (new item should appear)
queryClient.invalidateQueries({ queryKey: featureKeys.lists() });
```

**After updating a record:**
```typescript
// Invalidate specific detail + lists
queryClient.invalidateQueries({ queryKey: featureKeys.detail(id) });
queryClient.invalidateQueries({ queryKey: featureKeys.lists() });
```

**After deleting a record:**
```typescript
// Invalidate lists (item should disappear)
queryClient.invalidateQueries({ queryKey: featureKeys.lists() });
```

**After updating related data:**
```typescript
// Invalidate multiple related features
queryClient.invalidateQueries({ queryKey: prospectKeys.detail(prospectId) });
queryClient.invalidateQueries({ queryKey: callDetailKeys.products(callId) });
```

---

## Polling Pattern

For data that needs real-time updates:

```typescript
const { data, isLoading } = useQuery({
  queryKey: ['live-data', id],
  queryFn: fetchData,
  refetchInterval: shouldPoll ? 2000 : false, // Poll every 2 seconds
  staleTime: 0, // Always fresh when polling
  enabled: shouldPoll, // Conditional polling
});
```

**Best Practices:**
- Use conditional polling (only when needed)
- Set reasonable intervals (2-5 seconds typically)
- Disable when component unmounts or data is complete
- Consider WebSocket for true real-time needs

---

## Dependent Queries

When one query depends on another:

```typescript
// First query
const { data: user } = useQuery({
  queryKey: ['user'],
  queryFn: fetchUser,
});

// Second query depends on first
const { data: userProjects } = useQuery({
  queryKey: ['projects', user?.id],
  queryFn: () => fetchProjects(user!.id),
  enabled: !!user?.id, // Only fetch when user ID exists
});
```

---

## Error Handling

### Component-Level Error Boundaries

```typescript
import { QueryErrorBoundary } from '@/components/ui/query-error-boundary';

<QueryErrorBoundary>
  <MyComponent />
</QueryErrorBoundary>
```

### Hook-Level Error Handling

```typescript
const { data, error, isError } = useQuery({
  queryKey: featureKeys.detail(id),
  queryFn: fetchData,
  retry: 1, // Only retry once
});

if (isError) {
  // Handle specific error cases
  if (error.message === 'Not found') {
    return <NotFoundView />;
  }
  throw error; // Re-throw for error boundary
}
```

---

## Quick Reference Templates

### Query Key Factory Template

```typescript
export const [feature]Keys = {
  all: ['feature-name'] as const,
  lists: () => [...[feature]Keys.all, 'list'] as const,
  list: (filters: string) => [...[feature]Keys.lists(), filters] as const,
  details: () => [...[feature]Keys.all, 'detail'] as const,
  detail: (id: string) => [...[feature]Keys.details(), id] as const,
};
```

### Basic Query Hook Template

```typescript
export function use[Feature](id: string | undefined) {
  return useQuery({
    queryKey: [feature]Keys.detail(id || ''),
    queryFn: async () => {
      if (!id) throw new Error('ID required');
      // Fetch logic
    },
    enabled: !!id,
    staleTime: 2 * 60 * 1000,
  });
}
```

### Mutation Hook Template

```typescript
export function useUpdate[Feature]() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: UpdateData) => {
      // Update logic
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [feature]Keys.all });
      toast({ title: 'Success' });
    },
    onError: (error) => {
      toast({ 
        title: 'Error', 
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
```

---

## Migration Checklist

When migrating existing code to React Query:

- [ ] Replace `useState` + `useEffect` with `useQuery`
- [ ] Create query key factory if multiple related queries
- [ ] Set appropriate `staleTime` based on data volatility
- [ ] Add `enabled` flag for conditional fetching
- [ ] Replace manual mutations with `useMutation`
- [ ] Add optimistic updates for better UX
- [ ] Implement proper cache invalidation
- [ ] Remove manual loading/error state management
- [ ] Test with React Query DevTools

---

## Common Pitfalls

❌ **Don't**: Use `useState` + `useEffect` for server data  
✅ **Do**: Use React Query hooks

❌ **Don't**: Store server data in component state  
✅ **Do**: Let React Query manage cache

❌ **Don't**: Manually refetch on every action  
✅ **Do**: Use cache invalidation

❌ **Don't**: Forget `enabled` flag for conditional queries  
✅ **Do**: Use `enabled` to control when queries run

❌ **Don't**: Use same query key for different data  
✅ **Do**: Use query key factory pattern

---

## Resources

- [React Query Documentation](https://tanstack.com/query/latest)
- [Existing Hook Examples](../src/hooks/) - See `useCallDetailQueries.ts`, `useProspectQueries.ts`
- [Query Client Config](../src/lib/queryClientConfig.ts) - Global configuration
- [Development Guide](./DEVELOPMENT.md) - General development patterns
