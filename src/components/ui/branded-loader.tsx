import { memo } from 'react';
import { cn } from '@/lib/utils';

interface BrandedLoaderProps {
  variant?: 'full-page' | 'inline' | 'compact';
  message?: string;
  className?: string;
}

export const BrandedLoader = memo(function BrandedLoader({
  variant = 'inline',
  message,
  className
}: BrandedLoaderProps) {
  // Full-page variant for Suspense fallback
  if (variant === 'full-page') {
    return (
      <div className={cn(
        "min-h-screen flex flex-col items-center justify-center bg-background",
        className
      )}>
        {/* Logo with pulse animation and glow */}
        <div className="relative mb-8">
          <img 
            src="/mindforge-logo.png" 
            alt="MindForge" 
            className="h-12 w-auto relative z-10"
          />
          {/* Glow effect behind logo */}
          <div className="absolute inset-0 bg-primary/30 blur-2xl rounded-full scale-150 animate-pulse" />
        </div>
        
        {/* Gradient progress bar with sweep animation */}
        <div className="w-48 h-1 bg-muted/50 rounded-full overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-primary rounded-full progress-sweep" />
        </div>
        
        {/* Loading message */}
        <p className="mt-4 text-sm text-muted-foreground animate-pulse">
          {message || "Loading..."}
        </p>
      </div>
    );
  }

  // Inline variant for component loading
  if (variant === 'inline') {
    return (
      <div className={cn(
        "flex items-center justify-center py-8",
        className
      )}>
        <div className="flex flex-col items-center gap-3">
          {/* Gradient spinner ring */}
          <div className="relative h-8 w-8">
            <div className="absolute inset-0 rounded-full border-2 border-muted/30" />
            <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary animate-spin" />
          </div>
          {message && (
            <p className="text-sm text-muted-foreground">{message}</p>
          )}
        </div>
      </div>
    );
  }

  // Compact variant for buttons/small spaces
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="h-4 w-4 rounded-full border-2 border-transparent border-t-primary animate-spin" />
      {message && <span className="text-sm text-muted-foreground">{message}</span>}
    </div>
  );
});
