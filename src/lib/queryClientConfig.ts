import { QueryClient, QueryCache, MutationCache } from '@tanstack/react-query';
import { queryLogger } from './queryLogger';

// Track query start times for duration calculation
const queryStartTimes = new Map<string, number>();
const mutationStartTimes = new Map<string, number>();

function getQueryKeyString(queryKey: unknown): string {
  return JSON.stringify(queryKey);
}

/**
 * Create a QueryClient with performance monitoring and logging
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    queryCache: new QueryCache({
      onSuccess: (data, query) => {
        const keyString = getQueryKeyString(query.queryKey);
        const startTime = queryStartTimes.get(keyString);
        const duration = startTime ? Date.now() - startTime : 0;
        queryStartTimes.delete(keyString);
        
        queryLogger.querySuccess(query.queryKey, data, duration);
      },
      onError: (error, query) => {
        const keyString = getQueryKeyString(query.queryKey);
        const startTime = queryStartTimes.get(keyString);
        const duration = startTime ? Date.now() - startTime : 0;
        queryStartTimes.delete(keyString);
        
        queryLogger.queryError(query.queryKey, error, duration);
      },
    }),
    mutationCache: new MutationCache({
      onMutate: (variables, mutation) => {
        const keyString = getQueryKeyString(mutation.options.mutationKey || 'anonymous');
        mutationStartTimes.set(keyString, Date.now());
        
        queryLogger.mutationStart(mutation.options.mutationKey, variables);
      },
      onSuccess: (data, _variables, _context, mutation) => {
        const keyString = getQueryKeyString(mutation.options.mutationKey || 'anonymous');
        const startTime = mutationStartTimes.get(keyString);
        const duration = startTime ? Date.now() - startTime : 0;
        mutationStartTimes.delete(keyString);
        
        queryLogger.mutationSuccess(mutation.options.mutationKey, data, duration);
      },
      onError: (error, _variables, _context, mutation) => {
        const keyString = getQueryKeyString(mutation.options.mutationKey || 'anonymous');
        const startTime = mutationStartTimes.get(keyString);
        const duration = startTime ? Date.now() - startTime : 0;
        mutationStartTimes.delete(keyString);
        
        queryLogger.mutationError(mutation.options.mutationKey, error, duration);
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60, // 1 minute
        gcTime: 1000 * 60 * 5, // 5 minutes (formerly cacheTime)
        retry: 1,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}

// Track query fetching for start time logging
export function setupQueryLogging(queryClient: QueryClient): void {
  if (import.meta.env.PROD) return;

  // Subscribe to query state changes to track start times
  queryClient.getQueryCache().subscribe((event) => {
    if (event.type === 'added' || (event.type === 'updated' && event.query.state.fetchStatus === 'fetching')) {
      const keyString = getQueryKeyString(event.query.queryKey);
      if (!queryStartTimes.has(keyString)) {
        queryStartTimes.set(keyString, Date.now());
        queryLogger.queryStart(event.query.queryKey);
      }
    }
  });
}
