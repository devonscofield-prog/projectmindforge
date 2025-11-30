import { useState, useRef, useCallback, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle2, X, Archive, Trash2, Star, Bell } from 'lucide-react';
import { LucideIcon } from 'lucide-react';

type SwipeAction = {
  label: string;
  icon?: LucideIcon;
  color?: string;
  bgColor?: string;
};

interface SwipeableCardProps {
  children: ReactNode;
  onSwipeRight?: () => void;
  onSwipeLeft?: () => void;
  rightAction?: SwipeAction;
  leftAction?: SwipeAction;
  disabled?: boolean;
  className?: string;
  /** Threshold in pixels to trigger swipe action */
  threshold?: number;
  /** Enable bounce animation when snapping back */
  bounce?: boolean;
}

const SWIPE_THRESHOLD = 80;
const MAX_SWIPE = 140;

// Preset actions for common use cases
export const SwipeActions = {
  complete: { label: 'Complete', icon: CheckCircle2, bgColor: 'bg-success', color: 'text-success-foreground' },
  dismiss: { label: 'Dismiss', icon: X, bgColor: 'bg-muted', color: 'text-muted-foreground' },
  delete: { label: 'Delete', icon: Trash2, bgColor: 'bg-destructive', color: 'text-destructive-foreground' },
  archive: { label: 'Archive', icon: Archive, bgColor: 'bg-secondary', color: 'text-secondary-foreground' },
  snooze: { label: 'Snooze', icon: Bell, bgColor: 'bg-warning', color: 'text-warning-foreground' },
  favorite: { label: 'Favorite', icon: Star, bgColor: 'bg-primary', color: 'text-primary-foreground' },
} as const;

