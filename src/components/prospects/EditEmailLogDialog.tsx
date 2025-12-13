import { useState, useEffect } from 'react';
import { createLogger } from '@/lib/logger';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { ArrowUpRight, ArrowDownLeft, Loader2, Crown, User, X, Link2, Link2Off } from 'lucide-react';
import { updateEmailLog, getEmailLogStakeholders, type EmailLog, type EmailDirection } from '@/api/emailLogs';
import { type Stakeholder, influenceLevelLabels } from '@/api/stakeholders';
import { cn } from '@/lib/utils';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

const log = createLogger('EditEmailLogDialog');

interface EditEmailLogDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  email: EmailLog;
  stakeholders: Stakeholder[];
  onEmailUpdated: () => void;
}

export function EditEmailLogDialog({
  open,
  onOpenChange,
  email,
  stakeholders,
  onEmailUpdated,
}: EditEmailLogDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingStakeholders, setIsLoadingStakeholders] = useState(false);
  const [direction, setDirection] = useState<EmailDirection>(email.direction);
  const [subject, setSubject] = useState(email.subject || '');
  const [body, setBody] = useState(email.body);
  const [emailDate, setEmailDate] = useState(email.email_date);
  const [contactName, setContactName] = useState(email.contact_name || '');
  const [contactEmail, setContactEmail] = useState(email.contact_email || '');
  const [notes, setNotes] = useState(email.notes || '');
  const [selectedStakeholders, setSelectedStakeholders] = useState<Stakeholder[]>([]);
  const [stakeholderPopoverOpen, setStakeholderPopoverOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');

  // Load linked stakeholders when dialog opens
  useEffect(() => {
    if (open) {
      loadLinkedStakeholders();
    }
  }, [open, email.id]);

  const loadLinkedStakeholders = async () => {
    setIsLoadingStakeholders(true);
    try {
      const stakeholderIds = await getEmailLogStakeholders(email.id);
      const linked = stakeholders.filter(s => stakeholderIds.includes(s.id));
      setSelectedStakeholders(linked);
    } catch (error) {
      log.warn('Failed to load linked stakeholders', { error });
    } finally {
      setIsLoadingStakeholders(false);
    }
  };

  // Reset form when email changes
  useEffect(() => {
    setDirection(email.direction);
    setSubject(email.subject || '');
    setBody(email.body);
    setEmailDate(email.email_date);
    setContactName(email.contact_name || '');
    setContactEmail(email.contact_email || '');
    setNotes(email.notes || '');
  }, [email]);

  const handleSelectStakeholder = (stakeholder: Stakeholder) => {
    if (!selectedStakeholders.find(s => s.id === stakeholder.id)) {
      const newSelected = [...selectedStakeholders, stakeholder];
      setSelectedStakeholders(newSelected);
      // Update contact info
      setContactName(newSelected.map(s => s.name).join(', '));
      setContactEmail(stakeholder.email || contactEmail);
    }
    setStakeholderPopoverOpen(false);
    setSearchValue('');
  };

  const handleRemoveStakeholder = (stakeholderId: string) => {
    const newSelected = selectedStakeholders.filter(s => s.id !== stakeholderId);
    setSelectedStakeholders(newSelected);
    if (newSelected.length > 0) {
      setContactName(newSelected.map(s => s.name).join(', '));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!body.trim()) {
      toast.error('Email body is required');
      return;
    }

    setIsSubmitting(true);
    try {
      await updateEmailLog(email.id, {
        direction,
        subject: subject || null,
        body: body.trim(),
        emailDate,
        contactName: contactName || null,
        contactEmail: contactEmail || null,
        notes: notes || null,
        stakeholderIds: selectedStakeholders.map(s => s.id),
      });
      
      toast.success('Email log updated');
      onOpenChange(false);
      onEmailUpdated();
    } catch (error) {
      log.error('Failed to update email log', { error });
      toast.error('Failed to update email log');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter stakeholders based on search and exclude already selected
  const filteredStakeholders = stakeholders.filter(s => 
    !selectedStakeholders.find(sel => sel.id === s.id) &&
    (s.name.toLowerCase().includes(searchValue.toLowerCase()) ||
    (s.job_title && s.job_title.toLowerCase().includes(searchValue.toLowerCase())))
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Email Log</DialogTitle>
        </DialogHeader>
        
        {isLoadingStakeholders ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Direction Toggle */}
            <div className="space-y-2">
              <Label>Email Direction</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setDirection('outgoing')}
                  className={cn(
                    "flex items-center justify-center gap-2 p-4 rounded-lg border-2 transition-all",
                    direction === 'outgoing'
                      ? "border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400"
                      : "border-border hover:border-muted-foreground/50"
                  )}
                >
                  <ArrowUpRight className="h-5 w-5" />
                  <div className="text-left">
                    <p className="font-medium">Email I Sent</p>
                    <p className="text-xs text-muted-foreground">Outgoing message</p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setDirection('incoming')}
                  className={cn(
                    "flex items-center justify-center gap-2 p-4 rounded-lg border-2 transition-all",
                    direction === 'incoming'
                      ? "border-green-500 bg-green-500/10 text-green-600 dark:text-green-400"
                      : "border-border hover:border-muted-foreground/50"
                  )}
                >
                  <ArrowDownLeft className="h-5 w-5" />
                  <div className="text-left">
                    <p className="font-medium">Email I Received</p>
                    <p className="text-xs text-muted-foreground">Incoming message</p>
                  </div>
                </button>
              </div>
            </div>

            {/* Multi-Stakeholder Selector */}
            <div className="space-y-2">
              <Label>
                {direction === 'outgoing' ? 'Sent To' : 'Received From'}
              </Label>
              
              {/* Selected Stakeholders */}
              {selectedStakeholders.length > 0 && (
                <div className="flex flex-wrap gap-2 p-3 rounded-lg border bg-muted/50">
                  {selectedStakeholders.map((stakeholder) => (
                    <Badge
                      key={stakeholder.id}
                      variant="secondary"
                      className="flex items-center gap-1.5 px-2.5 py-1"
                    >
                      {stakeholder.is_primary_contact && (
                        <Crown className="h-3 w-3 text-amber-500" />
                      )}
                      <span>{stakeholder.name}</span>
                      {stakeholder.job_title && (
                        <span className="text-muted-foreground">({stakeholder.job_title})</span>
                      )}
                      <button
                        type="button"
                        onClick={() => handleRemoveStakeholder(stakeholder.id)}
                        className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              
              {/* Add Stakeholder Button */}
              <Popover open={stakeholderPopoverOpen} onOpenChange={setStakeholderPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-start font-normal"
                  >
                    <User className="h-4 w-4 mr-2" />
                    {selectedStakeholders.length > 0 
                      ? 'Add another stakeholder...'
                      : 'Select stakeholder(s) or enter manually...'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0" align="start">
                  <Command>
                    <CommandInput
                      placeholder="Search stakeholders..."
                      value={searchValue}
                      onValueChange={setSearchValue}
                    />
                    <CommandList>
                      <CommandEmpty>
                        <div className="py-4 text-center text-sm text-muted-foreground">
                          No more stakeholders found.
                          <p className="mt-1">Enter contact name manually below.</p>
                        </div>
                      </CommandEmpty>
                      {filteredStakeholders.length > 0 && (
                        <CommandGroup heading="Account Stakeholders">
                          {filteredStakeholders.map((stakeholder) => (
                            <CommandItem
                              key={stakeholder.id}
                              onSelect={() => handleSelectStakeholder(stakeholder)}
                              className="cursor-pointer"
                            >
                              <div className="flex items-center gap-2 flex-1">
                                {stakeholder.is_primary_contact ? (
                                  <Crown className="h-4 w-4 text-amber-500" />
                                ) : (
                                  <User className="h-4 w-4 text-muted-foreground" />
                                )}
                                <div className="flex-1">
                                  <p className="font-medium">{stakeholder.name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {stakeholder.job_title || 'No title'}
                                    {stakeholder.influence_level && (
                                      <> • {influenceLevelLabels[stakeholder.influence_level]}</>
                                    )}
                                  </p>
                                </div>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      )}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>

              {/* Link status hint */}
              {selectedStakeholders.length === 0 && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Link2Off className="h-3 w-3" />
                  Not linked to stakeholders - enter contact info manually below
                </p>
              )}
              {selectedStakeholders.length > 0 && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Link2 className="h-3 w-3" />
                  {selectedStakeholders.length} stakeholder{selectedStakeholders.length !== 1 ? 's' : ''} linked
                </p>
              )}
            </div>

            {/* Subject */}
            <div className="space-y-2">
              <Label htmlFor="edit-subject">Subject Line (optional)</Label>
              <Input
                id="edit-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Re: Follow-up from our call..."
              />
            </div>

            {/* Email Body */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="edit-body">Email Body *</Label>
                <span className="text-xs text-muted-foreground">
                  {body.length.toLocaleString()} characters
                </span>
              </div>
              <Textarea
                id="edit-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Paste the email content here..."
                className="min-h-[200px] text-sm"
                required
              />
              <p className="text-xs text-muted-foreground">
                Tip: Paste the most recent email in the thread for best AI context
              </p>
            </div>

            {/* Date and Contact Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-emailDate">Date</Label>
                <Input
                  id="edit-emailDate"
                  type="date"
                  value={emailDate}
                  onChange={(e) => setEmailDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-contactName">
                  {direction === 'outgoing' ? 'Sent To (Name)' : 'Received From (Name)'}
                </Label>
                <Input
                  id="edit-contactName"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="John Smith"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-contactEmail">Contact Email (optional)</Label>
              <Input
                id="edit-contactEmail"
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="john@company.com"
              />
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="edit-notes">Your Notes (optional)</Label>
              <Textarea
                id="edit-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any context or follow-up thoughts..."
                className="min-h-[60px]"
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
