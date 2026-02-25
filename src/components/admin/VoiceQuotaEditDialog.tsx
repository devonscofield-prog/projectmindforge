import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useUpdateVoiceQuota } from '@/hooks/sdr/audioHooks';

interface VoiceQuotaEditDialogProps {
  userId: string;
  userName: string;
  currentLimit: number;
  currentUsed: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function VoiceQuotaEditDialog({
  userId,
  userName,
  currentLimit,
  currentUsed,
  open,
  onOpenChange,
}: VoiceQuotaEditDialogProps) {
  const [newLimit, setNewLimit] = useState(currentLimit);
  const updateQuota = useUpdateVoiceQuota();

  const handleSave = () => {
    updateQuota.mutate(
      {
        scope: 'individual',
        targetId: userId,
        monthlyLimit: newLimit,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
        },
      },
    );
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setNewLimit(currentLimit);
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Voice Quota</DialogTitle>
          <DialogDescription>
            Update the monthly voice analysis limit for {userName}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="text-sm text-muted-foreground">
            Current usage: <span className="font-medium text-foreground">{currentUsed}</span> of{' '}
            <span className="font-medium text-foreground">{currentLimit}</span> analyses used this
            month
          </div>

          <div className="space-y-2">
            <Label htmlFor="monthly-limit">New Monthly Limit</Label>
            <Input
              id="monthly-limit"
              type="number"
              min={0}
              max={1000}
              value={newLimit}
              onChange={(e) => setNewLimit(Math.max(0, parseInt(e.target.value, 10) || 0))}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={updateQuota.isPending}>
            {updateQuota.isPending ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
