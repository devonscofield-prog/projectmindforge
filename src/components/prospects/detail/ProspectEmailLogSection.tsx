import { Button } from '@/components/ui/button';
import { CollapsibleSection } from '@/components/ui/collapsible-section';
import { Mail, Plus } from 'lucide-react';
import { EmailLogItem } from '@/components/prospects/EmailLogItem';
import type { EmailLog } from '@/api/emailLogs';
import type { Stakeholder } from '@/api/stakeholders';

interface ProspectEmailLogSectionProps {
  emailLogs: EmailLog[];
  stakeholders: Stakeholder[];
  onAddEmail: () => void;
  onDeleteEmail: (id: string) => void;
}

export function ProspectEmailLogSection({
  emailLogs,
  stakeholders,
  onAddEmail,
  onDeleteEmail,
}: ProspectEmailLogSectionProps) {
  return (
    <CollapsibleSection
      title="Email Log"
      description="Logged email communications with this account"
      icon={<Mail className="h-5 w-5 text-primary" />}
      action={
        <Button size="sm" onClick={onAddEmail}>
          <Plus className="h-4 w-4 mr-1" />
          Add Email
        </Button>
      }
    >
      {emailLogs.length === 0 ? (
        <div className="text-center py-8">
          <Mail className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground mb-3">No emails logged yet</p>
          <p className="text-xs text-muted-foreground mb-3">
            Log emails you've sent or received to help AI generate better follow-up suggestions
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={onAddEmail}
          >
            <Plus className="h-4 w-4 mr-2" />
            Log First Email
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {emailLogs.map((email) => (
            <EmailLogItem
              key={email.id}
              email={email}
              stakeholder={email.stakeholder_id ? stakeholders.find(s => s.id === email.stakeholder_id) : null}
              onDelete={onDeleteEmail}
            />
          ))}
        </div>
      )}
    </CollapsibleSection>
  );
}
