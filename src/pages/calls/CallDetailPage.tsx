import { useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { createLogger } from '@/lib/logger';

const log = createLogger('CallDetailPage');
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { PageBreadcrumb } from '@/components/ui/page-breadcrumb';
import { CallAnalysisPageSkeleton } from '@/components/ui/skeletons';
import { CallAnalysis, CallTranscript } from '@/api/aiCallAnalysis';
import { CallAnalysisResultsView } from '@/components/calls/CallAnalysisResultsView';
import { CallProductsSummary } from '@/components/calls/CallProductsSummary';
import { EditCallDetailsDialog } from '@/components/calls/EditCallDetailsDialog';
import { EditUserCountsDialog } from '@/components/calls/EditUserCountsDialog';
import { BehaviorScorecard, PainToPitchAlignment, CriticalGapsPanel, ObjectionHandlingPanel, CompetitiveIntelPanel } from '@/components/analysis';
import { PricingDisciplineCard } from '@/components/calls/PricingDisciplineCard';
import { SalesAssetsGenerator } from '@/components/calls/SalesAssetsGenerator';
import { CallAnalysisLayout } from '@/components/calls/CallAnalysisLayout';
import { TranscriptViewer } from '@/components/calls/TranscriptViewer';
import { CoachingCard } from '@/components/calls/coaching';
import { DealHeatCard } from '@/components/calls/DealHeatCard';
import { SalesCoachChat } from '@/components/prospects/SalesCoachChat';
import { PostCallSuggestionsPanel, PostCallSuggestionsSkeleton, AddCustomTaskDialog } from '@/components/calls/suggestions';
import type { FollowUpSuggestion } from '@/components/calls/suggestions';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Skeleton } from '@/components/ui/skeleton';
import { CallType, callTypeLabels } from '@/constants/callTypes';
import { format } from 'date-fns';
import { getDashboardUrl, getCallHistoryUrl, getAccountDetailUrl, getCallDetailUrl } from '@/lib/routes';
import { getCallDetailBreadcrumbs } from '@/lib/breadcrumbConfig';
import { withPageErrorBoundary } from '@/components/ui/page-error-boundary';
import { formatCurrency, parseDateOnly } from '@/lib/formatters';
import { useCallWithAnalysis, useAnalysisPolling, callDetailKeys, useRetryAnalysis, useDeleteFailedCall, useUpdateCallTranscript, useUpdateAnalysisUserCounts, useReanalyzeCall, useCallProducts } from '@/hooks/useCallDetailQueries';
import { downloadCallDetailCSV, CallExportData } from '@/lib/callDetailExport';
import { useCallAnalysisRealtime } from '@/hooks/useCallAnalysisRealtime';
import { useAudioAnalysis } from '@/hooks/sdr/audioHooks';
import { AudioAnalysisTab } from '@/components/audio-analysis/AudioAnalysisTab';
import { getStakeholdersForCall, influenceLevelLabels } from '@/api/stakeholders';
import type { CallMetadata } from '@/utils/analysis-schemas';
import { HeatScoreBadge } from '@/components/ui/heat-score-badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
  Users,
  ChevronDown,
  ScrollText,
  Crown,
  ChevronRight,
  Download,
  ListTodo,
  Check,
  Lightbulb,
  Flame,
  Target,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  ArrowUpRight,
  ArrowDownRight,
  GraduationCap,
} from 'lucide-react';

function CallDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, role } = useAuth();
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

  // Poll for analysis when needed (fallback for real-time)
  const { data: polledAnalysis } = useAnalysisPolling(id, shouldPoll);

  // Use polled analysis if available, otherwise use initial analysis
  const transcript = callData?.transcript;
  const analysis = polledAnalysis || callData?.analysis || null;

  // Determine if we should listen for real-time updates
  // Keep listening until suggestions arrive (they come ~30-60s after analysis completes)
  const shouldListenForUpdates = useMemo(() => {
    if (!callData?.transcript) return false;
    const status = callData.transcript.analysis_status;
    
    // Always listen during pending/processing
    if (status === 'pending' || status === 'processing') return true;
    
    // After completion, keep listening until suggestions arrive
    if (status === 'completed') {
      const hasSuggestions = Array.isArray(analysis?.follow_up_suggestions) && 
                             analysis.follow_up_suggestions.length > 0;
      return !hasSuggestions;
    }
    
    return false;
  }, [callData?.transcript, analysis?.follow_up_suggestions]);

  // Real-time subscription for instant updates when analysis completes AND for post-analysis data
  useCallAnalysisRealtime(id, shouldListenForUpdates);

  const isOwner = transcript?.rep_id === user?.id;
  const isManager = role === 'manager' || role === 'admin';

  // Retry, delete, update, and reanalyze mutations
  const retryMutation = useRetryAnalysis(id || '');
  const deleteMutation = useDeleteFailedCall(id || '', role);
  const updateMutation = useUpdateCallTranscript(id || '');
  const updateUserCountsMutation = useUpdateAnalysisUserCounts(id || '', analysis?.id);
  const reanalyzeMutation = useReanalyzeCall(id || '');

  // Fetch stakeholders for this call
  const { data: callStakeholders = [] } = useQuery({
    queryKey: ['call-stakeholders', id],
    queryFn: () => getStakeholdersForCall(id!),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch products for this call (needed for CSV export)
  const { data: callProducts = [] } = useCallProducts(id);

  // Fetch voice analysis to check if audio data exists
  const { data: audioAnalysisData } = useAudioAnalysis(id);
  const hasAudioAnalysis = !!(
    audioAnalysisData &&
    audioAnalysisData.processing_stage !== 'error' &&
    (audioAnalysisData.metrics || audioAnalysisData.coaching || audioAnalysisData.audio_file_path)
  );

  // Edit dialog states
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isUserCountsDialogOpen, setIsUserCountsDialogOpen] = useState(false);
  const [isTranscriptOpen, setIsTranscriptOpen] = useState(false);
  const [isRecapDialogOpen, setIsRecapDialogOpen] = useState(false);
  const [isAddTaskDialogOpen, setIsAddTaskDialogOpen] = useState(false);

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

  // Export call details to CSV
  const handleExportCSV = () => {
    if (!transcript) return;
    
    const metadata = analysis?.analysis_metadata as CallMetadata | null;
    const exportData: CallExportData = {
      accountName: transcript.account_name,
      callDate: transcript.call_date,
      callType: getCallTypeDisplay(transcript),
      stakeholderName: transcript.primary_stakeholder_name,
      potentialRevenue: transcript.potential_revenue,
      salesforceLink: transcript.salesforce_demo_link,
      summary: metadata?.summary || analysis?.call_summary || null,
      topics: metadata?.topics || null,
      products: callProducts.map(p => ({
        name: p.products?.name || 'Unknown Product',
        quantity: p.quantity,
        unitPrice: p.unit_price,
      })),
    };
    
    const sanitizedAccountName = (transcript.account_name || 'Call').replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `${sanitizedAccountName}_${transcript.call_date}.csv`;
    downloadCallDetailCSV(exportData, filename);
    toast.success('Call details exported to CSV');
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
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="hidden md:flex" onClick={() => navigate(getBackPath())} aria-label="Go back to call history">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold truncate">
                {callTitle}
              </h1>
              <p className="text-muted-foreground text-sm sm:text-base">
                Full AI coaching breakdown for this call
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExportCSV} aria-label="Export call details to CSV" className="min-h-[44px] md:min-h-0">
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
            {(transcript.analysis_status === 'pending' || transcript.analysis_status === 'processing' || shouldPoll) && (
              <Button variant="outline" onClick={handleRefresh} disabled={isLoading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${shouldPoll ? 'animate-spin' : ''}`} />
                {shouldPoll ? 'Analyzing...' : 'Refresh'}
              </Button>
            )}
          </div>
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
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
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

              {/* Stakeholders on this call */}
              {callStakeholders.length > 0 ? (
                <div className="flex items-start gap-2 sm:col-span-2 lg:col-span-3">
                  <Users className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground mb-1">Stakeholders on Call</p>
                    <div className="flex flex-wrap gap-2">
                      {callStakeholders.map(({ stakeholder }, index) => (
                        <Badge key={stakeholder.id} variant="secondary" className="flex items-center gap-1">
                          {index === 0 && <Crown className="h-3 w-3 text-amber-500" />}
                          <span>{stakeholder.name}</span>
                          {stakeholder.influence_level && (
                            <span className="text-muted-foreground text-xs">
                              ({influenceLevelLabels[stakeholder.influence_level]})
                            </span>
                          )}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              ) : transcript.primary_stakeholder_name && (
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
                    {transcript.prospect_id ? (
                      <Link 
                        to={getAccountDetailUrl(role, transcript.prospect_id)}
                        className="font-medium text-primary hover:underline"
                      >
                        {transcript.account_name}
                      </Link>
                    ) : (
                      <p className="font-medium">{transcript.account_name}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Call Date */}
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Date</p>
                  <p className="font-medium">{format(parseDateOnly(transcript.call_date), 'MMMM d, yyyy')}</p>
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
                    transcript.analysis_status === 'skipped' ? 'outline' :
                    'secondary'
                  }>
                    {transcript.analysis_status === 'processing' || shouldPoll 
                      ? 'Analyzing...' 
                      : transcript.analysis_status === 'skipped'
                      ? 'Indexed Only'
                      : transcript.analysis_status.charAt(0).toUpperCase() + transcript.analysis_status.slice(1)}
                  </Badge>
                </div>
              </div>

              {/* Deal Heat Score - Quick at-a-glance */}
              {analysis?.deal_heat_analysis && (
                <div className="flex items-center gap-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Deal Heat</p>
                    <HeatScoreBadge 
                      score={(analysis.deal_heat_analysis as { heat_score?: number })?.heat_score ?? null} 
                      variant="default" 
                    />
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Quick Access: Recap Assets & Add Task - Right below Call Information */}
        {transcript.analysis_status === 'completed' && analysis && (
          <div className="flex flex-col sm:flex-row gap-2">
            <Dialog open={isRecapDialogOpen} onOpenChange={setIsRecapDialogOpen}>
              <DialogTrigger asChild>
                <button className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-card hover:bg-muted/50 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring w-full sm:w-auto min-h-[44px]">
                  <ScrollText className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">
                    {analysis?.sales_assets ? 'View Call Notes' : 'Generate Call Notes'}
                  </span>
                  {analysis?.sales_assets && (
                    <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                      <Check className="h-3 w-3" />
                    </Badge>
                  )}
                  <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto" />
                </button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-2xl md:max-w-3xl lg:max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <ScrollText className="h-5 w-5 text-primary" />
                    Call Notes
                  </DialogTitle>
                </DialogHeader>
                <SalesAssetsGenerator
                  callId={transcript.id}
                  transcript={transcript.raw_text}
                  strategicContext={analysis.analysis_strategy || null}
                  existingAssets={analysis.sales_assets || null}
                  accountName={transcript.account_name}
                  stakeholderName={transcript.primary_stakeholder_name}
                />
              </DialogContent>
            </Dialog>

            {/* Add Task Button */}
            {transcript.prospect_id && user?.id && (
              <>
                <button
                  onClick={() => setIsAddTaskDialogOpen(true)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-card hover:bg-muted/50 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring w-full sm:w-auto min-h-[44px]"
                >
                  <ListTodo className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Add Task</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto" />
                </button>
                <AddCustomTaskDialog
                  open={isAddTaskDialogOpen}
                  onOpenChange={setIsAddTaskDialogOpen}
                  prospectId={transcript.prospect_id}
                  repId={user.id}
                  callId={transcript.id}
                  accountName={transcript.account_name}
                  onTaskCreated={() => {
                    toast.success('Task created successfully');
                  }}
                />
              </>
            )}

            {/* Start Coaching Session Button - Manager only */}
            {isManager && (
              <Link
                to={`/manager/coaching?callId=${transcript.id}&repId=${transcript.rep_id}`}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-card hover:bg-muted/50 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring w-full sm:w-auto min-h-[44px]"
              >
                <GraduationCap className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Start Coaching Session</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto" />
              </Link>
            )}
          </div>
        )}

        {/* Call Summary Card - Quick overview at a glance */}
        {transcript.analysis_status === 'completed' && analysis && (() => {
          const coaching = analysis.analysis_coaching;
          const heatData = analysis.deal_heat_analysis as { heat_score?: number; temperature?: string; trend?: string } | null;
          const suggestions = analysis.follow_up_suggestions as unknown as FollowUpSuggestion[] | null;
          const topSuggestion = suggestions?.find(s => s.status === 'pending');

          return (coaching || heatData || topSuggestion) ? (
            <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Lightbulb className="h-5 w-5 text-primary" />
                  Call Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                  {/* Key Coaching Insight */}
                  {coaching && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Key Insight</p>
                      <p className="text-sm text-foreground leading-snug">{coaching.coaching_prescription}</p>
                      <Badge variant="secondary" className="text-xs mt-1">{coaching.primary_focus_area}</Badge>
                    </div>
                  )}

                  {/* Deal Heat Score with Trend */}
                  {heatData?.heat_score != null && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Deal Heat</p>
                      <div className="flex items-center gap-3">
                        <HeatScoreBadge score={heatData.heat_score} variant="card" />
                        {coaching?.deal_progression?.heat_trend && (
                          <div className="flex items-center gap-1 text-sm font-medium">
                            {coaching.deal_progression.heat_trend === 'up' && <ArrowUpRight className="h-4 w-4 text-green-600" />}
                            {coaching.deal_progression.heat_trend === 'down' && <ArrowDownRight className="h-4 w-4 text-red-600" />}
                            {coaching.deal_progression.heat_trend === 'flat' && <ArrowRight className="h-4 w-4 text-muted-foreground" />}
                            <span className="text-xs capitalize text-muted-foreground">{coaching.deal_progression.heat_trend}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* #1 Next Action */}
                  {topSuggestion && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Top Next Action</p>
                      <div className="flex items-start gap-2">
                        <Target className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                        <p className="text-sm text-foreground leading-snug">{topSuggestion.title}</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : null;
        })()}

        {/* AI Coaching Synthesis Card */}
        {(transcript.analysis_status === 'pending' || transcript.analysis_status === 'processing') && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                Generating Coaching Insights...
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-16 w-full" />
              <div className="grid grid-cols-2 gap-4">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            </CardContent>
          </Card>
        )}
        {transcript.analysis_status === 'completed' && analysis?.analysis_coaching && (
          <CoachingCard data={analysis.analysis_coaching} defaultOpen={false} />
        )}

        {/* AI-Powered Follow-Up Suggestions - appears after coaching insights */}
        {transcript.analysis_status === 'completed' && analysis?.follow_up_suggestions && transcript.prospect_id && user?.id && (
          <PostCallSuggestionsPanel
            callId={transcript.id}
            prospectId={transcript.prospect_id}
            repId={transcript.rep_id}
            accountName={transcript.account_name}
            suggestions={analysis.follow_up_suggestions as unknown as FollowUpSuggestion[]}
            analysisId={analysis.id}
          />
        )}

        {/* Deal Heat Analysis - positioned prominently above products */}
        {transcript.analysis_status === 'completed' && analysis && (
          <DealHeatCard
            transcript={transcript.raw_text}
            strategyData={analysis.analysis_strategy}
            behaviorData={analysis.analysis_behavior}
            metadataData={analysis.analysis_metadata}
            existingHeatData={analysis.deal_heat_analysis}
            callId={transcript.id}
          />
        )}

        {/* Products Summary */}
        <CallProductsSummary callId={id!} prospectId={transcript.prospect_id} isOwner={isOwner} />

        {/* Coaching Cockpit - Analysis 2.0 Layout */}
        {transcript.analysis_status === 'completed' && analysis && (
          <CallAnalysisLayout
            transcript={transcript}
            analysis={analysis}
            canEdit={isOwner || isManager}
            onEditUserCounts={() => setIsUserCountsDialogOpen(true)}
            onReanalyze={() => reanalyzeMutation.mutate()}
            isReanalyzing={reanalyzeMutation.isPending}
            hasAudioAnalysis={hasAudioAnalysis}
            audioContent={
              hasAudioAnalysis ? (
                <AudioAnalysisTab
                  transcriptId={transcript.id}
                  audioFilePath={audioAnalysisData?.audio_file_path ?? null}
                  pipeline="full_cycle"
                />
              ) : undefined
            }
            behaviorContent={<BehaviorScorecard data={analysis.analysis_behavior} />}
            strategyContent={
              <div className="space-y-6">
                <PainToPitchAlignment data={analysis.analysis_strategy} />
                <ObjectionHandlingPanel data={analysis.analysis_strategy?.objection_handling} />
                <PricingDisciplineCard data={analysis.analysis_pricing} />
              </div>
            }
            hazardsContent={
              <div className="space-y-6">
                <CriticalGapsPanel data={analysis.analysis_strategy} />
                <CompetitiveIntelPanel data={analysis.analysis_strategy?.competitive_intel} />
              </div>
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

        {/* Raw Transcript Section - Collapsible at bottom */}
        <Collapsible open={isTranscriptOpen} onOpenChange={setIsTranscriptOpen}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors min-h-[44px]">
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <ScrollText className="h-5 w-5" />
                    Raw Transcript
                  </span>
                  <ChevronDown className={`h-5 w-5 transition-transform duration-200 ${isTranscriptOpen ? 'rotate-180' : ''}`} />
                </CardTitle>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent>
                <TranscriptViewer 
                  transcriptText={transcript.raw_text} 
                  canEdit={isOwner || isManager}
                  onSave={(newText) => {
                    updateMutation.mutate({ raw_text: newText }, {
                      onSuccess: () => {
                        toast.success('Transcript updated successfully');
                      },
                    });
                  }}
                  isSaving={updateMutation.isPending}
                />
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Sales Coach Chat - Same session as Account Detail page */}
        {transcript.prospect_id && (
          <SalesCoachChat 
            prospectId={transcript.prospect_id} 
            accountName={transcript.account_name || 'Unknown Account'} 
          />
        )}

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
