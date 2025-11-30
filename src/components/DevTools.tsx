import { lazy, Suspense } from 'react';

// Lazy load React Query Devtools only in development
const ReactQueryDevtools = lazy(() =>
  import('@tanstack/react-query-devtools').then((module) => ({
    default: module.ReactQueryDevtools,
  }))
);

/**
 * Development tools component - only renders in development mode
 */
export function DevTools() {
  if (import.meta.env.PROD) {
    return null;
  }

  return (
    <Suspense fallback={null}>
      <ReactQueryDevtools 
        initialIsOpen={false} 
        buttonPosition="bottom-left"
        position="bottom"
      />
    </Suspense>
  );
}
