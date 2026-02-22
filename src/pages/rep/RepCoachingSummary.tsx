import { getRepDetailUrl } from '@/lib/routes';
import { getCoachingSummaryBreadcrumbs } from '@/lib/breadcrumbConfig';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageBreadcrumb } from '@/components/ui/page-breadcrumb';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { GitCompare } from 'lucide-react';
import { CoachingTrendsComparison } from '@/components/coaching/CoachingTrendsComparison';
import { lazy, Suspense } from 'react';
const CoachingTrendHistorySheet = lazy(() => import('@/components/coaching/CoachingTrendHistorySheet').then(m => ({ default: m.CoachingTrendHistorySheet })));
const ExportShareDialog = lazy(() => import('@/components/coaching/ExportShareDialog').then(m => ({ default: m.ExportShareDialog })));
import { PriorityActionCard } from '@/components/coaching/PriorityActionCard';

import {
  useCoachingSummaryState,
  CoachingSummaryHeader,
  DateRangeControls,
  InitialStateCard,
  LoadingState,
  ErrorState,
  ExecutiveSummaryCard,
  FrameworkTrendsSection,
  PatternAnalysisSection,
} from './coaching-summary';

export default function RepCoachingSummary() {
  const state = useCoachingSummaryState();

  const {
    role,
    repId,
    targetRepId,
    isOwnSummary,
    repProfile,
    dateRange,
    selectedPreset,
    comparisonDateRange,
    comparisonPreset,
    generateRequested,
    isComparisonMode,
    comparisonConfirmed,
    showHistory,
    setShowHistory,
    showExportDialog,
    setShowExportDialog,
    loadedAnalysis,
    historyComparisonAnalysis,
    error,
    comparisonError,
    isComparisonFetching,
    dataUpdatedAt,
    callCountPreview,
    isLoadingCallCount,
    isAnyLoading,
    isAnyFetching,
    periodValidation,
    hasValidationErrors,
    currentMetadata,
    comparisonAnalysis,
    displayAnalysis,
    previewTier,
    handlePresetChange,
    handleFromDateChange,
    handleToDateChange,
    handleComparisonPresetChange,
    handleComparisonFromDateChange,
    handleComparisonToDateChange,
    handleComparisonToggle,
    handleForceRefresh,
    handleGenerateTrends,
    handleLoadFromHistory,
    handleCompareFromHistory,
    handleExitHistoryComparison,
    handleRunComparison,
    setComparisonDateRange,
    setComparisonConfirmed,
  } = state;

  const getBreadcrumbItems = () => {
    if ((role === 'manager' || role === 'admin') && repId) {
      return getCoachingSummaryBreadcrumbs(role, repProfile?.name || 'Rep', getRepDetailUrl(repId));
    }
    return getCoachingSummaryBreadcrumbs(role);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Breadcrumb Navigation */}
        <PageBreadcrumb items={getBreadcrumbItems()} />

        {/* Header */}
        <div className="flex flex-col gap-4">
          <CoachingSummaryHeader
            isOwnSummary={isOwnSummary}
            repName={repProfile?.name}
            generateRequested={generateRequested}
            loadedAnalysis={loadedAnalysis}
            displayAnalysis={displayAnalysis}
            isComparisonMode={isComparisonMode}
            isAnyFetching={isAnyFetching}
            onComparisonToggle={handleComparisonToggle}
            onRefresh={handleForceRefresh}
            onShowHistory={() => setShowHistory(true)}
            onShowExport={() => setShowExportDialog(true)}
          />
          
          {/* Date Range Controls */}
          <DateRangeControls
            dateRange={dateRange}
            selectedPreset={selectedPreset}
            onPresetChange={handlePresetChange}
            onFromDateChange={handleFromDateChange}
            onToDateChange={handleToDateChange}
            isComparisonMode={isComparisonMode}
            comparisonDateRange={comparisonDateRange}
            comparisonPreset={comparisonPreset}
            comparisonConfirmed={comparisonConfirmed}
            isComparisonFetching={isComparisonFetching}
            hasValidationErrors={hasValidationErrors}
            periodValidation={periodValidation}
            onComparisonPresetChange={handleComparisonPresetChange}
            onComparisonFromDateChange={handleComparisonFromDateChange}
            onComparisonToDateChange={handleComparisonToDateChange}
            onRunComparison={handleRunComparison}
            setComparisonDateRange={setComparisonDateRange}
            setComparisonPreset={handleComparisonPresetChange}
            setComparisonConfirmed={setComparisonConfirmed}
          />
        </div>

        {/* Content States */}
        {!generateRequested && !loadedAnalysis ? (
          <InitialStateCard
            callCountPreview={callCountPreview}
            isLoadingCallCount={isLoadingCallCount}
            previewTier={previewTier}
            onGenerate={handleGenerateTrends}
          />
        ) : isAnyLoading ? (
          <LoadingState
            isComparisonMode={isComparisonMode}
            comparisonConfirmed={comparisonConfirmed}
          />
        ) : error || (isComparisonMode && comparisonConfirmed && comparisonError) ? (
          <ErrorState
            error={error}
            comparisonError={comparisonError}
            isOwnSummary={isOwnSummary}
          />
        ) : historyComparisonAnalysis && displayAnalysis ? (
          /* History Comparison View */
          <div className="space-y-4">
            <Alert className="border-primary/50 bg-primary/5">
              <GitCompare className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between">
                <span>Comparing snapshot from history with current analysis</span>
                <Button variant="outline" size="sm" onClick={handleExitHistoryComparison}>
                  Exit Comparison
                </Button>
              </AlertDescription>
            </Alert>
            <CoachingTrendsComparison
              periodA={{
                label: 'Snapshot (Earlier)',
                dateRange: historyComparisonAnalysis.dateRange,
                analysis: historyComparisonAnalysis.analysis,
              }}
              periodB={{
                label: 'Current Period',
                dateRange: dateRange,
                analysis: displayAnalysis,
              }}
            />
          </div>
        ) : isComparisonMode && comparisonConfirmed && displayAnalysis && comparisonAnalysis ? (
          /* Comparison View */
          <CoachingTrendsComparison
            periodA={{
              label: 'Period A',
              dateRange: comparisonDateRange,
              analysis: comparisonAnalysis,
            }}
            periodB={{
              label: 'Period B',
              dateRange: dateRange,
              analysis: displayAnalysis,
            }}
          />
        ) : displayAnalysis && (
          /* Single Period View */
          <>
            <ExecutiveSummaryCard
              analysis={displayAnalysis}
              metadata={currentMetadata}
              dataUpdatedAt={dataUpdatedAt}
              loadedAnalysis={loadedAnalysis}
            />

            <FrameworkTrendsSection analysis={displayAnalysis} />

            <PatternAnalysisSection analysis={displayAnalysis} />

            <PriorityActionCard priorities={displayAnalysis.topPriorities} />
          </>
        )}
      </div>
      
      {/* History Sheet */}
      {showHistory && (
        <Suspense fallback={null}>
          <CoachingTrendHistorySheet
            open={showHistory}
            onOpenChange={setShowHistory}
            repId={targetRepId!}
            onLoadAnalysis={handleLoadFromHistory}
            onCompareWithCurrent={handleCompareFromHistory}
            hasCurrentAnalysis={!!displayAnalysis}
          />
        </Suspense>
      )}

      {/* Export Dialog */}
      {displayAnalysis && showExportDialog && (
        <Suspense fallback={null}>
          <ExportShareDialog
            open={showExportDialog}
            onOpenChange={setShowExportDialog}
            analysis={displayAnalysis}
            dateRange={dateRange}
            repName={isOwnSummary ? undefined : repProfile?.name}
          />
        </Suspense>
      )}
    </AppLayout>
  );
}
