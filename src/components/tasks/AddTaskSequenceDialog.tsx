import { useState, useEffect } from 'react';
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
import { useCreateTaskSequence, useUpdateTaskSequence } from '@/hooks/useTaskSequences';
import { Loader2 } from 'lucide-react';
import type { TaskSequence } from '@/api/taskSequences';

interface AddTaskSequenceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editSequence?: TaskSequence | null;
}

export function AddTaskSequenceDialog({ open, onOpenChange, editSequence }: AddTaskSequenceDialogProps) {
  const createMutation = useCreateTaskSequence();
  const updateMutation = useUpdateTaskSequence();
  const isEditing = !!editSequence;
  const isPending = createMutation.isPending || updateMutation.isPending;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (!open) return;
    if (editSequence) {
      setName(editSequence.name);
      setDescription(editSequence.description || '');
    } else {
      setName('');
      setDescription('');
    }
  }, [open, editSequence]);

  const handleSubmit = () => {
    if (!name.trim()) return;

    const params = {
      name: name.trim(),
      description: description.trim() || undefined,
    };

    if (isEditing && editSequence) {
      updateMutation.mutate(
        { id: editSequence.id, params },
        { onSuccess: () => onOpenChange(false) }
      );
    } else {
      createMutation.mutate(params, {
        onSuccess: () => onOpenChange(false),
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Sequence' : 'New Task Sequence'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="seq-name">Name *</Label>
            <Input
              id="seq-name"
              value={name}
              onChange={e => setName(e.target.value.slice(0, 100))}
              maxLength={100}
              placeholder="e.g. Discovery Follow-Up"
            />
          </div>
          <div>
            <Label htmlFor="seq-desc">Description</Label>
            <Textarea
              id="seq-desc"
              value={description}
              onChange={e => setDescription(e.target.value.slice(0, 500))}
              maxLength={500}
              placeholder="Optional description"
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!name.trim() || isPending}>
            {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isEditing ? 'Save Changes' : 'Create Sequence'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
