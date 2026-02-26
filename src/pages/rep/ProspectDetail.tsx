import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { DetailPageSkeleton } from '@/components/ui/skeletons';
import { useProspectData } from '@/hooks/useProspectData';
import type { Prospect } from '@/api/prospects';
import { useProfile } from '@/hooks/useProfiles';
import { PageBreadcrumb } from '@/components/ui/page-breadcrumb';
import { getAccountDetailBreadcrumbs } from '@/lib/breadcrumbConfig';
import { withPageErrorBoundary } from '@/components/ui/page-error-boundary';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { HeatScoreBadge } from '@/components/ui/heat-score-badge';
import { Flame, Calendar, ListTodo, User } from 'lucide-react';
import { format, parseISO } from 'date-fns';

// Detail section components
import {
  ProspectHeader,
  ProspectFollowUps,
  ProspectDetailTabs,
  ProspectQuickActions,
} from '@/components/prospects/detail';
import { AccountHeatCard } from '@/components/prospects/detail/AccountHeatCard';
import { AgreedNextStepsCard } from '@/components/prospects/detail/AgreedNextStepsCard';
import { ProspectCallHistory } from '@/components/prospects/detail/ProspectCallHistory';

import { lazy, Suspense } from 'react';
// Lazy-loaded dialog/sheet components
const AddStakeholderDialog = lazy(() => import('@/components/prospects/AddStakeholderDialog').then(m => ({ default: m.AddStakeholderDialog })));
const StakeholderDetailSheet = lazy(() => import('@/components/prospects/StakeholderDetailSheet').then(m => ({ default: m.StakeholderDetailSheet })));

const AddEmailLogDialog = lazy(() => import('@/components/prospects/AddEmailLogDialog').then(m => ({ default: m.AddEmailLogDialog })));
const SalesCoachChat = lazy(() => import('@/components/prospects/SalesCoachChat').then(m => ({ default: m.SalesCoachChat })));
const AccountResearchChat = lazy(() => import('@/components/prospects/AccountResearchChat').then(m => ({ default: m.AccountResearchChat })));

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

  // Fetch rep info for managers/admins
  const showRepName = role === 'manager' || role === 'admin';
  const { data: repProfile } = useProfile(showRepName ? prospect?.rep_id : null);

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

        {/* 1. Consolidated Header (includes stats and metadata) */}
        <ProspectHeader
          prospect={prospect}
          primaryStakeholder={primaryStakeholder}
          stakeholderCount={stakeholders.length}
          callCount={calls.length}
          onStatusChange={handleStatusChange}
          onUpdateProspect={handleUpdateProspect}
          repName={repProfile?.name}
          showRepName={showRepName}
        />

        {/* 2. Compact Deal Status Card */}
        <Card>
          <CardContent className="py-3">
            <div className="flex items-center gap-6 flex-wrap">
              {/* Heat Score */}
              <div className="flex items-center gap-2">
                <Flame className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Heat:</span>
                <HeatScoreBadge score={prospect.account_heat_score ?? null} />
              </div>

              {/* Last Contact */}
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Last Contact:</span>
                <span className="text-sm font-medium">
                  {prospect.last_contact_date
                    ? format(parseISO(prospect.last_contact_date), 'MMM d, yyyy')
                    : 'Never'}
                </span>
              </div>

              {/* Pending Follow-ups */}
              <div className="flex items-center gap-2">
                <ListTodo className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Follow-ups:</span>
                <Badge variant={followUps.length > 0 ? 'default' : 'secondary'} className="text-xs">
                  {followUps.length}
                </Badge>
              </div>

              {/* Primary Stakeholder */}
              {primaryStakeholder && (
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Primary:</span>
                  <span className="text-sm font-medium">{primaryStakeholder.name}</span>
                  {primaryStakeholder.job_title && (
                    <span className="text-xs text-muted-foreground">({primaryStakeholder.job_title})</span>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 3. Priority Action Zone - Follow-Ups & Next Steps (moved up) */}
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

        {/* Agreed Next Steps Card */}
        <AgreedNextStepsCard
          prospectId={prospect.id}
          aiExtractedInfo={prospect.ai_extracted_info as Record<string, unknown> | null}
          onRefresh={loadProspectData}
        />

        {/* Quick Actions Bar */}
        <ProspectQuickActions
          onAddEmail={() => setIsAddEmailOpen(true)}
          onResearchAccount={() => setIsResearchOpen(true)}
          onAddStakeholder={() => setIsAddStakeholderOpen(true)}
          onLogActivity={handleAddActivity}
        />

        {/* Account Heat/Pulse Card (full detail, below quick actions) */}
        <AccountHeatCard
          prospectId={prospect.id}
          accountHeatScore={prospect.account_heat_score ?? null}
          accountHeatAnalysis={prospect.account_heat_analysis}
          accountHeatUpdatedAt={prospect.account_heat_updated_at ?? null}
          onRefresh={loadProspectData}
        />

        {/* Call History */}
        <ProspectCallHistory calls={calls} />

        {/* 5. Tabbed Content (Calls, Stakeholders, Activities, Emails) */}
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
          onEmailUpdated={handleEmailAdded}
          onAddActivity={handleAddActivity}
        />
      </div>

      {/* Add Stakeholder Dialog */}
      {user?.id && prospect && isAddStakeholderOpen && (
        <Suspense fallback={null}>
          <AddStakeholderDialog
            open={isAddStakeholderOpen}
            onOpenChange={setIsAddStakeholderOpen}
            prospectId={prospect.id}
            repId={user.id}
            onStakeholderAdded={loadProspectData}
          />
        </Suspense>
      )}

      {/* Stakeholder Detail Sheet */}
      {isStakeholderSheetOpen && (
        <Suspense fallback={null}>
          <StakeholderDetailSheet
            stakeholder={selectedStakeholder}
            open={isStakeholderSheetOpen}
            onOpenChange={setIsStakeholderSheetOpen}
            onUpdated={loadProspectData}
            onDeleted={loadProspectData}
          />
        </Suspense>
      )}

      {/* Add Email Log Dialog */}
      {user?.id && prospect && isAddEmailOpen && (
        <Suspense fallback={null}>
          <AddEmailLogDialog
            open={isAddEmailOpen}
            onOpenChange={setIsAddEmailOpen}
            prospectId={prospect.id}
            repId={user.id}
            stakeholders={stakeholders}
            onEmailAdded={handleEmailAdded}
          />
        </Suspense>
      )}

      {/* AI Sales Coach Chat */}
      <Suspense fallback={null}>
        <SalesCoachChat
          prospectId={prospect.id}
          accountName={prospect.account_name || prospect.prospect_name}
          heatScore={prospect.account_heat_score}
          lastContactDate={prospect.last_contact_date}
          pendingFollowUpsCount={followUps.length}
        />
      </Suspense>

      {/* Account Research Chat */}
      {isResearchOpen && (
        <Suspense fallback={null}>
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
                  account_research: research, // Now stores structured object
                  account_research_generated_at: new Date().toISOString(),
                } as Prospect['ai_extracted_info'],
              });
            }}
          />
        </Suspense>
      )}
    </AppLayout>
  );
}

export default withPageErrorBoundary(ProspectDetail, 'Account Details');
