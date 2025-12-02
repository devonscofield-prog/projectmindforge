import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { DetailPageSkeleton } from '@/components/ui/skeletons';
import { useProspectData } from '@/hooks/useProspectData';
import { PageBreadcrumb } from '@/components/ui/page-breadcrumb';
import { getAccountDetailBreadcrumbs } from '@/lib/breadcrumbConfig';
import { withPageErrorBoundary } from '@/components/ui/page-error-boundary';

// Detail section components
import {
  ProspectHeader,
  ProspectQuickStats,
  ProspectFollowUps,
  ProspectDetailTabs,
  ProspectQuickActions,
  ProspectQuickInfoBar,
} from '@/components/prospects/detail';

// Existing dialog/sheet components
import { AddStakeholderDialog } from '@/components/prospects/AddStakeholderDialog';
import { StakeholderDetailSheet } from '@/components/prospects/StakeholderDetailSheet';
import { StakeholderRelationshipMap } from '@/components/prospects/StakeholderRelationshipMap';
import { AddEmailLogDialog } from '@/components/prospects/AddEmailLogDialog';
import { SalesCoachChat } from '@/components/prospects/SalesCoachChat';
import { AccountResearchChat } from '@/components/prospects/AccountResearchChat';

import type { Stakeholder } from '@/api/stakeholders';

function ProspectDetail() {
  const { id } = useParams<{ id: string }>();
  const { role } = useAuth();
  
  // Use the custom hook for all data and handlers
  const {
    prospect,
    stakeholders,
    relationships,
    activities,
    calls,
    followUps,
    completedFollowUps,
    dismissedFollowUps,
    emailLogs,
    user,
    isLoading,
    isRefreshing,
    isRefreshingInsights,
    loadProspectData,
    handleStatusChange,
    handleAddActivity,
    handleCompleteFollowUp,
    handleReopenFollowUp,
    handleDismissFollowUp,
    handleRestoreFollowUp,
    handleRefreshFollowUps,
    handleDeleteEmailLog,
    handleRefreshInsightsOnly,
    handleEmailAdded,
    handleUpdateProspect,
  } = useProspectData(id);

  // Local UI state for dialogs/sheets
  const [isAddStakeholderOpen, setIsAddStakeholderOpen] = useState(false);
  const [isAddEmailOpen, setIsAddEmailOpen] = useState(false);
  const [selectedStakeholder, setSelectedStakeholder] = useState<Stakeholder | null>(null);
  const [isStakeholderSheetOpen, setIsStakeholderSheetOpen] = useState(false);
  const [isResearchOpen, setIsResearchOpen] = useState(false);

  const handleStakeholderClick = (stakeholder: Stakeholder) => {
    setSelectedStakeholder(stakeholder);
    setIsStakeholderSheetOpen(true);
  };

  // Get primary stakeholder for header display
  const primaryStakeholder = stakeholders.find(s => s.is_primary_contact);

  if (isLoading) {
    return (
      <AppLayout>
        <DetailPageSkeleton />
      </AppLayout>
    );
  }

  if (!prospect) {
    return null;
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Breadcrumb Navigation */}
        <PageBreadcrumb 
          items={getAccountDetailBreadcrumbs(role, prospect.account_name || prospect.prospect_name)} 
        />

        {/* Header */}
        <ProspectHeader
          prospect={prospect}
          primaryStakeholder={primaryStakeholder}
          onStatusChange={handleStatusChange}
        />

        {/* Quick Stats Bar */}
        <ProspectQuickStats
          prospect={prospect}
          stakeholderCount={stakeholders.length}
          callCount={calls.length}
          onUpdateProspect={handleUpdateProspect}
        />

        {/* Quick Info Bar */}
        <ProspectQuickInfoBar
          prospect={prospect}
          onUpdateProspect={handleUpdateProspect}
        />

        {/* Quick Actions Bar */}
        <ProspectQuickActions
          onAddEmail={() => setIsAddEmailOpen(true)}
          onResearchAccount={() => setIsResearchOpen(true)}
          onAddStakeholder={() => setIsAddStakeholderOpen(true)}
          onLogActivity={handleAddActivity}
        />

        {/* Priority Action Zone - Follow-Ups */}
        <ProspectFollowUps
          prospect={prospect}
          followUps={followUps}
          completedFollowUps={completedFollowUps}
          dismissedFollowUps={dismissedFollowUps}
          calls={calls}
          emailLogs={emailLogs}
          isRefreshing={isRefreshing}
          onComplete={handleCompleteFollowUp}
          onDismiss={handleDismissFollowUp}
          onReopen={handleReopenFollowUp}
          onRestore={handleRestoreFollowUp}
          onRefresh={handleRefreshFollowUps}
        />

        {/* Tabbed Content */}
        <ProspectDetailTabs
          prospect={prospect}
          stakeholders={stakeholders}
          relationships={relationships}
          calls={calls}
          activities={activities}
          emailLogs={emailLogs}
          userId={user?.id}
          isRefreshingInsights={isRefreshingInsights}
          onProspectUpdate={(updated) => loadProspectData()}
          onUpdateProspect={handleUpdateProspect}
          onStakeholderClick={handleStakeholderClick}
          onAddStakeholder={() => setIsAddStakeholderOpen(true)}
          onStakeholderChanged={loadProspectData}
          onAddRelationship={() => {}}
          onRelationshipsChanged={loadProspectData}
          onRefreshInsights={handleRefreshInsightsOnly}
          onResearchAccount={() => setIsResearchOpen(true)}
          onAddEmail={() => setIsAddEmailOpen(true)}
          onDeleteEmail={handleDeleteEmailLog}
          onAddActivity={handleAddActivity}
        />
      </div>

      {/* Add Stakeholder Dialog */}
      {user?.id && prospect && (
        <AddStakeholderDialog
          open={isAddStakeholderOpen}
          onOpenChange={setIsAddStakeholderOpen}
          prospectId={prospect.id}
          repId={user.id}
          onStakeholderAdded={loadProspectData}
        />
      )}

      {/* Stakeholder Detail Sheet */}
      <StakeholderDetailSheet
        stakeholder={selectedStakeholder}
        open={isStakeholderSheetOpen}
        onOpenChange={setIsStakeholderSheetOpen}
        onUpdated={loadProspectData}
        onDeleted={loadProspectData}
      />

      {/* Add Email Log Dialog */}
      {user?.id && prospect && (
        <AddEmailLogDialog
          open={isAddEmailOpen}
          onOpenChange={setIsAddEmailOpen}
          prospectId={prospect.id}
          repId={user.id}
          stakeholders={stakeholders}
          onEmailAdded={handleEmailAdded}
        />
      )}

      {/* AI Sales Coach Chat */}
      <SalesCoachChat 
        prospectId={prospect.id} 
        accountName={prospect.account_name || prospect.prospect_name} 
      />

      {/* Account Research Chat */}
      <AccountResearchChat
        open={isResearchOpen}
        onOpenChange={setIsResearchOpen}
        prospect={prospect}
        stakeholders={stakeholders}
        onSaveResearch={async (research) => {
          const currentInfo = (prospect.ai_extracted_info || {}) as Record<string, unknown>;
          return handleUpdateProspect({
            ai_extracted_info: {
              ...currentInfo,
              account_research: research,
              account_research_date: new Date().toISOString(),
            } as any,
          });
        }}
      />
    </AppLayout>
  );
}

export default withPageErrorBoundary(ProspectDetail, 'Account Details');
