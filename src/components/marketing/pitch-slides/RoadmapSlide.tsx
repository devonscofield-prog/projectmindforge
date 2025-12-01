import { CheckCircle2, Circle, Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

const phases = [
  {
    phase: 'Phase 1',
    title: 'Foundation',
    status: 'complete',
    items: [
      'AI call analysis engine',
      'Multi-framework scoring',
      'Role-based dashboards',
      'Basic reporting',
    ],
  },
  {
    phase: 'Phase 2',
    title: 'Intelligence',
    status: 'complete',
    items: [
      'AI sales coach chat',
      'Stakeholder tracking',
      'Automated follow-ups',
      'Performance alerts',
    ],
  },
  {
    phase: 'Phase 3',
    title: 'Scale',
    status: 'current',
    items: [
      'Team-wide trend analysis',
      'Leadership reports',
      'Cross-team comparisons',
      'Advanced coaching insights',
    ],
  },
  {
    phase: 'Phase 4',
    title: 'Expand',
    status: 'planned',
    items: [
      'CRM integrations',
      'Call recording connections',
      'Custom AI models',
      'API access',
    ],
  },
];

function StatusIcon({ status }: { status: string }) {
  if (status === 'complete') {
    return <CheckCircle2 className="h-5 w-5 text-green-500" />;
  }
  if (status === 'current') {
    return <Clock className="h-5 w-5 text-primary animate-pulse" />;
  }
  return <Circle className="h-5 w-5 text-muted-foreground" />;
}

export function RoadmapSlide() {
  return (
    <div className="flex flex-col h-full px-8 py-6">
      <div className="text-center mb-6">
        <h2 className="text-3xl md:text-4xl font-bold mb-3">Development Roadmap</h2>
        <p className="text-muted-foreground text-lg">
          Platform evolution and upcoming capabilities
        </p>
      </div>
      
      <div className="grid md:grid-cols-4 gap-4 flex-1">
        {phases.map((phase, index) => (
          <Card 
            key={index} 
            className={`${phase.status === 'current' ? 'border-primary border-2' : ''}`}
          >
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <StatusIcon status={phase.status} />
                <span className="text-xs font-bold text-muted-foreground uppercase">
                  {phase.phase}
                </span>
              </div>
              <h3 className="font-semibold text-lg mb-3">{phase.title}</h3>
              <ul className="space-y-2">
                {phase.items.map((item, itemIndex) => (
                  <li key={itemIndex} className="text-sm text-muted-foreground flex items-start gap-2">
                    <span className="text-primary mt-1">•</span>
                    {item}
                  </li>
                ))}
              </ul>
              {phase.status === 'current' && (
                <div className="mt-4 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium inline-block">
                  In Progress
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
      
      <div className="mt-4 flex justify-center gap-6 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-green-500" />
          <span>Complete</span>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" />
          <span>In Progress</span>
        </div>
        <div className="flex items-center gap-2">
          <Circle className="h-4 w-4 text-muted-foreground" />
          <span>Planned</span>
        </div>
      </div>
    </div>
  );
}
