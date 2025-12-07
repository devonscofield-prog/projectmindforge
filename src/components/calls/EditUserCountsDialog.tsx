import { useState, useEffect } from 'react';
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
import { Loader2 } from 'lucide-react';

interface EditUserCountsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentItUsers: number | null;
  currentEndUsers: number | null;
  onSave: (itUsers: number | null, endUsers: number | null) => void;
  isSaving: boolean;
}

export function EditUserCountsDialog({
  open,
  onOpenChange,
  currentItUsers,
  currentEndUsers,
  onSave,
  isSaving,
}: EditUserCountsDialogProps) {
  const [itUsers, setItUsers] = useState<string>('');
  const [endUsers, setEndUsers] = useState<string>('');

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setItUsers(currentItUsers?.toString() ?? '');
      setEndUsers(currentEndUsers?.toString() ?? '');
    }
  }, [open, currentItUsers, currentEndUsers]);

  const handleSave = () => {
    const parsedItUsers = itUsers.trim() === '' ? null : parseInt(itUsers, 10);
    const parsedEndUsers = endUsers.trim() === '' ? null : parseInt(endUsers, 10);
    
    // Validate that if a value is entered, it's a valid positive number
    if (itUsers.trim() !== '' && (isNaN(parsedItUsers!) || parsedItUsers! < 0)) {
      return;
    }
    if (endUsers.trim() !== '' && (isNaN(parsedEndUsers!) || parsedEndUsers! < 0)) {
      return;
    }

    onSave(parsedItUsers, parsedEndUsers);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Edit User Counts</DialogTitle>
          <DialogDescription>
            Correct the AI-extracted user counts if they're inaccurate.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="itUsers">IT Users</Label>
            <Input
              id="itUsers"
              type="number"
              min="0"
              placeholder="Enter count or leave empty"
              value={itUsers}
              onChange={(e) => setItUsers(e.target.value)}
            />
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="endUsers">End Users</Label>
            <Input
              id="endUsers"
              type="number"
              min="0"
              placeholder="Enter count or leave empty"
              value={endUsers}
              onChange={(e) => setEndUsers(e.target.value)}
            />
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
