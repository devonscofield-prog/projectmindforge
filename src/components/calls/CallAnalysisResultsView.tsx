import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, AlertTriangle, RefreshCw, Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { AnalysisProgress } from '@/components/calls/AnalysisProgress';
import type { CallAnalysis, CallTranscript } from '@/api/aiCallAnalysis';

interface CallAnalysisResultsViewProps {
  call: CallTranscript | null;
  analysis: CallAnalysis | null;
  isOwner: boolean;
  isManager: boolean;
  onRetryAnalysis?: () => void;
  onDeleteCall?: () => void;
  isRetrying?: boolean;
  isDeleting?: boolean;
}

/**
 * Call Analysis Results View - Placeholder for Analysis 2.0
 * 
 * This component is being rebuilt as part of the Analysis 2.0 upgrade.
 * The legacy analysis rendering has been removed.
 */
export function CallAnalysisResultsView({ 
  call, 
  analysis, 
  isOwner, 
  isManager,
  onRetryAnalysis,
  onDeleteCall,
  isRetrying = false,
  isDeleting = false,
}: CallAnalysisResultsViewProps) {
  
  // Error state with recovery options - show regardless of partial analysis data
  if (call?.analysis_status === 'error') {
    return (
      <Card className="border-destructive">
        <CardContent className="py-8">
          <div className="space-y-6">
            <div className="flex items-center gap-3 text-destructive">
              <AlertTriangle className="h-8 w-8" />
              <div>
                <h3 className="font-semibold text-lg">Analysis Failed</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {call.analysis_error || 'An error occurred while analyzing this call.'}
                </p>
              </div>
            </div>

            {(isOwner || isManager) && (
              <div className="flex flex-wrap gap-3 pt-2">
                <Button 
                  onClick={onRetryAnalysis} 
                  disabled={isRetrying || isDeleting}
                >
                  {isRetrying ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Retrying...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Retry Analysis
                    </>
                  )}
                </Button>

                {isOwner && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" disabled={isRetrying || isDeleting}>
                        {isDeleting ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Deleting...
                          </>
                        ) : (
                          <>
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete & Resubmit
                          </>
                        )}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete this call?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete this call transcript. You can then resubmit the transcript with any corrections if needed.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={onDeleteCall} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                          Delete Call
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            )}

            {!isOwner && !isManager && (
              <p className="text-sm text-muted-foreground">
                Contact the call owner to retry or delete this transcript.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Loading state for pending/processing - show animated progress with force retry option
  if (!analysis && (call?.analysis_status === 'pending' || call?.analysis_status === 'processing')) {
    // Check if stuck (created more than 2 minutes ago and still pending/processing)
    const createdAt = call?.created_at ? new Date(call.created_at) : null;
    const isStuck = createdAt && (Date.now() - createdAt.getTime() > 2 * 60 * 1000);
    
    return (
      <div className="space-y-4">
        <AnalysisProgress isComplete={false} />
        {isStuck && (isOwner || isManager) && onRetryAnalysis && (
          <Card className="border-amber-500/50 bg-amber-500/5">
            <CardContent className="py-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="h-5 w-5" />
                  <span className="text-sm font-medium">Taking longer than expected?</span>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={onRetryAnalysis}
                  disabled={isRetrying}
                >
                  {isRetrying ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Retrying...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Force Retry
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // No analysis and not in progress - shouldn't normally reach here
  if (!analysis) {
    return null;
  }

  // Analysis completed - the CallAnalysisLayout component handles rendering
  // This component should not be reached for completed analyses
  return null;
}
