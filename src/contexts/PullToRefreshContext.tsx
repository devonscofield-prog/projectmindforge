import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface PullToRefreshContextType {
  refreshHandler: (() => Promise<void>) | null;
  setRefreshHandler: (handler: (() => Promise<void>) | null) => void;
  isEnabled: boolean;
  setIsEnabled: (enabled: boolean) => void;
}

const PullToRefreshContext = createContext<PullToRefreshContextType | null>(null);

export function PullToRefreshProvider({ children }: { children: ReactNode }) {
  const [refreshHandler, setRefreshHandler] = useState<(() => Promise<void>) | null>(null);
  const [isEnabled, setIsEnabled] = useState(true);

  return (
    <PullToRefreshContext.Provider value={{ refreshHandler, setRefreshHandler, isEnabled, setIsEnabled }}>
      {children}
    </PullToRefreshContext.Provider>
  );
}

export function usePullToRefreshContext() {
  const context = useContext(PullToRefreshContext);
  if (!context) {
    // Return a no-op context if not within provider (for SSR or initial render)
    return {
      refreshHandler: null,
      setRefreshHandler: () => {},
      isEnabled: false,
      setIsEnabled: () => {},
    };
  }
  return context;
}

/**
 * Hook for pages to register their refresh handler.
 * Call this in your page component with a function that refetches data.
 * The handler is automatically cleared when the component unmounts.
 * 
 * @example
 * ```tsx
 * const { refetch } = useQuery(...);
 * useRegisterRefresh(async () => {
 *   await refetch();
 * });
 * ```
 */
export function useRegisterRefresh(handler: () => Promise<void>) {
  const { setRefreshHandler } = usePullToRefreshContext();

  useEffect(() => {
    setRefreshHandler(handler);
    return () => setRefreshHandler(null);
  }, [handler, setRefreshHandler]);
}

/**
 * Hook to temporarily disable pull-to-refresh (e.g., when a modal is open)
 */
export function useDisablePullToRefresh(disabled: boolean) {
  const { setIsEnabled } = usePullToRefreshContext();

  useEffect(() => {
    if (disabled) {
      setIsEnabled(false);
      return () => setIsEnabled(true);
    }
  }, [disabled, setIsEnabled]);
}
