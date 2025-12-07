import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, AlertTriangle, RefreshCw, Trash2, Sparkles } from 'lucide-react';
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
  
  // Error state with recovery options
  if (!analysis && call?.analysis_status === 'error') {
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

            {isOwner && (
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
              </div>
            )}

            {!isOwner && (
              <p className="text-sm text-muted-foreground">
                Contact the call owner to retry or delete this transcript.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Loading state for pending/processing
  if (!analysis) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <div className="space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto" />
            <div>
              <p className="text-muted-foreground">Analysis in progress...</p>
              {call?.analysis_status === 'processing' && (
                <p className="text-sm text-muted-foreground mt-2">Your call is being analyzed by AI. This usually takes 30-60 seconds.</p>
              )}
              {call?.analysis_status === 'pending' && (
                <p className="text-sm text-muted-foreground mt-2">Your call is queued for analysis.</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ============================================================
  // ANALYSIS 2.0 PLACEHOLDER
  // The legacy analysis rendering has been removed.
  // This component will be rebuilt with the new data structure.
  // ============================================================
  return (
    <Card className="border-dashed border-2 border-primary/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Analysis 2.0 Coming Soon
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <p className="text-muted-foreground">
            We're upgrading our call analysis system. The new analysis view will be available shortly.
          </p>
          
          {/* Basic summary from existing data (if available) */}
          {analysis.call_summary && (
            <div className="bg-muted/30 rounded-lg p-4">
              <h4 className="font-medium mb-2">Call Summary</h4>
              <p className="text-sm text-muted-foreground">{analysis.call_summary}</p>
            </div>
          )}
          
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">Model: {analysis.model_name}</Badge>
            <Badge variant="outline">Version: {analysis.prompt_version}</Badge>
            {isManager && <Badge variant="secondary">Read-only</Badge>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
