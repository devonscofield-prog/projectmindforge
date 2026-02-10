import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Loader2, Layers } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useTaskSequences,
  useUpdateTaskSequence,
  useDeleteTaskSequence,
  useReorderTaskSequences,
} from '@/hooks/useTaskSequences';
import { useTaskTemplates } from '@/hooks/useTaskTemplates';
import { TaskSequenceCard } from './TaskSequenceCard';
import { AddTaskSequenceDialog } from './AddTaskSequenceDialog';
import type { TaskSequence } from '@/api/taskSequences';

export function TaskTemplatesSection() {
  const [showAdd, setShowAdd] = useState(false);
  const [editSequence, setEditSequence] = useState<TaskSequence | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const { data: sequences = [], isLoading: seqLoading } = useTaskSequences();
  const { data: templates = [], isLoading: tplLoading } = useTaskTemplates();
  const updateSequence = useUpdateTaskSequence();
  const deleteSequence = useDeleteTaskSequence();
  const reorderSequences = useReorderTaskSequences();
  const isLoading = seqLoading || tplLoading;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleConfirmDelete = () => {
    if (!confirmDeleteId) return;
    deleteSequence.mutate(confirmDeleteId);
    setConfirmDeleteId(null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = sequences.findIndex(s => s.id === active.id);
    const newIndex = sequences.findIndex(s => s.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = [...sequences];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved);

    const updates = reordered.map((s, i) => ({ id: s.id, sort_order: i }));
    reorderSequences.mutate(updates);
  };

  // Group templates by sequence_id
  const templatesBySequence = (seqId: string) =>
    templates.filter(t => t.sequence_id === seqId).sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium">
            Task Sequences ({sequences.length})
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Create named groups of tasks to apply when submitting calls
          </p>
        </div>
        <Button size="sm" onClick={() => setShowAdd(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Add Sequence
        </Button>
      </div>

      {/* Sequence list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : sequences.length === 0 ? (
        <div className="text-center py-12">
          <Layers className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
          <p className="text-sm font-medium text-muted-foreground">No task sequences yet</p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            Create a sequence of tasks that can be applied when you submit a call
          </p>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={sequences.map(s => s.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {sequences.map((seq) => (
                <TaskSequenceCard
                  key={seq.id}
                  sequence={seq}
                  templates={templatesBySequence(seq.id)}
                  onEdit={(s) => setEditSequence(s)}
                  onDelete={(id) => setConfirmDeleteId(id)}
                  onToggleActive={(id, active) =>
                    updateSequence.mutate({ id, params: { is_active: active } })
                  }
                  isDeleting={deleteSequence.isPending && deleteSequence.variables === seq.id}
                  isToggling={updateSequence.isPending && updateSequence.variables?.id === seq.id}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Add / Edit sequence dialog */}
      <AddTaskSequenceDialog
        open={showAdd || !!editSequence}
        onOpenChange={(open) => {
          if (!open) {
            setShowAdd(false);
            setEditSequence(null);
          }
        }}
        editSequence={editSequence}
      />

      {/* Delete confirmation */}
      <AlertDialog open={!!confirmDeleteId} onOpenChange={(open) => !open && setConfirmDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Sequence?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this sequence and all its tasks. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
