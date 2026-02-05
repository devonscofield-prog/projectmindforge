import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Loader2, CalendarIcon } from 'lucide-react';
import { format, addDays } from 'date-fns';

interface BulkRescheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  count: number;
  onConfirm: (dueDate: string) => void;
  isPending: boolean;
}

const QUICK_OPTIONS = [
  { label: 'Tomorrow', days: 1 },
  { label: 'In 3 days', days: 3 },
  { label: 'In 1 week', days: 7 },
  { label: 'In 2 weeks', days: 14 },
];

export function BulkRescheduleDialog({ open, onOpenChange, count, onConfirm, isPending }: BulkRescheduleDialogProps) {
  const [customDate, setCustomDate] = useState('');

  const handleQuick = (days: number) => {
    onConfirm(format(addDays(new Date(), days), 'yyyy-MM-dd'));
  };

  const handleCustom = () => {
    if (!customDate) return;
    onConfirm(customDate);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Reschedule {count} task{count !== 1 ? 's' : ''}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {QUICK_OPTIONS.map(opt => (
              <Button
                key={opt.days}
                variant="outline"
                size="sm"
                disabled={isPending}
                onClick={() => handleQuick(opt.days)}
              >
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : opt.label}
              </Button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">or pick a date</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <div>
            <Label htmlFor="bulk-date">Custom date</Label>
            <div className="flex gap-2 mt-1">
              <Input
                id="bulk-date"
                type="date"
                value={customDate}
                onChange={e => setCustomDate(e.target.value)}
                min={format(new Date(), 'yyyy-MM-dd')}
              />
              <Button onClick={handleCustom} disabled={!customDate || isPending} size="sm">
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                  <>
                    <CalendarIcon className="h-4 w-4 mr-1" />
                    Set
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
