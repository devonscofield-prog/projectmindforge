import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { Skeleton } from '@/components/ui/skeleton';
import { useProspectData } from '@/hooks/useProspectData';
import { PageBreadcrumb } from '@/components/ui/page-breadcrumb';
import { getAccountDetailBreadcrumbs } from '@/lib/breadcrumbConfig';
import { withPageErrorBoundary } from '@/components/ui/page-error-boundary';

// Detail section components
import {
  ProspectHeader,
  ProspectQuickStats,
  ProspectAIInsights,
  ProspectFollowUps,
  ProspectCallHistory,
  ProspectEmailLogSection,
  ProspectActivityLog,
  ProspectQuickInfo,
  ProspectStakeholdersSection,
} from '@/components/prospects/detail';

// Existing dialog/sheet components
import { AddStakeholderDialog } from '@/components/prospects/AddStakeholderDialog';
import { StakeholderDetailSheet } from '@/components/prospects/StakeholderDetailSheet';
import { StakeholderRelationshipMap } from '@/components/prospects/StakeholderRelationshipMap';
import { AddEmailLogDialog } from '@/components/prospects/AddEmailLogDialog';
import { SalesCoachChat } from '@/components/prospects/SalesCoachChat';

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

  const handleStakeholderClick = (stakeholder: Stakeholder) => {
    setSelectedStakeholder(stakeholder);
    setIsStakeholderSheetOpen(true);
  };

  // Get primary stakeholder for header display
  const primaryStakeholder = stakeholders.find(s => s.is_primary_contact);

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <div className="grid gap-6 md:grid-cols-3">
            <Skeleton className="h-64 md:col-span-2" />
            <Skeleton className="h-64" />
          </div>
        </div>
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

        {/* Quick Stats Grid */}
        <ProspectQuickStats
          prospect={prospect}
          stakeholderCount={stakeholders.length}
          callCount={calls.length}
        />

        <div className="grid gap-4 md:gap-6 lg:grid-cols-3">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Stakeholders Section */}
            <ProspectStakeholdersSection
              stakeholders={stakeholders}
              onAddStakeholder={() => setIsAddStakeholderOpen(true)}
              onStakeholderClick={handleStakeholderClick}
              onStakeholderChanged={loadProspectData}
            />

            {/* Relationship Map */}
            {user?.id && (
              <StakeholderRelationshipMap
                stakeholders={stakeholders}
                relationships={relationships}
                prospectId={prospect.id}
                repId={user.id}
                onRelationshipsChanged={loadProspectData}
                onStakeholderClick={handleStakeholderClick}
              />
            )}

            {/* AI Insights */}
            <ProspectAIInsights
              prospect={prospect}
              calls={calls}
              emailLogs={emailLogs}
              isRefreshingInsights={isRefreshingInsights}
              onRefreshInsights={handleRefreshInsightsOnly}
            />

            {/* Suggested Follow-Up Steps */}
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

            {/* Call History */}
            <ProspectCallHistory calls={calls} />

            {/* Email Log */}
            <ProspectEmailLogSection
              emailLogs={emailLogs}
              stakeholders={stakeholders}
              onAddEmail={() => setIsAddEmailOpen(true)}
              onDeleteEmail={handleDeleteEmailLog}
            />
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Activity Timeline */}
            <ProspectActivityLog
              activities={activities}
              onAddActivity={handleAddActivity}
            />

            {/* Quick Info */}
            <ProspectQuickInfo
              prospect={prospect}
              onUpdateProspect={handleUpdateProspect}
            />
          </div>
        </div>
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
    </AppLayout>
  );
}

export default withPageErrorBoundary(ProspectDetail, 'Account Details');
