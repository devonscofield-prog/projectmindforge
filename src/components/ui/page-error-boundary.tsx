import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, RefreshCw, Home, ArrowLeft, Bug } from 'lucide-react';
import { createLogger } from '@/lib/logger';

const log = createLogger('PageErrorBoundary');

interface Props {
  children: ReactNode;
  pageName?: string;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Page-level error boundary that provides user-friendly error recovery options.
 * Use this to wrap entire page components for graceful error handling.
 */
export class PageErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });
    log.error('PageErrorBoundary caught an error', { 
      error, 
      componentStack: errorInfo.componentStack,
      pageName: this.props.pageName 
    });
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleReload = (): void => {
    window.location.reload();
  };

  handleGoBack = (): void => {
    window.history.back();
  };

  handleGoHome = (): void => {
    window.location.href = '/';
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-[60vh] flex items-center justify-center p-4">
          <Card className="w-full max-w-md border-destructive/20">
            <CardHeader className="text-center pb-4">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="h-6 w-6 text-destructive" />
              </div>
              <CardTitle className="text-lg">
                {this.props.pageName 
                  ? `Error loading ${this.props.pageName}` 
                  : 'Something went wrong'}
              </CardTitle>
              <CardDescription>
                We encountered an unexpected error. Your data is safe.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Error details (collapsible) */}
              {this.state.error && (
                <details className="rounded-lg border bg-muted/50 p-3 text-sm">
                  <summary className="cursor-pointer font-medium flex items-center gap-2">
                    <Bug className="h-4 w-4" />
                    View error details
                  </summary>
                  <div className="mt-3 space-y-2">
                    <p className="font-mono text-xs text-destructive break-all">
                      {this.state.error.message}
                    </p>
                    {this.state.errorInfo?.componentStack && (
                      <pre className="text-xs text-muted-foreground overflow-auto max-h-24 p-2 bg-background rounded">
                        {this.state.errorInfo.componentStack.slice(0, 300)}...
                      </pre>
                    )}
                  </div>
                </details>
              )}

              {/* Action buttons */}
              <div className="grid grid-cols-2 gap-2">
                <Button onClick={this.handleRetry} variant="default" className="w-full">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try Again
                </Button>
                <Button onClick={this.handleGoBack} variant="outline" className="w-full">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Go Back
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button onClick={this.handleReload} variant="ghost" size="sm" className="w-full">
                  Reload Page
                </Button>
                <Button onClick={this.handleGoHome} variant="ghost" size="sm" className="w-full">
                  <Home className="h-4 w-4 mr-1" />
                  Home
                </Button>
              </div>

              <p className="text-xs text-center text-muted-foreground pt-2">
                If this keeps happening, please refresh or contact support.
              </p>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * HOC to wrap a page component with PageErrorBoundary
 */
export function withPageErrorBoundary<P extends object>(
  PageComponent: React.ComponentType<P>,
  pageName?: string
) {
  return function WrappedPage(props: P) {
    return (
      <PageErrorBoundary pageName={pageName}>
        <PageComponent {...props} />
      </PageErrorBoundary>
    );
  };
}
