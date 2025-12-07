import { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { createLogger } from '@/lib/logger';

const log = createLogger('CallDetailPage');
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { PageBreadcrumb } from '@/components/ui/page-breadcrumb';
import { CallAnalysisPageSkeleton } from '@/components/ui/skeletons';
import { CallAnalysis, CallTranscript } from '@/api/aiCallAnalysis';
import { CallAnalysisResultsView } from '@/components/calls/CallAnalysisResultsView';
import { CallProductsSummary } from '@/components/calls/CallProductsSummary';
import { EditCallDetailsDialog } from '@/components/calls/EditCallDetailsDialog';
import { EditUserCountsDialog } from '@/components/calls/EditUserCountsDialog';
import { BehaviorScorecard } from '@/components/analysis/BehaviorScorecard';
import { StrategicRelevanceMap } from '@/components/analysis/StrategicRelevanceMap';
import { SalesAssetsGenerator } from '@/components/calls/SalesAssetsGenerator';
import { CallAnalysisLayout } from '@/components/calls/CallAnalysisLayout';
import { CallType, callTypeLabels } from '@/constants/callTypes';
import { format } from 'date-fns';
import { getDashboardUrl, getCallHistoryUrl } from '@/lib/routes';
import { getCallDetailBreadcrumbs } from '@/lib/breadcrumbConfig';
import { withPageErrorBoundary } from '@/components/ui/page-error-boundary';
import { formatCurrency } from '@/lib/formatters';
import { useCallWithAnalysis, useAnalysisPolling, callDetailKeys, useRetryAnalysis, useDeleteFailedCall, useUpdateCallTranscript, useUpdateAnalysisUserCounts } from '@/hooks/useCallDetailQueries';
import type { CallMetadata } from '@/utils/analysis-schemas';
import { 
  ArrowLeft, 
  Calendar, 
  Loader2, 
  ShieldAlert,
  FileText,
  RefreshCw,
  ExternalLink,
  DollarSign,
  Building,
  User,
  Pencil,
  Users
} from 'lucide-react';

function CallDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch call with analysis
  const { 
    data: callData, 
    isLoading, 
    error,
    isError 
  } = useCallWithAnalysis(id, user?.id, role || undefined);

  // Determine if we should poll for analysis
  const shouldPoll = useMemo(() => {
    if (!callData?.transcript) return false;
    const status = callData.transcript.analysis_status;
    return status === 'pending' || status === 'processing';
  }, [callData?.transcript]);

  // Poll for analysis when needed
  const { data: polledAnalysis } = useAnalysisPolling(id, shouldPoll);

  // Use polled analysis if available, otherwise use initial analysis
  const transcript = callData?.transcript;
  const analysis = polledAnalysis || callData?.analysis || null;

  const isOwner = transcript?.rep_id === user?.id;
  const isManager = role === 'manager' || role === 'admin';

  // Retry, delete, and update mutations
  const retryMutation = useRetryAnalysis(id || '');
  const deleteMutation = useDeleteFailedCall(id || '', role);
  const updateMutation = useUpdateCallTranscript(id || '');
  const updateUserCountsMutation = useUpdateAnalysisUserCounts(id || '', analysis?.id);

  // Edit dialog states
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isUserCountsDialogOpen, setIsUserCountsDialogOpen] = useState(false);

  // Extract current user counts from analysis metadata
  const currentUserCounts = useMemo(() => {
    const metadata = analysis?.analysis_metadata as CallMetadata | null;
    return {
      itUsers: metadata?.user_counts?.it_users ?? null,
      endUsers: metadata?.user_counts?.end_users ?? null,
    };
  }, [analysis?.analysis_metadata]);

  const getBackPath = () => getCallHistoryUrl(role);

  const handleRefresh = () => {
    if (!id) return;
    queryClient.invalidateQueries({ queryKey: callDetailKeys.call(id) });
    queryClient.invalidateQueries({ queryKey: callDetailKeys.analysis(id) });
  };

  // Handle error states
  if (isError) {
    const isNotAuthorized = error?.message === 'Not authorized to view this call';
    const isNotFound = error?.message === 'Call not found';

    if (isNotAuthorized) {
      return (
        <AppLayout>
          <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
            <ShieldAlert className="h-16 w-16 text-destructive" />
            <h1 className="text-2xl font-bold">Not Authorized</h1>
            <p className="text-muted-foreground">You are not authorized to view this call.</p>
            <Button onClick={() => navigate(getBackPath())}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          </div>
        </AppLayout>
      );
    }

    if (isNotFound) {
      return (
        <AppLayout>
          <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
            <h1 className="text-2xl font-bold">Call Not Found</h1>
            <Button onClick={() => navigate(getBackPath())}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          </div>
        </AppLayout>
      );
    }
  }

  const getCallTypeDisplay = (t: CallTranscript) => {
    if (t.call_type === 'other' && t.call_type_other) {
      return t.call_type_other;
    }
    if (t.call_type) {
      return callTypeLabels[t.call_type as CallType] || t.call_type;
    }
    return null;
  };

  if (isLoading) {
    return (
      <AppLayout>
        <CallAnalysisPageSkeleton />
      </AppLayout>
    );
  }

  if (!transcript) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <h1 className="text-2xl font-bold">Call Not Found</h1>
          <Button onClick={() => navigate(getBackPath())}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </div>
      </AppLayout>
    );
  }

  const callTitle = transcript.primary_stakeholder_name && transcript.account_name 
    ? `${transcript.primary_stakeholder_name} - ${transcript.account_name}`
    : transcript.account_name || transcript.primary_stakeholder_name || transcript.notes || 'Call Details';

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Breadcrumb Navigation */}
        <PageBreadcrumb items={getCallDetailBreadcrumbs(role, callTitle)} />

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(getBackPath())} aria-label="Back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">
                {callTitle}
              </h1>
              <p className="text-muted-foreground">
                Full AI coaching breakdown for this call
              </p>
            </div>
          </div>
          {(transcript.analysis_status === 'pending' || transcript.analysis_status === 'processing' || shouldPoll) && (
            <Button variant="outline" onClick={handleRefresh} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${shouldPoll ? 'animate-spin' : ''}`} />
              {shouldPoll ? 'Analyzing...' : 'Refresh'}
            </Button>
          )}
        </div>

        {/* Call Metadata */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Call Information
            </CardTitle>
            {(isOwner || isManager) && (
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setIsEditDialogOpen(true)}
                aria-label="Edit call details"
              >
                <Pencil className="h-4 w-4" />
              </Button>
            )}
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {/* Sales Rep */}
              {transcript.rep_name && (
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground">Sales Rep</p>
                    <p className="font-medium">{transcript.rep_name}</p>
                  </div>
                </div>
              )}

              {/* Primary Stakeholder Name */}
              {transcript.primary_stakeholder_name && (
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Primary Stakeholder</p>
                    <p className="font-medium">{transcript.primary_stakeholder_name}</p>
                  </div>
                </div>
              )}

              {/* Account Name */}
              {transcript.account_name && (
                <div className="flex items-center gap-2">
                  <Building className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Account</p>
                    <p className="font-medium">{transcript.account_name}</p>
                  </div>
                </div>
              )}

              {/* Call Date */}
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Date</p>
                  <p className="font-medium">{format(new Date(transcript.call_date), 'MMMM d, yyyy')}</p>
                </div>
              </div>

              {/* Call Type */}
              {getCallTypeDisplay(transcript) && (
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Call Type</p>
                    <Badge variant="outline">{getCallTypeDisplay(transcript)}</Badge>
                  </div>
                </div>
              )}

              {/* Potential Revenue */}
              {transcript.potential_revenue && (
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Potential Revenue</p>
                    <p className="font-medium">{formatCurrency(transcript.potential_revenue)}</p>
                  </div>
                </div>
              )}

              {/* Salesforce Link */}
              {transcript.salesforce_demo_link && (
                <div className="flex items-center gap-2">
                  <ExternalLink className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Salesforce Account</p>
                    <a 
                      href={transcript.salesforce_demo_link} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary hover:underline font-medium flex items-center gap-1"
                    >
                      Open Link
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              )}

              {/* Manager on Call */}
              {transcript.manager_id && (
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground">Manager Present</p>
                    <Badge variant="outline" className="border-primary/50 text-primary">
                      Manager on Call
                    </Badge>
                  </div>
                </div>
              )}

              {/* Status */}
              <div className="flex items-center gap-2">
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <Badge variant={
                    transcript.analysis_status === 'completed' ? 'default' : 
                    transcript.analysis_status === 'error' ? 'destructive' : 
                    'secondary'
                  }>
                    {transcript.analysis_status === 'processing' || shouldPoll ? 'Analyzing...' : transcript.analysis_status}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Products Summary */}
        <CallProductsSummary callId={id!} prospectId={transcript.prospect_id} isOwner={isOwner} />

        {/* Coaching Cockpit - Analysis 2.0 Layout */}
        {transcript.analysis_status === 'completed' && analysis && (
          <CallAnalysisLayout
            transcript={transcript}
            analysis={analysis}
            canEdit={isOwner || isManager}
            onEditUserCounts={() => setIsUserCountsDialogOpen(true)}
            behaviorContent={<BehaviorScorecard data={analysis.analysis_behavior} />}
            strategyContent={<StrategicRelevanceMap data={analysis.analysis_strategy} />}
            recapContent={
              <SalesAssetsGenerator
                transcript={transcript.raw_text}
                strategicContext={analysis.analysis_strategy || null}
                callMetadata={analysis.analysis_metadata || null}
                accountName={transcript.account_name}
                stakeholderName={transcript.primary_stakeholder_name}
              />
            }
          />
        )}

        {/* Legacy Analysis Results - for error/pending states */}
        <CallAnalysisResultsView 
          call={transcript} 
          analysis={analysis} 
          isOwner={isOwner}
          isManager={isManager && !isOwner}
          onRetryAnalysis={() => retryMutation.mutate()}
          onDeleteCall={() => deleteMutation.mutate()}
          isRetrying={retryMutation.isPending}
          isDeleting={deleteMutation.isPending}
        />

        {/* Edit Call Details Dialog */}
        <EditCallDetailsDialog
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          transcript={transcript}
          onSave={(updates) => {
            updateMutation.mutate(updates, {
              onSuccess: () => setIsEditDialogOpen(false),
            });
          }}
          isSaving={updateMutation.isPending}
        />

        {/* Edit User Counts Dialog */}
        <EditUserCountsDialog
          open={isUserCountsDialogOpen}
          onOpenChange={setIsUserCountsDialogOpen}
          currentItUsers={currentUserCounts.itUsers}
          currentEndUsers={currentUserCounts.endUsers}
          onSave={(itUsers, endUsers) => {
            updateUserCountsMutation.mutate(
              { itUsers, endUsers },
              { onSuccess: () => setIsUserCountsDialogOpen(false) }
            );
          }}
          isSaving={updateUserCountsMutation.isPending}
        />
      </div>
    </AppLayout>
  );
}

export default withPageErrorBoundary(CallDetailPage, 'Call Details');