export function SwipeableCard({
  children,
  onSwipeRight,
  onSwipeLeft,
  rightAction = SwipeActions.complete,
  leftAction = SwipeActions.dismiss,
  disabled = false,
  className,
  threshold = SWIPE_THRESHOLD,
  bounce = true,
}: SwipeableCardProps) {
  const [offset, setOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const currentX = useRef(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const isHorizontalSwipe = useRef<boolean | null>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (disabled || isAnimatingOut) return;
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    currentX.current = e.touches[0].clientX;
    isHorizontalSwipe.current = null;
    setIsDragging(true);
  }, [disabled, isAnimatingOut]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging || disabled || isAnimatingOut) return;
    
    const touchX = e.touches[0].clientX;
    const touchY = e.touches[0].clientY;
    const diffX = touchX - startX.current;
    const diffY = touchY - startY.current;
    
    // Determine swipe direction on first significant movement
    if (isHorizontalSwipe.current === null && (Math.abs(diffX) > 10 || Math.abs(diffY) > 10)) {
      isHorizontalSwipe.current = Math.abs(diffX) > Math.abs(diffY);
    }
    
    // Only handle horizontal swipes
    if (isHorizontalSwipe.current === false) {
      setIsDragging(false);
      setOffset(0);
      return;
    }
    
    if (isHorizontalSwipe.current === true) {
      e.preventDefault(); // Prevent vertical scroll during horizontal swipe
    }
    
    currentX.current = touchX;
    
    // Only allow swipe in directions that have handlers
    if (diffX > 0 && !onSwipeRight) return;
    if (diffX < 0 && !onSwipeLeft) return;
    
    // Apply exponential resistance for natural feel
    const resistance = 1 - Math.min(Math.abs(diffX) / 400, 0.5);
    const limitedDiff = Math.sign(diffX) * Math.min(Math.abs(diffX) * resistance, MAX_SWIPE);
    
    setOffset(limitedDiff);
  }, [isDragging, disabled, isAnimatingOut, onSwipeRight, onSwipeLeft]);

  const handleTouchEnd = useCallback(() => {
    if (!isDragging || disabled || isAnimatingOut) return;
    setIsDragging(false);
    isHorizontalSwipe.current = null;
    
    const diff = currentX.current - startX.current;
    
    if (diff > threshold && onSwipeRight) {
      // Animate out to the right
      setIsAnimatingOut(true);
      setOffset(window.innerWidth);
      setTimeout(() => {
        onSwipeRight();
        setOffset(0);
        setIsAnimatingOut(false);
      }, 250);
    } else if (diff < -threshold && onSwipeLeft) {
      // Animate out to the left
      setIsAnimatingOut(true);
      setOffset(-window.innerWidth);
      setTimeout(() => {
        onSwipeLeft();
        setOffset(0);
        setIsAnimatingOut(false);
      }, 250);
    } else {
      // Snap back with optional bounce
      setOffset(0);
    }
  }, [isDragging, disabled, isAnimatingOut, threshold, onSwipeRight, onSwipeLeft]);

  const swipeProgress = Math.min(Math.abs(offset) / threshold, 1);
  const isSwipingRight = offset > 0;
  const isSwipingLeft = offset < 0;

  const RightIcon = rightAction.icon || CheckCircle2;
  const LeftIcon = leftAction.icon || X;

  return (
    <div 
      className={cn(
        "relative overflow-hidden rounded-lg touch-pan-y",
        isAnimatingOut && "pointer-events-none",
        className
      )}
    >
      {/* Background actions */}
      <div className="absolute inset-0 flex">
        {/* Right swipe action background */}
        {onSwipeRight && (
          <div 
            className={cn(
              "absolute inset-y-0 left-0 flex items-center justify-start pl-4 transition-all duration-150",
              rightAction.bgColor || 'bg-success',
              swipeProgress >= 1 ? "opacity-100" : "opacity-90"
            )}
            style={{
              width: Math.max(offset, 0),
              opacity: isSwipingRight ? 1 : 0,
            }}
          >
            <div 
              className={cn(
                "flex items-center gap-2 font-medium transition-all duration-150",
                rightAction.color || 'text-success-foreground'
              )}
              style={{
                transform: `scale(${0.8 + swipeProgress * 0.2})`,
                opacity: swipeProgress,
              }}
            >
              <RightIcon 
                className={cn(
                  "h-5 w-5 transition-transform duration-200",
                  swipeProgress >= 1 && "scale-125"
                )} 
              />
              <span className="text-sm whitespace-nowrap">{rightAction.label}</span>
            </div>
          </div>
        )}
        
        {/* Left swipe action background */}
        {onSwipeLeft && (
          <div 
            className={cn(
              "absolute inset-y-0 right-0 flex items-center justify-end pr-4 transition-all duration-150",
              leftAction.bgColor || 'bg-muted',
              swipeProgress >= 1 ? "opacity-100" : "opacity-90"
            )}
            style={{
              width: Math.max(-offset, 0),
              opacity: isSwipingLeft ? 1 : 0,
            }}
          >
            <div 
              className={cn(
                "flex items-center gap-2 font-medium transition-all duration-150",
                leftAction.color || 'text-muted-foreground'
              )}
              style={{
                transform: `scale(${0.8 + swipeProgress * 0.2})`,
                opacity: swipeProgress,
              }}
            >
              <span className="text-sm whitespace-nowrap">{leftAction.label}</span>
              <LeftIcon 
                className={cn(
                  "h-5 w-5 transition-transform duration-200",
                  swipeProgress >= 1 && "scale-125"
                )} 
              />
            </div>
          </div>
        )}
      </div>
      
      {/* Card content */}
      <div
        ref={cardRef}
        className={cn(
          "relative bg-card rounded-lg transition-all",
          !isDragging && bounce && "duration-300 ease-out",
          !isDragging && !bounce && "duration-200",
          isAnimatingOut && "duration-250 ease-in"
        )}
        style={{
          transform: `translateX(${offset}px)`,
          boxShadow: isDragging ? '0 4px 12px rgba(0,0,0,0.15)' : undefined,
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {children}
      </div>
      
      {/* Swipe hint indicator (shows when partially swiped) */}
      {swipeProgress > 0 && swipeProgress < 1 && !isAnimatingOut && (
        <div 
          className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1 pointer-events-none"
          style={{ opacity: 1 - swipeProgress }}
        >
          <div className="w-1 h-1 rounded-full bg-muted-foreground/50" />
          <div className="w-1 h-1 rounded-full bg-muted-foreground/30" />
          <div className="w-1 h-1 rounded-full bg-muted-foreground/50" />
        </div>
      )}
    </div>
  );
}
