import { useEffect, useState, useRef, ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { 
  DashboardSkeleton, 
  ListPageSkeleton, 
  DetailPageSkeleton,
  FormPageSkeleton,
  PageSkeleton 
} from './skeletons';

type SkeletonType = 'dashboard' | 'list' | 'detail' | 'form' | 'generic' | 'none';

interface PageTransitionProps {
  children: React.ReactNode;
  className?: string;
  /** Type of skeleton to show during transition */
  skeleton?: SkeletonType;
  /** Duration of the transition in ms */
  duration?: number;
}

/**
 * Get the appropriate skeleton component based on type
 */
function getSkeletonComponent(type: SkeletonType): ReactNode {
  switch (type) {
    case 'dashboard':
      return <DashboardSkeleton />;
    case 'list':
      return <ListPageSkeleton />;
    case 'detail':
      return <DetailPageSkeleton />;
    case 'form':
      return <FormPageSkeleton />;
    case 'generic':
      return <PageSkeleton />;
    case 'none':
    default:
      return null;
  }
}

/**
 * Detect skeleton type based on route path
 */
function detectSkeletonType(pathname: string): SkeletonType {
  // Dashboard routes
  if (pathname === '/admin' || pathname === '/manager' || pathname === '/rep') {
    return 'dashboard';
  }
  
  // List routes
  if (
    pathname.includes('/users') ||
    pathname.includes('/teams') ||
    pathname.includes('/accounts') ||
    pathname.includes('/prospects') ||
    pathname.includes('/history') ||
    pathname.includes('/transcripts')
  ) {
    return 'list';
  }
  
  // Detail routes (has ID in path)
  if (
    pathname.match(/\/[a-f0-9-]{36}$/) || // UUID at end
    pathname.includes('/calls/') ||
    pathname.includes('/rep/')
  ) {
    return 'detail';
  }
  
  // Form/submission routes
  if (pathname.includes('/submit') || pathname.includes('/new')) {
    return 'form';
  }
  
  return 'none';
}

/**
 * Page transition wrapper that animates content on route changes.
 * Uses CSS animations for smooth enter/exit transitions.
 * Optionally shows skeleton loading during transition.
 */
export function PageTransition({ 
  children, 
  className,
  skeleton = 'none',
  duration = 200
}: PageTransitionProps) {
  const location = useLocation();
  const [phase, setPhase] = useState<'visible' | 'exiting' | 'loading' | 'entering'>('visible');
  const [displayedChildren, setDisplayedChildren] = useState(children);
  const isFirstRender = useRef(true);
  const previousPath = useRef(location.pathname);

  // Auto-detect skeleton type if not specified
  const effectiveSkeleton = skeleton === 'none' 
    ? detectSkeletonType(location.pathname) 
    : skeleton;

  useEffect(() => {
    // Skip animation on first render
    if (isFirstRender.current) {
      isFirstRender.current = false;
      setDisplayedChildren(children);
      return;
    }

    // Only animate if path actually changed
    if (previousPath.current === location.pathname) {
      setDisplayedChildren(children);
      return;
    }
    
    previousPath.current = location.pathname;

    // Start exit animation
    setPhase('exiting');

    // Show skeleton (if enabled) after exit
    const exitTimer = setTimeout(() => {
      if (effectiveSkeleton !== 'none') {
        setPhase('loading');
      }
      
      // Update content and start enter animation
      const loadTimer = setTimeout(() => {
        setDisplayedChildren(children);
        setPhase('entering');
        
        // Complete transition
        const enterTimer = setTimeout(() => {
          setPhase('visible');
        }, duration);
        
        return () => clearTimeout(enterTimer);
      }, effectiveSkeleton !== 'none' ? 100 : 0); // Brief skeleton flash
      
      return () => clearTimeout(loadTimer);
    }, duration / 2);

    return () => clearTimeout(exitTimer);
  }, [location.pathname, children, duration, effectiveSkeleton]);

  const getTransitionStyles = () => {
    switch (phase) {
      case 'exiting':
        return 'opacity-0 translate-y-2';
      case 'loading':
        return 'opacity-100 translate-y-0';
      case 'entering':
        return 'animate-slide-up';
      case 'visible':
      default:
        return 'opacity-100 translate-y-0';
    }
  };

  return (
    <div
      className={cn(
        'transition-all',
        phase === 'exiting' ? 'duration-150 ease-out' : 'duration-300 ease-out',
        getTransitionStyles(),
        className
      )}
    >
      {phase === 'loading' ? getSkeletonComponent(effectiveSkeleton) : displayedChildren}
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

/**
 * Loading overlay for async operations
 */
export function LoadingOverlay({ 
  isLoading, 
  children,
  skeleton = 'generic'
}: { 
  isLoading: boolean; 
  children: React.ReactNode;
  skeleton?: SkeletonType;
}) {
  if (isLoading) {
    return <>{getSkeletonComponent(skeleton)}</>;
  }
  
  return (
    <div className="animate-fade-in">
      {children}
    </div>
  );
}
