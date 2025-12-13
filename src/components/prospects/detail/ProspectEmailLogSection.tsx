import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { CollapsibleSection } from '@/components/ui/collapsible-section';
import { Mail, Plus } from 'lucide-react';
import { EmailLogItem } from '@/components/prospects/EmailLogItem';
import { EditEmailLogDialog } from '@/components/prospects/EditEmailLogDialog';
import { getEmailLogStakeholdersBatch, type EmailLog } from '@/api/emailLogs';
import type { Stakeholder } from '@/api/stakeholders';

interface ProspectEmailLogSectionProps {
  emailLogs: EmailLog[];
  stakeholders: Stakeholder[];
  onAddEmail: () => void;
  onDeleteEmail: (id: string) => void;
  onEmailUpdated: () => void;
}

export function ProspectEmailLogSection({
  emailLogs,
  stakeholders,
  onAddEmail,
  onDeleteEmail,
  onEmailUpdated,
}: ProspectEmailLogSectionProps) {
  const [editingEmail, setEditingEmail] = useState<EmailLog | null>(null);
  const [stakeholderLinksMap, setStakeholderLinksMap] = useState<Map<string, string[]>>(new Map());

  // Fetch stakeholder links for all email logs
  useEffect(() => {
    const fetchStakeholderLinks = async () => {
      if (emailLogs.length === 0) {
        setStakeholderLinksMap(new Map());
        return;
      }

      try {
        const emailLogIds = emailLogs.map(e => e.id);
        const linksMap = await getEmailLogStakeholdersBatch(emailLogIds);
        setStakeholderLinksMap(linksMap);
      } catch (error) {
        console.error('Failed to fetch stakeholder links:', error);
      }
    };

    fetchStakeholderLinks();
  }, [emailLogs]);

  // Create a map from stakeholder ID to Stakeholder object for quick lookup
  const stakeholderMap = useMemo(() => {
    const map = new Map<string, Stakeholder>();
    stakeholders.forEach(s => map.set(s.id, s));
    return map;
  }, [stakeholders]);

  // Get linked stakeholders for an email log
  const getLinkedStakeholders = (emailLogId: string): Stakeholder[] => {
    const stakeholderIds = stakeholderLinksMap.get(emailLogId) || [];
    return stakeholderIds
      .map(id => stakeholderMap.get(id))
      .filter((s): s is Stakeholder => s !== undefined);
  };

  const handleEdit = (email: EmailLog) => {
    setEditingEmail(email);
  };

  const handleEditComplete = () => {
    setEditingEmail(null);
    onEmailUpdated();
  };

  return (
    <>
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
                linkedStakeholders={getLinkedStakeholders(email.id)}
                onEdit={handleEdit}
                onDelete={onDeleteEmail}
              />
            ))}
          </div>
        )}
      </CollapsibleSection>

      {/* Edit Email Dialog */}
      {editingEmail && (
        <EditEmailLogDialog
          open={!!editingEmail}
          onOpenChange={(open) => !open && setEditingEmail(null)}
          email={editingEmail}
          stakeholders={stakeholders}
          onEmailUpdated={handleEditComplete}
        />
      )}
    </>
  );
}
