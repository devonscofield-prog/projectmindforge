/**
 * Query Logger for React Query performance monitoring and debugging
 */

type _LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface QueryLogEntry {
  timestamp: Date;
  type: 'query' | 'mutation';
  event: string;
  queryKey?: unknown;
  mutationKey?: unknown;
  duration?: number;
  error?: unknown;
  data?: unknown;
}

const LOG_STYLES = {
  debug: 'color: #9CA3AF',
  info: 'color: #3B82F6',
  warn: 'color: #F59E0B',
  error: 'color: #EF4444',
  success: 'color: #10B981',
  query: 'color: #8B5CF6; font-weight: bold',
  mutation: 'color: #EC4899; font-weight: bold',
};

// Store recent logs for debugging
const logHistory: QueryLogEntry[] = [];
const MAX_LOG_HISTORY = 100;

function addToHistory(entry: QueryLogEntry) {
  logHistory.push(entry);
  if (logHistory.length > MAX_LOG_HISTORY) {
    logHistory.shift();
  }
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatQueryKey(queryKey: unknown): string {
  if (Array.isArray(queryKey)) {
    return queryKey.map(k => typeof k === 'object' ? JSON.stringify(k) : String(k)).join(' → ');
  }
  return String(queryKey);
}

export const queryLogger = {
  /**
   * Log query events
   */
  queryStart: (queryKey: unknown) => {
    if (import.meta.env.PROD) return;
    
    const entry: QueryLogEntry = {
      timestamp: new Date(),
      type: 'query',
      event: 'start',
      queryKey,
    };
    addToHistory(entry);
    
    console.groupCollapsed(
      `%c[Query] %c${formatQueryKey(queryKey)} %c→ fetching`,
      LOG_STYLES.query,
      'color: inherit',
      LOG_STYLES.info
    );
    console.log('Query Key:', queryKey);
    console.log('Time:', entry.timestamp.toISOString());
    console.groupEnd();
  },

  querySuccess: (queryKey: unknown, data: unknown, duration: number) => {
    if (import.meta.env.PROD) return;
    
    const entry: QueryLogEntry = {
      timestamp: new Date(),
      type: 'query',
      event: 'success',
      queryKey,
      duration,
      data,
    };
    addToHistory(entry);
    
    console.groupCollapsed(
      `%c[Query] %c${formatQueryKey(queryKey)} %c✓ ${formatDuration(duration)}`,
      LOG_STYLES.query,
      'color: inherit',
      LOG_STYLES.success
    );
    console.log('Query Key:', queryKey);
    console.log('Duration:', formatDuration(duration));
    console.log('Data:', data);
    console.groupEnd();
  },

  queryError: (queryKey: unknown, error: unknown, duration: number) => {
    if (import.meta.env.PROD) return;
    
    const entry: QueryLogEntry = {
      timestamp: new Date(),
      type: 'query',
      event: 'error',
      queryKey,
      duration,
      error,
    };
    addToHistory(entry);
    
    console.groupCollapsed(
      `%c[Query] %c${formatQueryKey(queryKey)} %c✗ ${formatDuration(duration)}`,
      LOG_STYLES.query,
      'color: inherit',
      LOG_STYLES.error
    );
    console.log('Query Key:', queryKey);
    console.log('Duration:', formatDuration(duration));
    console.error('Error:', error);
    console.groupEnd();
  },

  /**
   * Log mutation events
   */
  mutationStart: (mutationKey: unknown, variables: unknown) => {
    if (import.meta.env.PROD) return;
    
    const entry: QueryLogEntry = {
      timestamp: new Date(),
      type: 'mutation',
      event: 'start',
      mutationKey,
    };
    addToHistory(entry);
    
    console.groupCollapsed(
      `%c[Mutation] %c${formatQueryKey(mutationKey || 'anonymous')} %c→ executing`,
      LOG_STYLES.mutation,
      'color: inherit',
      LOG_STYLES.info
    );
    console.log('Mutation Key:', mutationKey);
    console.log('Variables:', variables);
    console.log('Time:', entry.timestamp.toISOString());
    console.groupEnd();
  },

  mutationSuccess: (mutationKey: unknown, data: unknown, duration: number) => {
    if (import.meta.env.PROD) return;
    
    const entry: QueryLogEntry = {
      timestamp: new Date(),
      type: 'mutation',
      event: 'success',
      mutationKey,
      duration,
      data,
    };
    addToHistory(entry);
    
    console.groupCollapsed(
      `%c[Mutation] %c${formatQueryKey(mutationKey || 'anonymous')} %c✓ ${formatDuration(duration)}`,
      LOG_STYLES.mutation,
      'color: inherit',
      LOG_STYLES.success
    );
    console.log('Mutation Key:', mutationKey);
    console.log('Duration:', formatDuration(duration));
    console.log('Data:', data);
    console.groupEnd();
  },

  mutationError: (mutationKey: unknown, error: unknown, duration: number) => {
    if (import.meta.env.PROD) return;
    
    const entry: QueryLogEntry = {
      timestamp: new Date(),
      type: 'mutation',
      event: 'error',
      mutationKey,
      duration,
      error,
    };
    addToHistory(entry);
    
    console.groupCollapsed(
      `%c[Mutation] %c${formatQueryKey(mutationKey || 'anonymous')} %c✗ ${formatDuration(duration)}`,
      LOG_STYLES.mutation,
      'color: inherit',
      LOG_STYLES.error
    );
    console.log('Mutation Key:', mutationKey);
    console.log('Duration:', formatDuration(duration));
    console.error('Error:', error);
    console.groupEnd();
  },

  /**
   * Get log history for debugging
   */
  getHistory: () => [...logHistory],

  /**
   * Clear log history
   */
  clearHistory: () => {
    logHistory.length = 0;
    console.log('%c[QueryLogger] History cleared', LOG_STYLES.info);
  },

  /**
   * Print performance summary
   */
  printSummary: () => {
    if (import.meta.env.PROD) return;
    
    const queries = logHistory.filter(l => l.type === 'query' && l.event === 'success');
    const mutations = logHistory.filter(l => l.type === 'mutation' && l.event === 'success');
    const errors = logHistory.filter(l => l.event === 'error');
    
    const avgQueryTime = queries.length > 0
      ? queries.reduce((sum, q) => sum + (q.duration || 0), 0) / queries.length
      : 0;
    
    const avgMutationTime = mutations.length > 0
      ? mutations.reduce((sum, m) => sum + (m.duration || 0), 0) / mutations.length
      : 0;

    console.group('%c[QueryLogger] Performance Summary', 'color: #8B5CF6; font-weight: bold; font-size: 14px');
    console.log(`Total Queries: ${queries.length}`);
    console.log(`Total Mutations: ${mutations.length}`);
    console.log(`Total Errors: ${errors.length}`);
    console.log(`Avg Query Time: ${formatDuration(avgQueryTime)}`);
    console.log(`Avg Mutation Time: ${formatDuration(avgMutationTime)}`);
    
    // Find slowest queries
    const slowestQueries = [...queries]
      .sort((a, b) => (b.duration || 0) - (a.duration || 0))
      .slice(0, 5);
    
    if (slowestQueries.length > 0) {
      console.group('Slowest Queries');
      slowestQueries.forEach(q => {
        console.log(`${formatQueryKey(q.queryKey)}: ${formatDuration(q.duration || 0)}`);
      });
      console.groupEnd();
    }
    
    console.groupEnd();
  },
};

// Augment Window interface for type safety
declare global {
  interface Window {
    queryLogger: typeof queryLogger;
  }
}

// Expose to window for debugging in development
if (import.meta.env.DEV) {
  window.queryLogger = queryLogger;
}
