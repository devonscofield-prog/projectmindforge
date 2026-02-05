import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useCreateTaskTemplate } from '@/hooks/useTaskTemplates';
import { Loader2 } from 'lucide-react';

interface AddTaskTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DUE_DAY_PRESETS = [
  { label: 'Same day', value: 0 },
  { label: '1 day after', value: 1 },
  { label: '3 days after', value: 3 },
  { label: '7 days after', value: 7 },
  { label: '14 days after', value: 14 },
];

export function AddTaskTemplateDialog({ open, onOpenChange }: AddTaskTemplateDialogProps) {
  const createMutation = useCreateTaskTemplate();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [category, setCategory] = useState('');
  const [dueDaysOffset, setDueDaysOffset] = useState<string>('none');
  const [customDays, setCustomDays] = useState('');
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderTime, setReminderTime] = useState('09:00');

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setPriority('medium');
    setCategory('');
    setDueDaysOffset('none');
    setCustomDays('');
    setReminderEnabled(false);
    setReminderTime('09:00');
  };

  const handleSubmit = () => {
    if (!title.trim()) return;

    let offset: number | null = null;
    if (dueDaysOffset === 'custom') {
      offset = parseInt(customDays, 10);
      if (isNaN(offset) || offset < 0) offset = null;
    } else if (dueDaysOffset !== 'none') {
      offset = parseInt(dueDaysOffset, 10);
    }

    createMutation.mutate(
      {
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        category: category || undefined,
        due_days_offset: offset,
        reminder_enabled: reminderEnabled,
        reminder_time: reminderEnabled ? reminderTime : undefined,
      },
      {
        onSuccess: () => {
          resetForm();
          onOpenChange(false);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Task Template</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="tpl-title">Title *</Label>
            <Input id="tpl-title" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Send recap email" />
          </div>

          <div>
            <Label htmlFor="tpl-desc">Description</Label>
            <Textarea id="tpl-desc" value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional details" rows={2} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="phone_call">Phone Call</SelectItem>
                  <SelectItem value="drip_email">DRIP Email</SelectItem>
                  <SelectItem value="text_message">Text Message</SelectItem>
                  <SelectItem value="follow_up_email">Follow Up Email</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Due Date</Label>
            <Select value={dueDaysOffset} onValueChange={setDueDaysOffset}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No due date</SelectItem>
                {DUE_DAY_PRESETS.map(p => (
                  <SelectItem key={p.value} value={String(p.value)}>{p.label}</SelectItem>
                ))}
                <SelectItem value="custom">Custom...</SelectItem>
              </SelectContent>
            </Select>
            {dueDaysOffset === 'custom' && (
              <div className="flex items-center gap-2 mt-2">
                <Input
                  type="number"
                  min={0}
                  className="w-20"
                  value={customDays}
                  onChange={e => setCustomDays(e.target.value)}
                  placeholder="0"
                />
                <span className="text-sm text-muted-foreground">days after call</span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="tpl-reminder">Email Reminder</Label>
            <Switch id="tpl-reminder" checked={reminderEnabled} onCheckedChange={setReminderEnabled} />
          </div>

          {reminderEnabled && (
            <div>
              <Label>Reminder Time</Label>
              <Input type="time" value={reminderTime} onChange={e => setReminderTime(e.target.value)} />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!title.trim() || createMutation.isPending}>
            {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Add Template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
