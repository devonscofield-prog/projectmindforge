import { useEffect, useState, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface PageTransitionProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Page transition wrapper that animates content on route changes.
 * Uses CSS animations for smooth enter/exit transitions.
 */
export function PageTransition({ children, className }: PageTransitionProps) {
  const location = useLocation();
  const [isVisible, setIsVisible] = useState(true);
  const [displayedChildren, setDisplayedChildren] = useState(children);
  const isFirstRender = useRef(true);

  useEffect(() => {
    // Skip animation on first render
    if (isFirstRender.current) {
      isFirstRender.current = false;
      setDisplayedChildren(children);
      return;
    }

    // Start exit animation
    setIsVisible(false);

    // After exit animation, update content and start enter animation
    const timer = setTimeout(() => {
      setDisplayedChildren(children);
      setIsVisible(true);
    }, 150); // Match the exit animation duration

    return () => clearTimeout(timer);
  }, [location.pathname, children]);

  return (
    <div
      className={cn(
        'transition-all duration-200 ease-out',
        isVisible 
          ? 'opacity-100 translate-y-0' 
          : 'opacity-0 translate-y-2',
        className
      )}
    >
      {displayedChildren}
    </div>
  );
}

/**
 * Simple fade transition without location tracking.
 * Use for content that should animate on mount only.
 */
export function FadeIn({ 
  children, 
  className,
  delay = 0,
  duration = 300
}: { 
  children: React.ReactNode; 
  className?: string;
  delay?: number;
  duration?: number;
}) {
  return (
    <div
      className={cn('animate-fade-in', className)}
      style={{ 
        animationDelay: `${delay}ms`,
        animationDuration: `${duration}ms`
      }}
    >
      {children}
    </div>
  );
}

/**
 * Staggered animation container for lists/grids.
 * Each child animates in sequence with a delay.
 */
export function StaggeredContainer({ 
  children, 
  className,
  staggerDelay = 50,
  initialDelay = 0
}: { 
  children: React.ReactNode; 
  className?: string;
  staggerDelay?: number;
  initialDelay?: number;
}) {
  return (
    <div className={className}>
      {Array.isArray(children) 
        ? children.map((child, index) => (
            <div
              key={index}
              className="animate-fade-in"
              style={{ animationDelay: `${initialDelay + index * staggerDelay}ms` }}
            >
              {child}
            </div>
          ))
        : children
      }
    </div>
  );
}
