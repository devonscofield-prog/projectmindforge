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
import { toast } from 'sonner';
import { ArrowUpRight, ArrowDownLeft, Loader2, Crown, User, Check, Link2, Link2Off } from 'lucide-react';
import { createEmailLog, type EmailDirection } from '@/api/emailLogs';
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

const log = createLogger('AddEmailLogDialog');

interface AddEmailLogDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prospectId: string;
  repId: string;
  stakeholders: Stakeholder[];
  onEmailAdded: () => void;
}

export function AddEmailLogDialog({
  open,
  onOpenChange,
  prospectId,
  repId,
  stakeholders,
  onEmailAdded,
}: AddEmailLogDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [direction, setDirection] = useState<EmailDirection>('outgoing');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [emailDate, setEmailDate] = useState(new Date().toISOString().split('T')[0]);
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedStakeholder, setSelectedStakeholder] = useState<Stakeholder | null>(null);
  const [stakeholderPopoverOpen, setStakeholderPopoverOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');

  const resetForm = () => {
    setDirection('outgoing');
    setSubject('');
    setBody('');
    setEmailDate(new Date().toISOString().split('T')[0]);
    setContactName('');
    setContactEmail('');
    setNotes('');
    setSelectedStakeholder(null);
    setSearchValue('');
  };

  // When stakeholder is selected, auto-fill contact info
  useEffect(() => {
    if (selectedStakeholder) {
      setContactName(selectedStakeholder.name);
      setContactEmail(selectedStakeholder.email || '');
    }
  }, [selectedStakeholder]);

  const handleSelectStakeholder = (stakeholder: Stakeholder) => {
    setSelectedStakeholder(stakeholder);
    setStakeholderPopoverOpen(false);
    setSearchValue('');
  };

  const handleClearStakeholder = () => {
    setSelectedStakeholder(null);
    setContactName('');
    setContactEmail('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!body.trim()) {
      toast.error('Email body is required');
      return;
    }

    setIsSubmitting(true);
    try {
      await createEmailLog({
        prospectId,
        repId,
        direction,
        subject: subject || undefined,
        body: body.trim(),
        emailDate,
        contactName: contactName || undefined,
        contactEmail: contactEmail || undefined,
        notes: notes || undefined,
        stakeholderId: selectedStakeholder?.id,
      });
      
      toast.success('Email logged successfully');
      resetForm();
      onOpenChange(false);
      onEmailAdded();
    } catch (error) {
      log.error('Failed to log email', { error });
      toast.error('Failed to log email');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter stakeholders based on search
  const filteredStakeholders = stakeholders.filter(s => 
    s.name.toLowerCase().includes(searchValue.toLowerCase()) ||
    (s.job_title && s.job_title.toLowerCase().includes(searchValue.toLowerCase()))
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Log Email Communication</DialogTitle>
        </DialogHeader>
        
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

          {/* Stakeholder Selector */}
          <div className="space-y-2">
            <Label>
              {direction === 'outgoing' ? 'Sent To' : 'Received From'}
            </Label>
            
            {selectedStakeholder ? (
              <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/50">
                <div className="flex items-center gap-2">
                  <Link2 className="h-4 w-4 text-primary" />
                  <div className="flex items-center gap-1.5">
                    {selectedStakeholder.is_primary_contact && (
                      <Crown className="h-3.5 w-3.5 text-amber-500" />
                    )}
                    <span className="font-medium">{selectedStakeholder.name}</span>
                    {selectedStakeholder.job_title && (
                      <span className="text-muted-foreground">
                        ({selectedStakeholder.job_title})
                      </span>
                    )}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleClearStakeholder}
                  className="h-8"
                >
                  Change
                </Button>
              </div>
            ) : (
              <Popover open={stakeholderPopoverOpen} onOpenChange={setStakeholderPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-start font-normal"
                  >
                    <User className="h-4 w-4 mr-2" />
                    Select stakeholder or enter manually...
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
                          No stakeholders found.
                          <p className="mt-1">Enter contact name manually below.</p>
                        </div>
                      </CommandEmpty>
                      {stakeholders.length > 0 && (
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
            )}

            {/* Show manual entry hint if no stakeholder selected */}
            {!selectedStakeholder && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Link2Off className="h-3 w-3" />
                Not linked to a stakeholder - enter contact info manually below
              </p>
            )}
          </div>

          {/* Subject */}
          <div className="space-y-2">
            <Label htmlFor="subject">Subject Line (optional)</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Re: Follow-up from our call..."
            />
          </div>

          {/* Email Body */}
          <div className="space-y-2">
            <Label htmlFor="body">Email Body *</Label>
            <Textarea
              id="body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Paste the email content here..."
              className="min-h-[200px] font-mono text-sm"
              required
            />
          </div>

          {/* Date and Contact Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="emailDate">Date</Label>
              <Input
                id="emailDate"
                type="date"
                value={emailDate}
                onChange={(e) => setEmailDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactName">
                {direction === 'outgoing' ? 'Sent To (Name)' : 'Received From (Name)'}
              </Label>
              <Input
                id="contactName"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="John Smith"
                disabled={!!selectedStakeholder}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="contactEmail">Contact Email (optional)</Label>
            <Input
              id="contactEmail"
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="john@company.com"
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Your Notes (optional)</Label>
            <Textarea
              id="notes"
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
                'Log Email'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}