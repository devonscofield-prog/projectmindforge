import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * ScrollToTop component that smoothly scrolls to the top of the page
 * when the route changes. Uses smooth scrolling for better UX.
 */
export function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    // Small delay to allow page transition animation to start
    const timeoutId = setTimeout(() => {
      window.scrollTo({
        top: 0,
        left: 0,
        behavior: 'smooth',
      });
    }, 50);

    return () => clearTimeout(timeoutId);
  }, [pathname]);

  return null;
}

/**
 * Hook version for more control over scroll behavior
 */
export function useScrollToTop(options?: { 
  behavior?: ScrollBehavior; 
  delay?: number;
  enabled?: boolean;
}) {
  const { pathname } = useLocation();
  const { behavior = 'smooth', delay = 50, enabled = true } = options ?? {};

  useEffect(() => {
    if (!enabled) return;

    const timeoutId = setTimeout(() => {
      window.scrollTo({
        top: 0,
        left: 0,
        behavior,
      });
    }, delay);

    return () => clearTimeout(timeoutId);
  }, [pathname, behavior, delay, enabled]);
}
