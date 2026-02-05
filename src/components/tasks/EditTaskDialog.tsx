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
import { format, addDays, parseISO } from 'date-fns';
import { CalendarIcon, Loader2, Bell, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { type AccountFollowUp, type FollowUpPriority, type FollowUpCategory } from '@/api/accountFollowUps';
import { useUpdateFollowUp } from '@/hooks/useUpdateFollowUp';
import { REMINDER_TIMES } from '@/api/notificationPreferences';

interface EditTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: AccountFollowUp;
  accountName?: string;
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

export function EditTaskDialog({ open, onOpenChange, task, accountName }: EditTaskDialogProps) {
  const updateMutation = useUpdateFollowUp();
  
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || '');
  const [priority, setPriority] = useState<FollowUpPriority>((task.priority as FollowUpPriority) || 'medium');
  const [category, setCategory] = useState<string>(task.category || 'phone_call');
  const [dueDate, setDueDate] = useState<Date | undefined>(task.due_date ? parseISO(task.due_date) : undefined);
  const [reminderTime, setReminderTime] = useState(task.reminder_time || DEFAULT_REMINDER_TIME);
  const [reminderEnabled, setReminderEnabled] = useState(task.reminder_enabled ?? true);

  // Sync form when task changes
  useEffect(() => {
    setTitle(task.title);
    setDescription(task.description || '');
    setPriority((task.priority as FollowUpPriority) || 'medium');
    setCategory(task.category || 'phone_call');
    setDueDate(task.due_date ? parseISO(task.due_date) : undefined);
    setReminderTime(task.reminder_time || DEFAULT_REMINDER_TIME);
    setReminderEnabled(task.reminder_enabled ?? true);
  }, [task]);

  const handleSave = async () => {
    if (!title.trim()) return;

    updateMutation.mutate({
      id: task.id,
      fields: {
        title: title.trim(),
        description: description.trim() || null,
        priority,
        category: category as FollowUpCategory,
        due_date: dueDate ? format(dueDate, 'yyyy-MM-dd') : null,
        reminder_enabled: dueDate ? reminderEnabled : false,
        reminder_time: dueDate && reminderEnabled ? reminderTime : null,
      },
    }, {
      onSuccess: () => onOpenChange(false),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Task</DialogTitle>
          <DialogDescription>
            {accountName ? `Task for ${accountName}` : 'Update task details'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="edit-task-title">Task Title *</Label>
            <Input
              id="edit-task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-task-description">Description</Label>
            <Textarea
              id="edit-task-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as FollowUpPriority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {categoryOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Due Date & Reminder Time</Label>
            <div className="grid grid-cols-2 gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn('w-full justify-start text-left font-normal', !dueDate && 'text-muted-foreground')}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dueDate ? format(dueDate, 'MMM d, yyyy') : 'Pick a date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <div className="p-2 border-b">
                    <div className="flex flex-wrap gap-1">
                      {quickDueDates.map((q) => (
                        <Button key={q.days} variant="ghost" size="sm" className="h-7 text-xs"
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

              <Select value={reminderTime} onValueChange={setReminderTime} disabled={!dueDate}>
                <SelectTrigger className={cn(!dueDate && 'text-muted-foreground')}>
                  <Clock className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Time" />
                </SelectTrigger>
                <SelectContent>
                  {REMINDER_TIMES.map((time) => (
                    <SelectItem key={time.value} value={time.value}>{time.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {dueDate && (
            <div className="rounded-lg border bg-muted/50 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="edit-reminder-enabled"
                  checked={reminderEnabled}
                  onCheckedChange={(checked) => setReminderEnabled(checked === true)}
                />
                <Label htmlFor="edit-reminder-enabled" className="text-sm font-medium flex items-center gap-1.5 cursor-pointer">
                  <Bell className="h-4 w-4" />
                  Send email reminder
                </Label>
              </div>
              {reminderEnabled && (
                <p className="text-xs text-muted-foreground pl-6">
                  Reminder at {REMINDER_TIMES.find(t => t.value === reminderTime)?.label ?? reminderTime} on {format(dueDate, 'MMMM d, yyyy')}
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={updateMutation.isPending}>Cancel</Button>
          <Button onClick={handleSave} disabled={updateMutation.isPending || !title.trim()}>
            {updateMutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</> : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
