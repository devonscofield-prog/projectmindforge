import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { format, addDays } from 'date-fns';
import { CalendarIcon, Loader2, Bell } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createManualFollowUp, type FollowUpPriority, type FollowUpCategory } from '@/api/accountFollowUps';
import { createLogger } from '@/lib/logger';

const log = createLogger('AddCustomTaskDialog');

interface AddCustomTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  callId: string;
  prospectId: string | null;
  repId: string;
  accountName: string | null;
  onTaskCreated?: () => void;
}

const quickDueDates = [
  { label: 'Tomorrow', days: 1 },
  { label: 'In 3 days', days: 3 },
  { label: 'In 1 week', days: 7 },
  { label: 'In 2 weeks', days: 14 },
];

const categoryOptions: { value: FollowUpCategory; label: string }[] = [
  { value: 'discovery', label: 'Discovery' },
  { value: 'stakeholder', label: 'Stakeholder' },
  { value: 'objection', label: 'Objection' },
  { value: 'proposal', label: 'Proposal' },
  { value: 'relationship', label: 'Relationship' },
  { value: 'competitive', label: 'Competitive' },
];

export function AddCustomTaskDialog({
  open,
  onOpenChange,
  callId,
  prospectId,
  repId,
  accountName,
  onTaskCreated,
}: AddCustomTaskDialogProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<FollowUpPriority>('medium');
  const [category, setCategory] = useState<FollowUpCategory>('discovery');
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setPriority('medium');
    setCategory('discovery');
    setDueDate(undefined);
    setReminderEnabled(false);
  };

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error('Please enter a task title');
      return;
    }

    if (!prospectId) {
      toast.error('Cannot create task', { description: 'This call is not linked to an account' });
      return;
    }

    setIsSaving(true);
    try {
      await createManualFollowUp({
        prospectId,
        repId,
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        category,
        dueDate: dueDate ? format(dueDate, 'yyyy-MM-dd') : undefined,
        reminderEnabled,
        sourceCallId: callId,
      });

      toast.success('Task created', { description: title });
      resetForm();
      onOpenChange(false);
      onTaskCreated?.();
    } catch (error) {
      log.error('Failed to create custom task', { error });
      toast.error('Failed to create task');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Custom Follow-Up Task</DialogTitle>
          <DialogDescription>
            Create a manual task for {accountName || 'this account'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="task-title">Task Title *</Label>
            <Input
              id="task-title"
              placeholder="e.g., Schedule follow-up demo with IT team"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="task-description">Description (optional)</Label>
            <Textarea
              id="task-description"
              placeholder="Add any additional context..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          {/* Priority and Category */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as FollowUpPriority)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as FollowUpCategory)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categoryOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Due Date */}
          <div className="space-y-2">
            <Label>Due Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !dueDate && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dueDate ? format(dueDate, 'PPP') : 'Pick a date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <div className="p-2 border-b">
                  <div className="flex flex-wrap gap-1">
                    {quickDueDates.map((q) => (
                      <Button
                        key={q.days}
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => setDueDate(addDays(new Date(), q.days))}
                      >
                        {q.label}
                      </Button>
                    ))}
                  </div>
                </div>
                <Calendar
                  mode="single"
                  selected={dueDate}
                  onSelect={setDueDate}
                  disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Reminder Toggle */}
          {dueDate && (
            <div className="flex items-center gap-2">
              <Checkbox
                id="reminder-enabled"
                checked={reminderEnabled}
                onCheckedChange={(checked) => setReminderEnabled(checked === true)}
              />
              <Label
                htmlFor="reminder-enabled"
                className="text-sm text-muted-foreground flex items-center gap-1 cursor-pointer"
              >
                <Bell className="h-4 w-4" />
                Send email reminder when due
              </Label>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !title.trim()}>
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Task'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
