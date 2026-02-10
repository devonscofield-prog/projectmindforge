import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Plus, Trash2, Pencil, ChevronDown, ChevronRight, GripVertical, Loader2 } from 'lucide-react';
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
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { TaskTemplateRow } from './TaskTemplateRow';
import { AddTaskTemplateDialog } from './AddTaskTemplateDialog';
import type { TaskSequence } from '@/api/taskSequences';
import type { TaskTemplate } from '@/api/taskTemplates';
import {
  useUpdateTaskTemplate,
  useDeleteTaskTemplate,
  useReorderTaskTemplates,
} from '@/hooks/useTaskTemplates';

interface TaskSequenceCardProps {
  sequence: TaskSequence;
  templates: TaskTemplate[];
  onEdit: (sequence: TaskSequence) => void;
  onDelete: (id: string) => void;
  onToggleActive: (id: string, active: boolean) => void;
  isDeleting: boolean;
  isToggling: boolean;
}

export function TaskSequenceCard({
  sequence,
  templates,
  onEdit,
  onDelete,
  onToggleActive,
  isDeleting,
  isToggling,
}: TaskSequenceCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [editTemplate, setEditTemplate] = useState<TaskTemplate | null>(null);
  const [confirmDeleteTemplateId, setConfirmDeleteTemplateId] = useState<string | null>(null);

  const updateTemplate = useUpdateTaskTemplate();
  const deleteTemplate = useDeleteTaskTemplate();
  const reorderTemplates = useReorderTaskTemplates();

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: sequence.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = templates.findIndex(t => t.id === active.id);
    const newIndex = templates.findIndex(t => t.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = [...templates];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved);

    const updates = reordered.map((t, i) => ({ id: t.id, sort_order: i }));
    reorderTemplates.mutate(updates);
  };

  const handleConfirmDeleteTemplate = () => {
    if (!confirmDeleteTemplateId) return;
    deleteTemplate.mutate(confirmDeleteTemplateId);
    setConfirmDeleteTemplateId(null);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-lg border bg-card ${isDragging ? 'shadow-lg ring-2 ring-primary/30 opacity-90 z-50' : ''}`}
    >
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div className="flex items-center gap-3 p-3">
          {/* Drag handle */}
          <button
            className="touch-none cursor-grab active:cursor-grabbing p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors shrink-0"
            {...attributes}
            {...listeners}
            aria-label="Drag to reorder sequence"
          >
            <GripVertical className="h-4 w-4" />
          </button>

          <Switch
            checked={sequence.is_active}
            onCheckedChange={(checked) => onToggleActive(sequence.id, checked)}
            disabled={isToggling}
            aria-label={`Toggle ${sequence.name}`}
          />

          <CollapsibleTrigger asChild>
            <button className="flex-1 flex items-center gap-2 text-left min-w-0">
              {isOpen ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
              <span className={`text-sm font-medium truncate ${!sequence.is_active ? 'text-muted-foreground line-through' : ''}`}>
                {sequence.name}
              </span>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
                {templates.length} task{templates.length !== 1 ? 's' : ''}
              </Badge>
            </button>
          </CollapsibleTrigger>

          <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground shrink-0" onClick={() => onEdit(sequence)} title="Edit">
            <Pencil className="h-4 w-4" />
          </Button>

          <Button
            size="sm" variant="ghost"
            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive shrink-0"
            onClick={() => onDelete(sequence.id)} disabled={isDeleting}
          >
            {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </Button>
        </div>

        <CollapsibleContent>
          <div className="px-3 pb-3 pt-0 ml-8 border-t">
            {sequence.description && (
              <p className="text-xs text-muted-foreground mt-2 mb-2">{sequence.description}</p>
            )}

            {templates.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">No tasks in this sequence yet</p>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={templates.map(t => t.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2 mt-2">
                    {templates.map((t) => (
                      <TaskTemplateRow
                        key={t.id}
                        template={t}
                        onToggleActive={(id, active) =>
                          updateTemplate.mutate({ id, params: { is_active: active } })
                        }
                        onEdit={(template) => setEditTemplate(template)}
                        onDelete={(id) => setConfirmDeleteTemplateId(id)}
                        isDeleting={deleteTemplate.isPending && deleteTemplate.variables === t.id}
                        isToggling={updateTemplate.isPending && updateTemplate.variables?.id === t.id}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}

            <Button size="sm" variant="outline" className="mt-2 w-full" onClick={() => setShowAddTask(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add Task
            </Button>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Add/Edit task dialog */}
      <AddTaskTemplateDialog
        open={showAddTask || !!editTemplate}
        onOpenChange={(open) => {
          if (!open) {
            setShowAddTask(false);
            setEditTemplate(null);
          }
        }}
        editTemplate={editTemplate}
        sequenceId={sequence.id}
      />

      {/* Delete task confirmation */}
      <AlertDialog open={!!confirmDeleteTemplateId} onOpenChange={(open) => !open && setConfirmDeleteTemplateId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Task?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this task from the sequence.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDeleteTemplate} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
