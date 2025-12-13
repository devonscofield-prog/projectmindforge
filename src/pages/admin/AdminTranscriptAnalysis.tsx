import { AppLayout } from '@/components/layout/AppLayout';
import { Badge } from '@/components/ui/badge';
import { PageBreadcrumb } from '@/components/ui/page-breadcrumb';
import { getAdminPageBreadcrumb, getManagerPageBreadcrumb, getRepPageBreadcrumb } from '@/lib/breadcrumbConfig';
import { SaveSelectionDialog } from '@/components/admin/SaveSelectionDialog';
import { SavedSelectionsSheet } from '@/components/admin/SavedSelectionsSheet';
import { SavedInsightsSheet } from '@/components/admin/SavedInsightsSheet';
import { RAGHealthDashboard } from '@/components/admin/RAGHealthDashboard';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CollapsibleSection } from '@/components/ui/collapsible-section';
import { FileText, AlertCircle, Activity } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { withPageErrorBoundary } from '@/components/ui/page-error-boundary';
import {
  TranscriptFilters,
  TranscriptSelectionBar,
  TranscriptTable,
  useTranscriptAnalysis,
} from './transcript-analysis';

function AdminTranscriptAnalysis() {
  const { role } = useAuth();
  const isAdmin = role === 'admin';
  const isManager = role === 'manager';
  
  const {
    // Scope info
    isTeamScoped,
    isSelfScoped,
    managerTeam,
    
    // Filter state
    dateRange,
    selectedPreset,
    selectedTeamId,
    setSelectedTeamId,
    selectedRepId,
    setSelectedRepId,
    accountSearch,
    setAccountSearch,
    selectedCallTypes,
    selectedAnalysisStatus,
    setSelectedAnalysisStatus,
    
    // Data
    teams,
    reps,
    isLoadingTeams,
    isLoadingReps,
    transcripts,
    totalCount,
    totalPages,
    isLoading,
    chunkStatus,
    globalChunkStatus,
    
    // Selection
    selectedTranscriptIds,
    currentSelectionId,
    setCurrentSelectionId,
    selectedTranscripts,
    
    // UI state
    chatOpen,
    setChatOpen,
    saveSelectionOpen,
    setSaveSelectionOpen,
    savedSelectionsOpen,
    setSavedSelectionsOpen,
    savedInsightsOpen,
    setSavedInsightsOpen,
    isIndexing,
    isBackfilling,
    isBackfillingEmbeddings,
    isBackfillingEntities,
    isResetting,
    resetProgress,
    embeddingsProgress,
    entitiesProgress,
    isEmbeddingsJobStalled,
    isNERJobStalled,
    isReindexJobStalled,
    
    // Pagination
    currentPage,
    setCurrentPage,
    pageSize,
    
    // Computed
    estimatedTokens,
    analysisMode,
    
    // Handlers
    handlePresetChange,
    handleFromDateChange,
    handleToDateChange,
    toggleTranscript,
    selectAll,
    selectAllMatching,
    deselectAll,
    toggleCallType,
    handlePreIndex,
    handleBackfillAll,
    handleBackfillEmbeddings,
    handleBackfillEntities,
    stopEmbeddingsBackfill,
    stopNERBackfill,
    handleResetAndReindex,
    stopReindex,
    handleLoadSelection,
    handleDownloadTranscripts,
    isSelectingAll,
  } = useTranscriptAnalysis();

  const breadcrumbItems = isAdmin 
    ? getAdminPageBreadcrumb('transcriptAnalysis')
    : isManager
    ? getManagerPageBreadcrumb('transcriptAnalysis')
    : getRepPageBreadcrumb('transcriptAnalysis');

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Breadcrumb Navigation */}
        <PageBreadcrumb items={breadcrumbItems} />

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FileText className="h-6 w-6 text-primary" />
              Transcript Analysis
            </h1>
            <p className="text-muted-foreground">
              {isSelfScoped 
                ? 'Analyze your own call transcripts with AI'
                : isTeamScoped 
                ? `Analyze transcripts from ${managerTeam?.name || 'your team'}`
                : 'Select transcripts to analyze with AI across all teams'
              }
            </p>
          </div>
          <Badge variant="outline">
            {isAdmin ? 'Admin View' : isManager ? 'Team View' : 'My Calls'}
          </Badge>
        </div>

        {/* Manager without team warning */}
        {isTeamScoped && !managerTeam && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>No Team Assigned</AlertTitle>
            <AlertDescription>
              You don't have a team assigned yet. Please contact an administrator to assign you to a team before you can view transcripts.
            </AlertDescription>
          </Alert>
        )}

        {/* RAG Health Dashboard - Admin only */}
        {isAdmin && (
          <CollapsibleSection
            title="RAG System Health"
            icon={<Activity className="h-4 w-4" />}
            defaultOpen={globalChunkStatus ? 
              ((globalChunkStatus.withEmbeddings ?? 0) + (globalChunkStatus.nerCompleted ?? 0)) / 
              (2 * (globalChunkStatus.totalChunks || 1)) < 0.5 
              : false
            }
          >
            <RAGHealthDashboard />
          </CollapsibleSection>
        )}

        {/* Filters - only show if manager has a team or not team-scoped */}
        {(!isTeamScoped || managerTeam) && (
          <TranscriptFilters
            dateRange={dateRange}
            selectedPreset={selectedPreset}
            selectedTeamId={isTeamScoped ? (managerTeam?.id || 'all') : selectedTeamId}
            selectedRepId={selectedRepId}
            accountSearch={accountSearch}
            selectedCallTypes={selectedCallTypes}
            selectedAnalysisStatus={selectedAnalysisStatus}
            teams={teams}
            reps={reps}
            isLoadingTeams={isLoadingTeams}
            isLoadingReps={isLoadingReps}
            onPresetChange={handlePresetChange}
            onFromDateChange={handleFromDateChange}
            onToDateChange={handleToDateChange}
            onTeamChange={(v) => { setSelectedTeamId(v); setSelectedRepId('all'); }}
            onRepChange={setSelectedRepId}
            onAccountSearchChange={setAccountSearch}
            onToggleCallType={toggleCallType}
            onAnalysisStatusChange={setSelectedAnalysisStatus}
            hideTeamFilter={isTeamScoped || isSelfScoped}
            hideRepFilter={isSelfScoped}
          />
        )}

        {/* Selection Info Bar - only show if manager has a team or not team-scoped */}
        {(!isTeamScoped || managerTeam) && (
          <TranscriptSelectionBar
            transcripts={transcripts}
            selectedTranscriptIds={selectedTranscriptIds}
            selectedTranscripts={selectedTranscripts}
            currentSelectionId={currentSelectionId}
            estimatedTokens={estimatedTokens}
            totalCount={totalCount}
            chunkStatus={chunkStatus}
            globalChunkStatus={globalChunkStatus}
            isIndexing={isIndexing}
            isBackfilling={isBackfilling}
            isBackfillingEmbeddings={isBackfillingEmbeddings}
            isBackfillingEntities={isBackfillingEntities}
            isResetting={isResetting}
            resetProgress={resetProgress}
            embeddingsProgress={embeddingsProgress}
            entitiesProgress={entitiesProgress}
            isEmbeddingsStalled={isEmbeddingsJobStalled}
            isNERStalled={isNERJobStalled}
            isReindexStalled={isReindexJobStalled}
            analysisMode={analysisMode}
            chatOpen={chatOpen}
            isAdmin={isAdmin}
            onChatOpenChange={setChatOpen}
            onSelectAll={selectAll}
            onSelectAllMatching={selectAllMatching}
            onDeselectAll={deselectAll}
            onPreIndex={handlePreIndex}
            onBackfillAll={handleBackfillAll}
            onBackfillEmbeddings={handleBackfillEmbeddings}
            onBackfillEntities={handleBackfillEntities}
            onStopEmbeddingsBackfill={stopEmbeddingsBackfill}
            onStopNERBackfill={stopNERBackfill}
            onResetAndReindex={handleResetAndReindex}
            onStopReindex={stopReindex}
            isSelectingAll={isSelectingAll}
            onSaveClick={() => setSaveSelectionOpen(true)}
            onLoadClick={() => setSavedSelectionsOpen(true)}
            onInsightsClick={() => setSavedInsightsOpen(true)}
            onDownloadClick={handleDownloadTranscripts}
          />
        )}

        {/* Save Selection Dialog */}
        <SaveSelectionDialog
          open={saveSelectionOpen}
          onOpenChange={setSaveSelectionOpen}
          transcriptIds={Array.from(selectedTranscriptIds)}
          filters={{
            dateRange,
            selectedTeamId: isTeamScoped ? (managerTeam?.id || 'all') : selectedTeamId,
            selectedRepId,
            accountSearch,
            selectedCallTypes,
          }}
          onSaved={(id) => setCurrentSelectionId(id)}
        />

        {/* Saved Selections Sheet */}
        <SavedSelectionsSheet
          open={savedSelectionsOpen}
          onOpenChange={setSavedSelectionsOpen}
          onLoadSelection={handleLoadSelection}
        />

        {/* Saved Insights Sheet */}
        <SavedInsightsSheet
          open={savedInsightsOpen}
          onOpenChange={setSavedInsightsOpen}
        />

        {/* Transcript Table - only show if manager has a team or not team-scoped */}
        {(!isTeamScoped || managerTeam) && (
          <TranscriptTable
            transcripts={transcripts}
            totalCount={totalCount}
            isLoading={isLoading}
            selectedTranscriptIds={selectedTranscriptIds}
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            onToggleTranscript={toggleTranscript}
            onPageChange={setCurrentPage}
            onClearFilters={() => {
              setAccountSearch('');
              setSelectedRepId('all');
              if (!isTeamScoped && !isSelfScoped) {
                setSelectedTeamId('all');
              }
              handlePresetChange('30d');
            }}
          />
        )}
      </div>
    </AppLayout>
  );
}

export default withPageErrorBoundary(AdminTranscriptAnalysis, 'Transcript Analysis');
