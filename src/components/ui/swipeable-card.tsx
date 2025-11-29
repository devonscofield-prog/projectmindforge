import { useState, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle2, X } from 'lucide-react';

interface SwipeableCardProps {
  children: React.ReactNode;
  onSwipeRight?: () => void;
  onSwipeLeft?: () => void;
  swipeRightLabel?: string;
  swipeLeftLabel?: string;
  disabled?: boolean;
  className?: string;
}

const SWIPE_THRESHOLD = 80;
const MAX_SWIPE = 120;

export function SwipeableCard({
  children,
  onSwipeRight,
  onSwipeLeft,
  swipeRightLabel = 'Complete',
  swipeLeftLabel = 'Dismiss',
  disabled = false,
  className,
}: SwipeableCardProps) {
  const [offset, setOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startX = useRef(0);
  const currentX = useRef(0);
  const cardRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (disabled) return;
    startX.current = e.touches[0].clientX;
    currentX.current = e.touches[0].clientX;
    setIsDragging(true);
  }, [disabled]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging || disabled) return;
    currentX.current = e.touches[0].clientX;
    const diff = currentX.current - startX.current;
    
    // Limit the swipe distance with resistance
    const limitedDiff = Math.sign(diff) * Math.min(Math.abs(diff), MAX_SWIPE);
    
    // Only allow swipe in directions that have handlers
    if (diff > 0 && !onSwipeRight) return;
    if (diff < 0 && !onSwipeLeft) return;
    
    setOffset(limitedDiff);
  }, [isDragging, disabled, onSwipeRight, onSwipeLeft]);

  const handleTouchEnd = useCallback(() => {
    if (!isDragging || disabled) return;
    setIsDragging(false);
    
    const diff = currentX.current - startX.current;
    
    if (diff > SWIPE_THRESHOLD && onSwipeRight) {
      // Animate out to the right
      setOffset(MAX_SWIPE + 50);
      setTimeout(() => {
        onSwipeRight();
        setOffset(0);
      }, 200);
    } else if (diff < -SWIPE_THRESHOLD && onSwipeLeft) {
      // Animate out to the left
      setOffset(-(MAX_SWIPE + 50));
      setTimeout(() => {
        onSwipeLeft();
        setOffset(0);
      }, 200);
    } else {
      // Snap back
      setOffset(0);
    }
  }, [isDragging, disabled, onSwipeRight, onSwipeLeft]);

  const swipeProgress = Math.abs(offset) / SWIPE_THRESHOLD;
  const isSwipingRight = offset > 0;
  const isSwipingLeft = offset < 0;

  return (
    <div className={cn("relative overflow-hidden rounded-lg", className)}>
      {/* Background actions */}
      <div className="absolute inset-0 flex">
        {/* Right swipe action (Complete) */}
        {onSwipeRight && (
          <div 
            className={cn(
              "flex items-center justify-start pl-4 w-1/2 transition-colors",
              isSwipingRight && swipeProgress >= 1 
                ? "bg-green-500" 
                : "bg-green-500/80"
            )}
            style={{
              opacity: isSwipingRight ? Math.min(swipeProgress, 1) : 0,
            }}
          >
            <div className="flex items-center gap-2 text-white font-medium">
              <CheckCircle2 
                className={cn(
                  "h-5 w-5 transition-transform",
                  swipeProgress >= 1 && "scale-110"
                )} 
              />
              <span className="text-sm">{swipeRightLabel}</span>
            </div>
          </div>
        )}
        
        {/* Left swipe action (Dismiss) */}
        {onSwipeLeft && (
          <div 
            className={cn(
              "flex items-center justify-end pr-4 w-1/2 ml-auto transition-colors",
              isSwipingLeft && swipeProgress >= 1 
                ? "bg-destructive" 
                : "bg-destructive/80"
            )}
            style={{
              opacity: isSwipingLeft ? Math.min(swipeProgress, 1) : 0,
            }}
          >
            <div className="flex items-center gap-2 text-white font-medium">
              <span className="text-sm">{swipeLeftLabel}</span>
              <X 
                className={cn(
                  "h-5 w-5 transition-transform",
                  swipeProgress >= 1 && "scale-110"
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
          "relative bg-card transition-transform",
          !isDragging && "duration-200"
        )}
        style={{
          transform: `translateX(${offset}px)`,
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {children}
      </div>
    </div>
  );
}
