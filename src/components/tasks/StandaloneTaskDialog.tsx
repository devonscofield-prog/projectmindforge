import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
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
import { CalendarIcon, Loader2, Bell, Clock, ChevronsUpDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createManualFollowUp, type FollowUpPriority, type FollowUpCategory } from '@/api/accountFollowUps';
import { REMINDER_TIMES } from '@/api/notificationPreferences';
import { supabase } from '@/integrations/supabase/client';
import { TITLE_MAX_LENGTH, DESCRIPTION_MAX_LENGTH } from '@/lib/taskConstants';

interface StandaloneTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  repId: string;
  onTaskCreated?: () => void;
  initialTitle?: string;
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

export function StandaloneTaskDialog({ open, onOpenChange, repId, onTaskCreated, initialTitle }: StandaloneTaskDialogProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<FollowUpPriority>('medium');
  const [category, setCategory] = useState<FollowUpCategory>('phone_call');
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [reminderTime, setReminderTime] = useState(DEFAULT_REMINDER_TIME);
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedProspectId, setSelectedProspectId] = useState<string>('');
  const [accountPickerOpen, setAccountPickerOpen] = useState(false);

  // Fetch rep's prospects for the account picker
  const { data: prospects = [] } = useQuery({
    queryKey: ['rep-prospects-list', repId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('prospects')
        .select('id, prospect_name, account_name')
        .eq('rep_id', repId)
        .is('deleted_at', null)
        .order('prospect_name');
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      resetForm();
      if (initialTitle) setTitle(initialTitle);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialTitle]);

  useEffect(() => {
    if (dueDate && !reminderEnabled) {
      setReminderEnabled(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dueDate]);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setPriority('medium');
    setCategory('phone_call');
    setDueDate(undefined);
    setReminderTime(DEFAULT_REMINDER_TIME);
    setReminderEnabled(true);
    setSelectedProspectId('');
  };

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error('Please enter a task title');
      return;
    }
    if (!selectedProspectId) {
      toast.error('Please select an account');
      return;
    }

    setIsSaving(true);
    try {
      await createManualFollowUp({
        prospectId: selectedProspectId,
        repId,
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        category,
        dueDate: dueDate ? format(dueDate, 'yyyy-MM-dd') : undefined,
        reminderEnabled: dueDate ? reminderEnabled : false,
        reminderTime: dueDate && reminderEnabled ? reminderTime : undefined,
      });

      toast.success('Task created', { description: title });
      resetForm();
      onOpenChange(false);
      onTaskCreated?.();
    } catch {
      toast.error('Failed to create task');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const selectedProspect = prospects.find(p => p.id === selectedProspectId);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Task</DialogTitle>
          <DialogDescription>Create a standalone follow-up task</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Account Picker */}
          <div className="space-y-2">
            <Label>Account *</Label>
            <Popover open={accountPickerOpen} onOpenChange={setAccountPickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={accountPickerOpen}
                  className="w-full justify-between font-normal"
                >
                  {selectedProspect
                    ? (selectedProspect.account_name || selectedProspect.prospect_name)
                    : 'Select an account...'}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search accounts..." />
                  <CommandList>
                    <CommandEmpty>No accounts found.</CommandEmpty>
                    <CommandGroup>
                      {prospects.map((p) => (
                        <CommandItem
                          key={p.id}
                          value={p.account_name || p.prospect_name}
                          onSelect={() => {
                            setSelectedProspectId(p.id);
                            setAccountPickerOpen(false);
                          }}
                        >
                          <Check className={cn('mr-2 h-4 w-4', selectedProspectId === p.id ? 'opacity-100' : 'opacity-0')} />
                          {p.account_name || p.prospect_name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label htmlFor="standalone-task-title">Task Title *</Label>
            <Input
              id="standalone-task-title"
              placeholder="e.g., Schedule follow-up demo"
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, TITLE_MAX_LENGTH))}
              maxLength={TITLE_MAX_LENGTH}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="standalone-task-desc">Description (optional)</Label>
            <Textarea
              id="standalone-task-desc"
              placeholder="Add any additional context..."
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, DESCRIPTION_MAX_LENGTH))}
              maxLength={DESCRIPTION_MAX_LENGTH}
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
              <Select value={category} onValueChange={(v) => setCategory(v as FollowUpCategory)}>
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
                  id="standalone-reminder"
                  checked={reminderEnabled}
                  onCheckedChange={(checked) => setReminderEnabled(checked === true)}
                />
                <Label htmlFor="standalone-reminder" className="text-sm font-medium flex items-center gap-1.5 cursor-pointer">
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
          <Button variant="outline" onClick={handleClose} disabled={isSaving}>Cancel</Button>
          <Button onClick={handleSave} disabled={isSaving || !title.trim() || !selectedProspectId}>
            {isSaving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creating...</> : 'Create Task'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
