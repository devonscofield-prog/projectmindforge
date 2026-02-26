import { lazy, Suspense } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LayoutGrid, Users, History, Brain } from 'lucide-react';
import { ProspectOpportunityDetails } from './ProspectOpportunityDetails';
import { ProspectStakeholdersSection } from './ProspectStakeholdersSection';
import { StakeholderRelationshipMap } from '@/components/prospects/StakeholderRelationshipMap';
import { ProspectAIInsights } from './ProspectAIInsights';
import { ProspectAccountResearch } from './ProspectAccountResearch';
import { ProspectProductsBreakdown } from './ProspectProductsBreakdown';
import { Skeleton } from '@/components/ui/skeleton';

// Lazy load heavy components that aren't immediately visible
const ProspectEmailLogSection = lazy(() => import('./ProspectEmailLogSection').then(m => ({ default: m.ProspectEmailLogSection })));
const ProspectActivityLog = lazy(() => import('./ProspectActivityLog').then(m => ({ default: m.ProspectActivityLog })));

// Loading fallback for lazy components
function TabContentSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}
import type { Prospect } from '@/api/prospects';
import type { Stakeholder } from '@/api/stakeholders';
import type { StakeholderRelationship } from '@/api/stakeholderRelationships';
import type { CallRecord } from '@/hooks/useProspectData';
import type { ProspectActivity, ProspectActivityType } from '@/api/prospects';
import type { EmailLog } from '@/api/emailLogs';

interface ProspectDetailTabsProps {
  prospect: Prospect;
  stakeholders: Stakeholder[];
  relationships: StakeholderRelationship[];
  calls: CallRecord[];
  activities: ProspectActivity[];
  emailLogs: EmailLog[];
  userId?: string;
  isRefreshingInsights: boolean;
  onProspectUpdate: (prospect: Prospect) => void;
  onUpdateProspect: (updates: Partial<Prospect>) => Promise<boolean>;
  onStakeholderClick: (stakeholder: Stakeholder) => void;
  onAddStakeholder: () => void;
  onStakeholderChanged: () => void;
  onAddRelationship: () => void;
  onRelationshipsChanged: () => void;
  onRefreshInsights: () => void;
  onResearchAccount?: () => void;
  onAddEmail: () => void;
  onDeleteEmail: (id: string) => void;
  onEmailUpdated: () => void;
  onAddActivity: (activity: { type: ProspectActivityType; description: string; date: string }) => Promise<unknown>;
}

export function ProspectDetailTabs({
  prospect,
  stakeholders,
  relationships,
  calls,
  activities,
  emailLogs,
  userId,
  isRefreshingInsights,
  onProspectUpdate,
  onUpdateProspect: _onUpdateProspect,
  onStakeholderClick,
  onAddStakeholder,
  onStakeholderChanged,
  onAddRelationship,
  onRelationshipsChanged,
  onRefreshInsights,
  onResearchAccount,
  onAddEmail,
  onDeleteEmail,
  onEmailUpdated,
  onAddActivity,
}: ProspectDetailTabsProps) {
  return (
    <Tabs defaultValue="intelligence" className="w-full">
      <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent">
        <TabsTrigger value="intelligence" className="gap-2 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
          <Brain className="h-4 w-4" />
          Intelligence
        </TabsTrigger>
        <TabsTrigger value="people" className="gap-2 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
          <Users className="h-4 w-4" />
          People
        </TabsTrigger>
        <TabsTrigger value="history" className="gap-2 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
          <History className="h-4 w-4" />
          History
        </TabsTrigger>
        <TabsTrigger value="overview" className="gap-2 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
          <LayoutGrid className="h-4 w-4" />
          Potential
        </TabsTrigger>
      </TabsList>

      <TabsContent value="intelligence" className="space-y-6 mt-6">
        <ProspectAIInsights
          prospect={prospect}
          calls={calls}
          emailLogs={emailLogs}
          isRefreshingInsights={isRefreshingInsights}
          onRefreshInsights={onRefreshInsights}
        />
        <ProspectAccountResearch
          prospect={prospect}
          onResearchAccount={onResearchAccount}
        />
        <ProspectProductsBreakdown prospectId={prospect.id} />
      </TabsContent>

      <TabsContent value="overview" className="space-y-6 mt-6">
        <ProspectOpportunityDetails
          prospect={prospect}
          onUpdate={onProspectUpdate}
        />
      </TabsContent>

      <TabsContent value="people" className="space-y-6 mt-6">
        <ProspectStakeholdersSection
          stakeholders={stakeholders}
          onStakeholderClick={onStakeholderClick}
          onAddStakeholder={onAddStakeholder}
          onStakeholderChanged={onStakeholderChanged}
        />
        {userId && (
          <StakeholderRelationshipMap
            stakeholders={stakeholders}
            relationships={relationships}
            prospectId={prospect.id}
            repId={userId}
            onRelationshipsChanged={onRelationshipsChanged}
            onStakeholderClick={onStakeholderClick}
          />
        )}
      </TabsContent>

      <TabsContent value="history" className="space-y-6 mt-6">
        <Suspense fallback={<TabContentSkeleton />}>
          <ProspectEmailLogSection
            emailLogs={emailLogs}
            stakeholders={stakeholders}
            onAddEmail={onAddEmail}
            onDeleteEmail={onDeleteEmail}
            onEmailUpdated={onEmailUpdated}
          />
          <ProspectActivityLog 
            activities={activities}
            onAddActivity={onAddActivity}
          />
        </Suspense>
      </TabsContent>
    </Tabs>
  );
}
