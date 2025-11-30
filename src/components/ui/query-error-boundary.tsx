import React from 'react';
import { QueryErrorResetBoundary } from '@tanstack/react-query';
import { ComponentErrorBoundary } from './component-error-boundary';
import { cn } from '@/lib/utils';

interface QueryErrorBoundaryProps {
  children: React.ReactNode;
  className?: string;
  compact?: boolean;
  fallback?: React.ReactNode;
}

/**
 * Error boundary that integrates with React Query's error reset functionality.
 * When retry is clicked, it resets the query error state and re-renders children.
 */
export function QueryErrorBoundary({ 
  children, 
  className,
  compact = false,
  fallback
}: QueryErrorBoundaryProps) {
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <ComponentErrorBoundary 
          onReset={reset}
          className={cn(className)}
          compact={compact}
          fallback={fallback}
        >
          {children}
        </ComponentErrorBoundary>
      )}
    </QueryErrorResetBoundary>
  );
}
