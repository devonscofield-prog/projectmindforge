import { useState, useRef, useCallback, ReactNode } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
}

export function PullToRefresh({ onRefresh, children, className, disabled = false }: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const isPulling = useRef(false);

  const PULL_THRESHOLD = 80;
  const MAX_PULL = 120;

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (disabled || isRefreshing) return;
    
    // Only enable pull when at the top of the scroll container
    const scrollTop = containerRef.current?.scrollTop ?? 0;
    if (scrollTop <= 0) {
      startY.current = e.touches[0].clientY;
      isPulling.current = true;
    }
  }, [disabled, isRefreshing]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isPulling.current || isRefreshing || disabled) return;
    
    const currentY = e.touches[0].clientY;
    const diff = currentY - startY.current;
    const scrollTop = containerRef.current?.scrollTop ?? 0;
    
    if (diff > 0 && scrollTop <= 0) {
      // Prevent default scroll behavior when pulling
      e.preventDefault();
      
      // Apply exponential resistance for natural feel
      const resistance = 1 - Math.min(diff / 400, 0.6);
      const newPullDistance = Math.min(diff * resistance, MAX_PULL);
      setPullDistance(newPullDistance);
    }
  }, [isRefreshing, disabled]);

  const handleTouchEnd = useCallback(async () => {
    if (!isPulling.current || disabled) return;
    isPulling.current = false;

    if (pullDistance >= PULL_THRESHOLD && !isRefreshing) {
      setIsRefreshing(true);
      setPullDistance(60); // Hold at a nice position while refreshing
      
      try {
        await onRefresh();
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 500);
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  }, [pullDistance, isRefreshing, onRefresh, disabled]);

  const pullProgress = Math.min(pullDistance / PULL_THRESHOLD, 1);
  const rotation = pullProgress * 180;

  return (
    <div
      ref={containerRef}
      className={cn("relative overflow-auto touch-pan-y", className)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull indicator */}
      <div 
        className={cn(
          "absolute left-1/2 -translate-x-1/2 flex items-center justify-center pointer-events-none z-20",
          "transition-all duration-300 ease-out",
          (pullDistance > 0 || isRefreshing) ? "opacity-100" : "opacity-0"
        )}
        style={{ 
          top: Math.max(pullDistance - 50, -50),
          transform: `translateX(-50%) scale(${0.8 + pullProgress * 0.2})`,
        }}
      >
        <div className={cn(
          "flex items-center justify-center w-10 h-10 rounded-full shadow-lg transition-all duration-200",
          "bg-background border-2",
          isRefreshing && "border-primary",
          showSuccess && "border-success bg-success/10",
          !isRefreshing && !showSuccess && pullProgress >= 1 && "border-primary bg-primary/10",
          !isRefreshing && !showSuccess && pullProgress < 1 && "border-muted-foreground/30"
        )}>
          {isRefreshing ? (
            <Loader2 className="h-5 w-5 text-primary animate-spin" />
          ) : showSuccess ? (
            <RefreshCw className="h-5 w-5 text-success" />
          ) : (
            <RefreshCw 
              className={cn(
                "h-5 w-5 transition-all duration-150",
                pullProgress >= 1 ? "text-primary" : "text-muted-foreground"
              )}
              style={{ transform: `rotate(${rotation}deg)` }}
            />
          )}
        </div>
      </div>

      {/* Pull progress bar */}
      {pullDistance > 0 && !isRefreshing && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-muted overflow-hidden z-10">
          <div 
            className="h-full bg-primary transition-all duration-100 ease-out"
            style={{ width: `${pullProgress * 100}%` }}
          />
        </div>
      )}

      {/* Content with pull offset */}
      <div 
        className="min-h-full"
        style={{ 
          transform: `translateY(${pullDistance}px)`,
          transition: isPulling.current ? 'none' : 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
        }}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * Hook to create a refresh handler that works with React Query
 */
export function usePullToRefresh(refetchFn: () => Promise<unknown>) {
  const handleRefresh = useCallback(async () => {
    await refetchFn();
  }, [refetchFn]);

  return handleRefresh;
}
