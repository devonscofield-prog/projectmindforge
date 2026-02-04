import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import { CalendarIcon, Plus, Trash2, Loader2, Bell, Target } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createManualFollowUps, type FollowUpPriority } from '@/api/accountFollowUps';
import { createLogger } from '@/lib/logger';

const log = createLogger('PostCallTasksDialog');

interface TaskEntry {
  id: string;
  title: string;
  priority: FollowUpPriority;
  dueDate: Date | undefined;
  reminderEnabled: boolean;
}

interface PostCallTasksDialogProps {
  open: boolean;
  callId: string;
  prospectId: string;
  repId: string;
  accountName: string;
  onClose: () => void;
  onComplete: () => void;
}

const MAX_TASKS = 5;

const quickDueDates = [
  { label: 'Tomorrow', days: 1 },
  { label: 'In 3 days', days: 3 },
  { label: 'In 1 week', days: 7 },
  { label: 'In 2 weeks', days: 14 },
];

function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

export function PostCallTasksDialog({
  open,
  callId,
  prospectId,
  repId,
  accountName,
  onClose,
  onComplete,
}: PostCallTasksDialogProps) {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<TaskEntry[]>([
    { id: generateId(), title: '', priority: 'medium', dueDate: undefined, reminderEnabled: false },
  ]);
  const [isSaving, setIsSaving] = useState(false);

  const addTask = useCallback(() => {
    if (tasks.length >= MAX_TASKS) return;
    setTasks(prev => [
      ...prev,
      { id: generateId(), title: '', priority: 'medium', dueDate: undefined, reminderEnabled: false },
    ]);
  }, [tasks.length]);

  const removeTask = useCallback((id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
  }, []);

  const updateTask = useCallback((id: string, updates: Partial<TaskEntry>) => {
    setTasks(prev => prev.map(t => (t.id === id ? { ...t, ...updates } : t)));
  }, []);

  const setQuickDueDate = useCallback((id: string, days: number) => {
    updateTask(id, { dueDate: addDays(new Date(), days) });
  }, [updateTask]);

  const handleSkip = () => {
    onClose();
    onComplete();
  };

  const handleSave = async () => {
    // Filter out empty tasks
    const validTasks = tasks.filter(t => t.title.trim().length > 0);
    
    if (validTasks.length === 0) {
      handleSkip();
      return;
    }

    setIsSaving(true);
    try {
      await createManualFollowUps(
        validTasks.map(t => ({
          prospectId,
          repId,
          title: t.title.trim(),
          priority: t.priority,
          dueDate: t.dueDate ? format(t.dueDate, 'yyyy-MM-dd') : undefined,
          reminderEnabled: t.reminderEnabled,
          sourceCallId: callId,
        }))
      );

      toast.success(`Created ${validTasks.length} follow-up task${validTasks.length > 1 ? 's' : ''}`);
      onClose();
      onComplete();
    } catch (error) {
      log.error('Error creating follow-up tasks', { error });
      toast.error('Failed to create tasks', { description: 'Please try again' });
    } finally {
      setIsSaving(false);
    }
  };

  const hasValidTasks = tasks.some(t => t.title.trim().length > 0);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleSkip()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Add Follow-Up Tasks
          </DialogTitle>
          <DialogDescription>
            Create personal accountability tasks for <span className="font-medium">{accountName}</span>. 
            These will appear in your dashboard alongside AI-generated follow-ups.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
          {tasks.map((task, index) => (
            <div key={task.id} className="space-y-3 p-4 rounded-lg border bg-muted/30">
              <div className="flex items-start gap-2">
                <div className="flex-1 space-y-2">
                  <Label htmlFor={`task-${task.id}`} className="text-xs text-muted-foreground">
                    Task {index + 1}
                  </Label>
                  <Input
                    id={`task-${task.id}`}
                    placeholder="e.g., Send proposal, Schedule demo, Follow up on pricing..."
                    value={task.title}
                    onChange={(e) => updateTask(task.id, { title: e.target.value })}
                    className="text-sm"
                  />
                </div>
                {tasks.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive mt-6"
                    onClick={() => removeTask(task.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {/* Priority */}
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground">Priority:</Label>
                  <Select
                    value={task.priority}
                    onValueChange={(value: FollowUpPriority) => updateTask(task.id, { priority: value })}
                  >
                    <SelectTrigger className="h-8 w-24 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Due Date */}
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground">Due:</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className={cn(
                          'h-8 justify-start text-left font-normal text-xs',
                          !task.dueDate && 'text-muted-foreground'
                        )}
                      >
                        <CalendarIcon className="mr-2 h-3 w-3" />
                        {task.dueDate ? format(task.dueDate, 'MMM d') : 'Set date'}
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
                              onClick={() => setQuickDueDate(task.id, q.days)}
                            >
                              {q.label}
                            </Button>
                          ))}
                        </div>
                      </div>
                      <Calendar
                        mode="single"
                        selected={task.dueDate}
                        onSelect={(date) => updateTask(task.id, { dueDate: date })}
                        disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  {task.dueDate && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-muted-foreground"
                      onClick={() => updateTask(task.id, { dueDate: undefined })}
                    >
                      ×
                    </Button>
                  )}
                </div>

                {/* Reminder Toggle */}
                {task.dueDate && (
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id={`reminder-${task.id}`}
                      checked={task.reminderEnabled}
                      onCheckedChange={(checked) =>
                        updateTask(task.id, { reminderEnabled: checked === true })
                      }
                    />
                    <Label
                      htmlFor={`reminder-${task.id}`}
                      className="text-xs text-muted-foreground flex items-center gap-1 cursor-pointer"
                    >
                      <Bell className="h-3 w-3" />
                      Email reminder
                    </Label>
                  </div>
                )}
              </div>
            </div>
          ))}

          {tasks.length < MAX_TASKS && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              onClick={addTask}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add another task
            </Button>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="ghost" onClick={handleSkip} disabled={isSaving}>
            Skip for now
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : hasValidTasks ? (
              'Save & View Call'
            ) : (
              'View Call'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
