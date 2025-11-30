import { AppLayout } from '@/components/layout/AppLayout';
import { Badge } from '@/components/ui/badge';
import { PageBreadcrumb } from '@/components/ui/page-breadcrumb';
import { getAdminPageBreadcrumb, getManagerPageBreadcrumb, getRepPageBreadcrumb } from '@/lib/breadcrumbConfig';
import { SaveSelectionDialog } from '@/components/admin/SaveSelectionDialog';
import { SavedSelectionsSheet } from '@/components/admin/SavedSelectionsSheet';
import { SavedInsightsSheet } from '@/components/admin/SavedInsightsSheet';
import { FileText } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  TranscriptFilters,
  TranscriptSelectionBar,
  TranscriptTable,
  useTranscriptAnalysis,
} from './transcript-analysis';

export default function AdminTranscriptAnalysis() {
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
    
    // Data
    teams,
    reps,
    transcripts,
    totalCount,
    totalPages,
    isLoading,
    chunkStatus,
    
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
    deselectAll,
    toggleCallType,
    handlePreIndex,
    handleLoadSelection,
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

        {/* Filters */}
        <TranscriptFilters
          dateRange={dateRange}
          selectedPreset={selectedPreset}
          selectedTeamId={isTeamScoped ? (managerTeam?.id || 'all') : selectedTeamId}
          selectedRepId={selectedRepId}
          accountSearch={accountSearch}
          selectedCallTypes={selectedCallTypes}
          teams={teams}
          reps={reps}
          onPresetChange={handlePresetChange}
          onFromDateChange={handleFromDateChange}
          onToDateChange={handleToDateChange}
          onTeamChange={(v) => { setSelectedTeamId(v); setSelectedRepId('all'); }}
          onRepChange={setSelectedRepId}
          onAccountSearchChange={setAccountSearch}
          onToggleCallType={toggleCallType}
          hideTeamFilter={isTeamScoped || isSelfScoped}
          hideRepFilter={isSelfScoped}
        />

        {/* Selection Info Bar */}
        <TranscriptSelectionBar
          transcripts={transcripts}
          selectedTranscriptIds={selectedTranscriptIds}
          selectedTranscripts={selectedTranscripts}
          currentSelectionId={currentSelectionId}
          estimatedTokens={estimatedTokens}
          chunkStatus={chunkStatus}
          isIndexing={isIndexing}
          analysisMode={analysisMode}
          chatOpen={chatOpen}
          onChatOpenChange={setChatOpen}
          onSelectAll={selectAll}
          onDeselectAll={deselectAll}
          onPreIndex={handlePreIndex}
          onSaveClick={() => setSaveSelectionOpen(true)}
          onLoadClick={() => setSavedSelectionsOpen(true)}
          onInsightsClick={() => setSavedInsightsOpen(true)}
        />

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

        {/* Transcript Table */}
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
        />
      </div>
    </AppLayout>
  );
}
