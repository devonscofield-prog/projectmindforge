import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Phone, Mail, Search, UserPlus, MessageSquare, FileText, ClipboardList, Plus } from 'lucide-react';
import { activityTypeLabels } from './constants';
import type { ProspectActivityType } from '@/api/prospects';

interface ProspectQuickActionsProps {
  onLogCall?: () => void;
  onAddEmail: () => void;
  onResearchAccount?: () => void;
  onAddStakeholder: () => void;
  onOpenSalesCoach?: () => void;
  onOpenAccountResearch?: () => void;
  onLogActivity?: (activity: { type: ProspectActivityType; description: string; date: string }) => Promise<unknown>;
}

// Limited activity types for logging
const allowedActivityTypes: { value: ProspectActivityType; label: string }[] = [
  { value: 'note', label: 'Note' },
  { value: 'call', label: 'Phone Call' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'meeting', label: 'Other' },
];

// Activity templates by type
const activityTemplates: Record<ProspectActivityType, string[]> = {
  call: [
    'Left voicemail',
    'No answer',
    'Connected - positive conversation',
    'Connected - need follow-up',
    'Gatekeeper - left message',
  ],
  linkedin: [
    'Sent connection request',
    'Sent InMail',
    'Engaged with post',
    'Shared content',
    'Accepted connection',
  ],
  note: [
    'Pricing discussion',
    'Competitor mentioned',
    'Decision timeline discussed',
    'Budget approved',
    'Technical requirements reviewed',
  ],
  meeting: [
    'Email sent',
    'Referral received',
    'Internal discussion',
    'Contract sent',
  ],
  email: [],
  demo: [],
};

export function ProspectQuickActions({
  onLogCall,
  onAddEmail,
  onResearchAccount,
  onAddStakeholder,
  onOpenSalesCoach,
  onOpenAccountResearch,
  onLogActivity,
}: ProspectQuickActionsProps) {
  const [isLogActivityOpen, setIsLogActivityOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newActivity, setNewActivity] = useState({
    type: 'note' as ProspectActivityType,
    description: '',
    date: new Date().toISOString().split('T')[0],
  });

  const handleSubmit = async () => {
    if (!onLogActivity) return;
    setIsSubmitting(true);
    try {
      await onLogActivity(newActivity);
      setIsLogActivityOpen(false);
      setNewActivity({ type: 'note', description: '', date: new Date().toISOString().split('T')[0] });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="sticky top-4 z-10 shadow-md">
      <CardContent className="p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {onLogCall && (
              <Button size="sm" onClick={onLogCall} className="gap-2">
                <Phone className="h-4 w-4" />
                <span className="hidden sm:inline">Log Call</span>
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={onAddEmail} className="gap-2">
              <Mail className="h-4 w-4" />
              <span className="hidden sm:inline">Add Email</span>
            </Button>
            <Button variant="outline" size="sm" onClick={onAddStakeholder} className="gap-2">
              <UserPlus className="h-4 w-4" />
              <span className="hidden sm:inline">Add Stakeholder</span>
            </Button>
            {onLogActivity && (
              <Dialog open={isLogActivityOpen} onOpenChange={setIsLogActivityOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <ClipboardList className="h-4 w-4" />
                    <span className="hidden sm:inline">Log Activity</span>
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Log Activity</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Activity Type</label>
                      <Select
                        value={newActivity.type}
                        onValueChange={(v) => setNewActivity({ ...newActivity, type: v as ProspectActivityType, description: '' })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {allowedActivityTypes.map(({ value, label }) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Date</label>
                      <Input
                        type="date"
                        value={newActivity.date}
                        onChange={(e) => setNewActivity({ ...newActivity, date: e.target.value })}
                      />
                    </div>
                    {activityTemplates[newActivity.type].length > 0 && (
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Quick Templates</label>
                        <div className="flex flex-wrap gap-2">
                          {activityTemplates[newActivity.type].map((template) => (
                            <Button
                              key={template}
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setNewActivity({ ...newActivity, description: template })}
                              className={newActivity.description === template ? 'bg-accent' : ''}
                            >
                              {template}
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Notes (optional)</label>
                      <Textarea
                        placeholder="Add any notes about this activity..."
                        value={newActivity.description}
                        onChange={(e) => setNewActivity({ ...newActivity, description: e.target.value })}
                      />
                    </div>
                    <Button
                      onClick={handleSubmit}
                      disabled={isSubmitting}
                      className="w-full"
                    >
                      {isSubmitting ? 'Logging...' : 'Log Activity'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
          <div className="flex items-center gap-2">
            {onResearchAccount && (
              <Button variant="outline" size="sm" onClick={onResearchAccount} className="gap-2">
                <Search className="h-4 w-4" />
                <span className="hidden sm:inline">Research</span>
              </Button>
            )}
            {onOpenSalesCoach && (
              <Button variant="ghost" size="sm" onClick={onOpenSalesCoach} className="gap-2">
                <MessageSquare className="h-4 w-4" />
                <span className="hidden sm:inline">Coach</span>
              </Button>
            )}
            {onOpenAccountResearch && (
              <Button variant="ghost" size="sm" onClick={onOpenAccountResearch} className="gap-2">
                <FileText className="h-4 w-4" />
                <span className="hidden sm:inline">AI Notes</span>
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
