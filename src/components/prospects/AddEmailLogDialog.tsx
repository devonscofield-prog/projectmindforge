import { useState } from 'react';
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
import { useToast } from '@/hooks/use-toast';
import { ArrowUpRight, ArrowDownLeft, Loader2 } from 'lucide-react';
import { createEmailLog, type EmailDirection } from '@/api/emailLogs';
import { cn } from '@/lib/utils';

interface AddEmailLogDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prospectId: string;
  repId: string;
  onEmailAdded: () => void;
}

export function AddEmailLogDialog({
  open,
  onOpenChange,
  prospectId,
  repId,
  onEmailAdded,
}: AddEmailLogDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [direction, setDirection] = useState<EmailDirection>('outgoing');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [emailDate, setEmailDate] = useState(new Date().toISOString().split('T')[0]);
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [notes, setNotes] = useState('');

  const resetForm = () => {
    setDirection('outgoing');
    setSubject('');
    setBody('');
    setEmailDate(new Date().toISOString().split('T')[0]);
    setContactName('');
    setContactEmail('');
    setNotes('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!body.trim()) {
      toast({ title: 'Email body is required', variant: 'destructive' });
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
      });
      
      toast({ title: 'Email logged successfully' });
      resetForm();
      onOpenChange(false);
      onEmailAdded();
    } catch (error) {
      console.error('Failed to log email:', error);
      toast({ title: 'Failed to log email', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

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
