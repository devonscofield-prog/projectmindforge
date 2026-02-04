import { useState, useEffect } from 'react';
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
import { CalendarIcon, Loader2, Bell, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createManualFollowUp, type FollowUpPriority, type FollowUpCategory } from '@/api/accountFollowUps';
import { REMINDER_TIMES } from '@/api/notificationPreferences';
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
  { value: 'phone_call', label: 'Phone Call' },
  { value: 'drip_email', label: 'DRIP Email' },
  { value: 'text_message', label: 'Text Message' },
  { value: 'follow_up_email', label: 'Follow Up Email' },
];

const DEFAULT_REMINDER_TIME = '09:00';

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
  const [category, setCategory] = useState<FollowUpCategory>('phone_call');
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [reminderTime, setReminderTime] = useState(DEFAULT_REMINDER_TIME);
  const [reminderEnabled, setReminderEnabled] = useState(true); // Default ON
  const [isSaving, setIsSaving] = useState(false);

  // When due date is selected, ensure reminder is enabled by default
  useEffect(() => {
    if (dueDate && !reminderEnabled) {
      setReminderEnabled(true);
    }
  }, [dueDate]);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setPriority('medium');
    setCategory('phone_call');
    setDueDate(undefined);
    setReminderTime(DEFAULT_REMINDER_TIME);
    setReminderEnabled(true);
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
        reminderEnabled: dueDate ? reminderEnabled : false,
        reminderTime: dueDate && reminderEnabled ? reminderTime : undefined,
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

  const getReminderTimeLabel = (value: string) => {
    return REMINDER_TIMES.find(t => t.value === value)?.label ?? value;
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

          {/* Due Date and Reminder Time */}
          <div className="space-y-2">
            <Label>Due Date & Reminder Time</Label>
            <div className="grid grid-cols-2 gap-2">
              {/* Date Picker */}
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
                    {dueDate ? format(dueDate, 'MMM d, yyyy') : 'Pick a date'}
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

              {/* Time Picker - only enabled when date is selected */}
              <Select
                value={reminderTime}
                onValueChange={setReminderTime}
                disabled={!dueDate}
              >
                <SelectTrigger className={cn(!dueDate && 'text-muted-foreground')}>
                  <Clock className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Time" />
                </SelectTrigger>
                <SelectContent>
                  {REMINDER_TIMES.map((time) => (
                    <SelectItem key={time.value} value={time.value}>
                      {time.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Reminder Toggle - only show when date is selected */}
          {dueDate && (
            <div className="rounded-lg border bg-muted/50 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="reminder-enabled"
                  checked={reminderEnabled}
                  onCheckedChange={(checked) => setReminderEnabled(checked === true)}
                />
                <Label
                  htmlFor="reminder-enabled"
                  className="text-sm font-medium flex items-center gap-1.5 cursor-pointer"
                >
                  <Bell className="h-4 w-4" />
                  Send email reminder
                </Label>
              </div>
              {reminderEnabled && (
                <p className="text-xs text-muted-foreground pl-6">
                  You'll receive an email at {getReminderTimeLabel(reminderTime)} on {format(dueDate, 'MMMM d, yyyy')}
                </p>
              )}
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
