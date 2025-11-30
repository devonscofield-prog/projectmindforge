import { useState, useEffect, useCallback, useRef } from 'react';

interface UseRateLimitCountdownResult {
  secondsRemaining: number;
  isRateLimited: boolean;
  startCountdown: (seconds?: number) => void;
  clearCountdown: () => void;
}

const DEFAULT_COOLDOWN_SECONDS = 60;

export function useRateLimitCountdown(
  defaultSeconds: number = DEFAULT_COOLDOWN_SECONDS
): UseRateLimitCountdownResult {
  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const clearCountdown = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setSecondsRemaining(0);
  }, []);

  const startCountdown = useCallback((seconds: number = defaultSeconds) => {
    // Clear any existing countdown
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    setSecondsRemaining(seconds);

    intervalRef.current = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [defaultSeconds]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return {
    secondsRemaining,
    isRateLimited: secondsRemaining > 0,
    startCountdown,
    clearCountdown,
  };
}
