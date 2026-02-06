import { useQuery } from '@tanstack/react-query';
import { fetchTaskTemplates, getAutoCreateSetting } from '@/api/taskTemplates';
import { Badge } from '@/components/ui/badge';
import { PRIORITY_CONFIG, CATEGORY_LABELS } from '@/lib/taskConstants';
import { Loader2, FileText, Zap, ZapOff } from 'lucide-react';

interface RepTaskTemplatesReadOnlyProps {
  repId: string;
}

export function RepTaskTemplatesReadOnly({ repId }: RepTaskTemplatesReadOnlyProps) {
  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['task-templates', repId],
    queryFn: () => fetchTaskTemplates(repId),
    enabled: !!repId,
    staleTime: 60_000,
  });

  const { data: autoCreateEnabled } = useQuery({
    queryKey: ['task-template-settings', repId],
    queryFn: () => getAutoCreateSetting(repId),
    enabled: !!repId,
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <div className="text-center py-4">
        <FileText className="h-6 w-6 text-muted-foreground/50 mx-auto mb-2" />
        <p className="text-xs text-muted-foreground">No task templates configured</p>
      </div>
    );
  }

  const activeCount = templates.filter(t => t.is_active).length;

  return (
    <div className="space-y-3">
      {/* Auto-create status */}
      <div className="flex items-center gap-2 text-xs">
        {autoCreateEnabled ? (
          <>
            <Zap className="h-3.5 w-3.5 text-primary" />
            <span className="text-primary font-medium">Auto-create enabled</span>
          </>
        ) : (
          <>
            <ZapOff className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">Auto-create disabled</span>
          </>
        )}
        <span className="text-muted-foreground ml-auto">
          {activeCount}/{templates.length} active
        </span>
      </div>

      {/* Template list */}
      <div className="space-y-1.5">
        {templates.map(t => {
          const priority = PRIORITY_CONFIG[t.priority] || PRIORITY_CONFIG.medium;
          const dueLabel = t.due_days_offset != null
            ? t.due_days_offset === 0 ? 'Same day' : `+${t.due_days_offset}d`
            : null;

          return (
            <div
              key={t.id}
              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md border text-sm ${
                !t.is_active ? 'opacity-50' : ''
              }`}
            >
              <Badge variant="secondary" className={`${priority.className} text-[10px] px-1.5 py-0 shrink-0`}>
                {priority.label}
              </Badge>
              <span className={`truncate flex-1 ${!t.is_active ? 'line-through text-muted-foreground' : ''}`}>
                {t.title}
              </span>
              <div className="flex items-center gap-1.5 shrink-0">
                {t.category && CATEGORY_LABELS[t.category] && (
                  <span className="text-[10px] text-muted-foreground hidden sm:inline">
                    {CATEGORY_LABELS[t.category]}
                  </span>
                )}
                {dueLabel && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-muted text-muted-foreground">
                    {dueLabel}
                  </Badge>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
