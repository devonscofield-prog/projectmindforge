import { useState, useCallback } from 'react';

const ONBOARDING_KEY_PREFIX = 'mindforge_onboarding_v1_';

export function useOnboarding(userId: string | undefined) {
  const key = userId ? `${ONBOARDING_KEY_PREFIX}${userId}` : null;

  const [showOnboarding, setShowOnboarding] = useState(() => {
    if (!key) return false;
    return localStorage.getItem(key) !== 'completed';
  });

  const completeOnboarding = useCallback(() => {
    if (key) {
      localStorage.setItem(key, 'completed');
    }
    setShowOnboarding(false);
  }, [key]);

  const dismissOnboarding = useCallback(() => {
    if (key) {
      localStorage.setItem(key, 'completed');
    }
    setShowOnboarding(false);
  }, [key]);

  return { showOnboarding, completeOnboarding, dismissOnboarding };
}
