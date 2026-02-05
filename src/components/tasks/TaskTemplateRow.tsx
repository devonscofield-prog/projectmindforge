import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Trash2, Loader2, Pencil, ChevronUp, ChevronDown } from 'lucide-react';
import type { TaskTemplate } from '@/api/taskTemplates';
import { PRIORITY_CONFIG, CATEGORY_LABELS } from '@/lib/taskConstants';

interface TaskTemplateRowProps {
  template: TaskTemplate;
  onToggleActive: (id: string, active: boolean) => void;
  onEdit: (template: TaskTemplate) => void;
  onDelete: (id: string) => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  isFirst?: boolean;
  isLast?: boolean;
  isDeleting: boolean;
  isToggling: boolean;
}

export function TaskTemplateRow({
  template, onToggleActive, onEdit, onDelete,
  onMoveUp, onMoveDown, isFirst, isLast,
  isDeleting, isToggling,
}: TaskTemplateRowProps) {
  const priority = PRIORITY_CONFIG[template.priority] || PRIORITY_CONFIG.medium;
  const dueLabel = template.due_days_offset != null
    ? template.due_days_offset === 0
      ? 'Same day'
      : `${template.due_days_offset} day${template.due_days_offset !== 1 ? 's' : ''} after`
    : null;

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
      {/* Reorder buttons */}
      <div className="flex flex-col gap-0.5 shrink-0">
        <Button
          size="sm" variant="ghost"
          className="h-5 w-5 p-0 text-muted-foreground"
          onClick={onMoveUp} disabled={isFirst}
          aria-label="Move up"
        >
          <ChevronUp className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="sm" variant="ghost"
          className="h-5 w-5 p-0 text-muted-foreground"
          onClick={onMoveDown} disabled={isLast}
          aria-label="Move down"
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </Button>
      </div>

      <Switch
        checked={template.is_active}
        onCheckedChange={(checked) => onToggleActive(template.id, checked)}
        disabled={isToggling}
        aria-label={`Toggle ${template.title}`}
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="secondary" className={`${priority.className} text-[10px] px-1.5 py-0`}>
            {priority.label}
          </Badge>
          {template.category && CATEGORY_LABELS[template.category] && (
            <span className="text-[10px] text-muted-foreground">
              {CATEGORY_LABELS[template.category]}
            </span>
          )}
          {dueLabel && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-muted text-muted-foreground">
              {dueLabel}
            </Badge>
          )}
          {template.reminder_enabled && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              🔔 {template.reminder_time?.slice(0, 5)}
            </Badge>
          )}
        </div>
        <p className={`text-sm font-medium truncate mt-0.5 ${!template.is_active ? 'text-muted-foreground line-through' : ''}`}>
          {template.title}
        </p>
        {template.description && (
          <p className="text-xs text-muted-foreground truncate">{template.description}</p>
        )}
      </div>

      <Button
        size="sm" variant="ghost"
        className="h-8 w-8 p-0 text-muted-foreground shrink-0"
        onClick={() => onEdit(template)} title="Edit"
      >
        <Pencil className="h-4 w-4" />
      </Button>

      <Button
        size="sm" variant="ghost"
        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive shrink-0"
        onClick={() => onDelete(template.id)} disabled={isDeleting}
      >
        {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
      </Button>
    </div>
  );
}
