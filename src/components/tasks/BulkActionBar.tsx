import { Button } from '@/components/ui/button';
import { CheckCircle2, X, CalendarIcon, Loader2 } from 'lucide-react';

interface BulkActionBarProps {
  selectedCount: number;
  onComplete: () => void;
  onDismiss: () => void;
  onReschedule: () => void;
  onClearSelection: () => void;
  isActioning: boolean;
}

export function BulkActionBar({
  selectedCount, onComplete, onDismiss, onReschedule, onClearSelection, isActioning,
}: BulkActionBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="flex items-center gap-2 p-3 rounded-lg border bg-primary/5 border-primary/20">
      <span className="text-sm font-medium mr-auto">
        {selectedCount} selected
      </span>
      <Button size="sm" variant="outline" onClick={onComplete} disabled={isActioning}>
        {isActioning ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
        Complete
      </Button>
      <Button size="sm" variant="outline" onClick={onReschedule} disabled={isActioning}>
        <CalendarIcon className="h-4 w-4 mr-1" />
        Reschedule
      </Button>
      <Button size="sm" variant="outline" onClick={onDismiss} disabled={isActioning} className="text-destructive hover:text-destructive">
        <X className="h-4 w-4 mr-1" />
        Dismiss
      </Button>
      <Button size="sm" variant="ghost" onClick={onClearSelection} className="text-muted-foreground">
        Clear
      </Button>
    </div>
  );
}
