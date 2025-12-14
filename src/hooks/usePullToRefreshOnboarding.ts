import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { usePullToRefreshContext } from '@/contexts/PullToRefreshContext';
import { useIsMobile } from '@/hooks/use-mobile';

const STORAGE_KEY = 'ptr-hint-shown';

/**
 * Shows a one-time toast hint about pull-to-refresh on mobile devices.
 * Only triggers once per device (persisted in localStorage).
 */
export function usePullToRefreshOnboarding() {
  const isMobile = useIsMobile();
  const { refreshHandler, isEnabled } = usePullToRefreshContext();
  const hasShownRef = useRef(false);

  useEffect(() => {
    // Only show on mobile when pull-to-refresh is actually available
    if (!isMobile || !refreshHandler || !isEnabled) return;
    
    // Prevent showing multiple times in same session
    if (hasShownRef.current) return;
    
    // Check if already shown before
    try {
      const alreadyShown = localStorage.getItem(STORAGE_KEY);
      if (alreadyShown) return;
    } catch {
      // localStorage not available, skip
      return;
    }

    // Show the hint after a short delay to let the page settle
    const timeout = setTimeout(() => {
      toast('💡 Tip: Pull down to refresh this page', {
        duration: 4000,
        position: 'top-center',
      });
      
      hasShownRef.current = true;
      
      try {
        localStorage.setItem(STORAGE_KEY, 'true');
      } catch {
        // Ignore storage errors
      }
    }, 1500);

    return () => clearTimeout(timeout);
  }, [isMobile, refreshHandler, isEnabled]);
}
