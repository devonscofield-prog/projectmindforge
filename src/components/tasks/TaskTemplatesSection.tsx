import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
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
import { Plus, Loader2, FileText } from 'lucide-react';
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
  useTaskTemplates,
  useAutoCreateSetting,
  useToggleAutoCreate,
  useUpdateTaskTemplate,
  useDeleteTaskTemplate,
  useReorderTaskTemplates,
} from '@/hooks/useTaskTemplates';
import { TaskTemplateRow } from './TaskTemplateRow';
import { AddTaskTemplateDialog } from './AddTaskTemplateDialog';
import type { TaskTemplate } from '@/api/taskTemplates';

export function TaskTemplatesSection() {
  const [showAdd, setShowAdd] = useState(false);
  const [editTemplate, setEditTemplate] = useState<TaskTemplate | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const { data: templates = [], isLoading: templatesLoading } = useTaskTemplates();
  const { data: autoCreateEnabled, isLoading: settingLoading } = useAutoCreateSetting();
  const toggleAutoCreate = useToggleAutoCreate();
  const updateTemplate = useUpdateTaskTemplate();
  const deleteTemplate = useDeleteTaskTemplate();
  const reorderTemplates = useReorderTaskTemplates();
  const isLoading = templatesLoading || settingLoading;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleConfirmDelete = () => {
    if (!confirmDeleteId) return;
    deleteTemplate.mutate(confirmDeleteId);
    setConfirmDeleteId(null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = templates.findIndex(t => t.id === active.id);
    const newIndex = templates.findIndex(t => t.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    // Build new order assignments
    const reordered = [...templates];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved);

    const updates = reordered.map((t, i) => ({ id: t.id, sort_order: i }));
    reorderTemplates.mutate(updates);
  };

  return (
    <div className="space-y-4">
      {/* Master toggle */}
      <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
        <div>
          <Label className="text-sm font-medium">Auto-create tasks for every call</Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            When enabled, these tasks are automatically created whenever you submit a call
          </p>
        </div>
        <Switch
          checked={autoCreateEnabled ?? false}
          onCheckedChange={(checked) => toggleAutoCreate.mutate(checked)}
          disabled={settingLoading || toggleAutoCreate.isPending}
        />
      </div>

      {/* Template list header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">
          Task Templates ({templates.length})
        </h3>
        <Button size="sm" onClick={() => setShowAdd(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Add Template
        </Button>
      </div>

      {/* Template list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : templates.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
          <p className="text-sm font-medium text-muted-foreground">No task templates yet</p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            Add templates that will be automatically created for every call you submit
          </p>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={templates.map(t => t.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {templates.map((t) => (
                <TaskTemplateRow
                  key={t.id}
                  template={t}
                  onToggleActive={(id, active) =>
                    updateTemplate.mutate({ id, params: { is_active: active } })
                  }
                  onEdit={(template) => setEditTemplate(template)}
                  onDelete={(id) => setConfirmDeleteId(id)}
                  isDeleting={deleteTemplate.isPending && deleteTemplate.variables === t.id}
                  isToggling={updateTemplate.isPending && updateTemplate.variables?.id === t.id}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Add / Edit dialog */}
      <AddTaskTemplateDialog
        open={showAdd || !!editTemplate}
        onOpenChange={(open) => {
          if (!open) {
            setShowAdd(false);
            setEditTemplate(null);
          }
        }}
        editTemplate={editTemplate}
      />

      {/* Delete confirmation */}
      <AlertDialog open={!!confirmDeleteId} onOpenChange={(open) => !open && setConfirmDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this task template. This action cannot be undone.
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