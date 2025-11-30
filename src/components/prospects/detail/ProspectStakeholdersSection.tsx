import { Button } from '@/components/ui/button';
import { CollapsibleSection } from '@/components/ui/collapsible-section';
import { Users, Plus } from 'lucide-react';
import { StakeholderCard } from '@/components/prospects/StakeholderCard';
import type { Stakeholder } from '@/api/stakeholders';

interface ProspectStakeholdersSectionProps {
  stakeholders: Stakeholder[];
  onAddStakeholder: () => void;
  onStakeholderClick: (stakeholder: Stakeholder) => void;
  onStakeholderChanged: () => void;
}

export function ProspectStakeholdersSection({
  stakeholders,
  onAddStakeholder,
  onStakeholderClick,
  onStakeholderChanged,
}: ProspectStakeholdersSectionProps) {
  return (
    <CollapsibleSection
      title="Stakeholders"
      description="Key contacts at this account"
      icon={<Users className="h-5 w-5 text-primary" />}
      action={
        <Button size="sm" onClick={onAddStakeholder}>
          <Plus className="h-4 w-4 mr-1" />
          Add
        </Button>
      }
      defaultOpen={true}
    >
      {stakeholders.length === 0 ? (
        <div className="text-center py-8">
          <Users className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No stakeholders yet</p>
          <Button 
            variant="outline" 
            size="sm" 
            className="mt-3"
            onClick={onAddStakeholder}
          >
            Add First Stakeholder
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {stakeholders.map((stakeholder) => (
            <StakeholderCard
              key={stakeholder.id}
              stakeholder={stakeholder}
              onClick={() => onStakeholderClick(stakeholder)}
              onPrimaryChanged={onStakeholderChanged}
            />
          ))}
        </div>
      )}
    </CollapsibleSection>
  );
}
