import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Trash2, Edit2, X, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  fetchActivityTemplates,
  createActivityTemplate,
  updateActivityTemplate,
  deleteActivityTemplate,
  type ActivityTemplate,
} from '@/api/activityTemplates';
import type { ProspectActivityType } from '@/api/prospects';

interface ManageActivityTemplatesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const activityTypeOptions: { value: ProspectActivityType; label: string }[] = [
  { value: 'call', label: 'Phone Call' },
  { value: 'text_message', label: 'Text Message' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'meeting', label: 'Other' },
];

export function ManageActivityTemplatesDialog({
  open,
  onOpenChange,
}: ManageActivityTemplatesDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newTemplateType, setNewTemplateType] = useState<ProspectActivityType>('call');
  const [newTemplateText, setNewTemplateText] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['activityTemplates'],
    queryFn: () => fetchActivityTemplates(),
    enabled: open,
  });

  const createMutation = useMutation({
    mutationFn: ({ type, text }: { type: ProspectActivityType; text: string }) =>
      createActivityTemplate(type, text),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activityTemplates'] });
      setNewTemplateText('');
      toast({ title: 'Template created successfully' });
    },
    onError: (error) => {
      toast({
        title: 'Failed to create template',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, text }: { id: string; text: string }) =>
      updateActivityTemplate(id, text),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activityTemplates'] });
      setEditingId(null);
      setEditingText('');
      toast({ title: 'Template updated successfully' });
    },
    onError: (error) => {
      toast({
        title: 'Failed to update template',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteActivityTemplate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activityTemplates'] });
      toast({ title: 'Template deleted successfully' });
    },
    onError: (error) => {
      toast({
        title: 'Failed to delete template',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleCreate = () => {
    if (!newTemplateText.trim()) {
      toast({
        title: 'Template text required',
        variant: 'destructive',
      });
      return;
    }
    createMutation.mutate({ type: newTemplateType, text: newTemplateText });
  };

  const handleStartEdit = (template: ActivityTemplate) => {
    setEditingId(template.id);
    setEditingText(template.template_text);
  };

  const handleSaveEdit = () => {
    if (!editingText.trim() || !editingId) return;
    updateMutation.mutate({ id: editingId, text: editingText });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingText('');
  };

  const groupedTemplates = activityTypeOptions.reduce((acc, { value, label }) => {
    acc[value] = {
      label,
      templates: templates.filter((t) => t.activity_type === value),
    };
    return acc;
  }, {} as Record<ProspectActivityType, { label: string; templates: ActivityTemplate[] }>);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Manage Activity Templates</DialogTitle>
          <DialogDescription>
            Create custom templates for quick activity logging
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Create New Template */}
          <div className="space-y-2 p-4 border rounded-lg bg-muted/50">
            <h3 className="text-sm font-medium">Create New Template</h3>
            <div className="flex gap-2">
              <Select value={newTemplateType} onValueChange={(v) => setNewTemplateType(v as ProspectActivityType)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {activityTypeOptions.map(({ value, label }) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder="Template text..."
                value={newTemplateText}
                onChange={(e) => setNewTemplateText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              />
              <Button
                onClick={handleCreate}
                disabled={createMutation.isPending || !newTemplateText.trim()}
                size="sm"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Existing Templates */}
          <ScrollArea className="h-[400px] pr-4">
            {isLoading ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                Loading templates...
              </div>
            ) : (
              <div className="space-y-4">
                {activityTypeOptions.map(({ value }) => {
                  const group = groupedTemplates[value];
                  if (group.templates.length === 0) return null;

                  return (
                    <div key={value} className="space-y-2">
                      <h4 className="text-sm font-medium text-muted-foreground">
                        {group.label}
                      </h4>
                      <div className="space-y-2">
                        {group.templates.map((template) => (
                          <div
                            key={template.id}
                            className="flex items-center gap-2 p-2 border rounded-lg bg-background"
                          >
                            {editingId === template.id ? (
                              <>
                                <Input
                                  value={editingText}
                                  onChange={(e) => setEditingText(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveEdit();
                                    if (e.key === 'Escape') handleCancelEdit();
                                  }}
                                  className="flex-1"
                                  autoFocus
                                />
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={handleSaveEdit}
                                  disabled={updateMutation.isPending}
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={handleCancelEdit}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </>
                            ) : (
                              <>
                                <span className="flex-1 text-sm">
                                  {template.template_text}
                                </span>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleStartEdit(template)}
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => deleteMutation.mutate(template.id)}
                                  disabled={deleteMutation.isPending}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
                {templates.length === 0 && (
                  <div className="text-center py-8 text-sm text-muted-foreground">
                    No custom templates yet. Create one above to get started.
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
