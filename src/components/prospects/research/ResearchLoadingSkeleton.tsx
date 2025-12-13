import { Skeleton } from '@/components/ui/skeleton';
import { Building2, Target, Users, MessageSquare, HelpCircle, TrendingUp, AlertTriangle } from 'lucide-react';

export function ResearchLoadingSkeleton() {
  const sections = [
    { icon: Building2, label: 'Company Overview' },
    { icon: Target, label: 'Industry Analysis' },
    { icon: Users, label: 'Stakeholder Insights' },
    { icon: MessageSquare, label: 'Conversation Hooks' },
    { icon: HelpCircle, label: 'Discovery Questions' },
    { icon: TrendingUp, label: 'Signals to Watch' },
    { icon: AlertTriangle, label: 'Risks & Considerations' },
  ];

  return (
    <div className="space-y-4 animate-pulse">
      {sections.map(({ icon: Icon, label }) => (
        <div key={label} className="border rounded-lg p-4 bg-card/50">
          <div className="flex items-center gap-2 mb-3">
            <Icon className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium text-sm text-muted-foreground">{label}</span>
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        </div>
      ))}
    </div>
  );
}
