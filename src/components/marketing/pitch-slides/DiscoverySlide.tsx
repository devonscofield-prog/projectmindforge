import { Card } from '@/components/ui/card';
import { Clock, TrendingUp, Users, Eye } from 'lucide-react';

const quadrants = [
  {
    icon: Clock,
    title: 'Time & Productivity',
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    questions: [
      'How much time on admin vs. selling?',
      'What would 5-10 extra hours/week mean?',
      'Manager time: listening vs. coaching?',
    ],
  },
  {
    icon: TrendingUp,
    title: 'Methodology & Execution',
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
    questions: [
      'Consistent methodology execution?',
      'Framework adherence visibility?',
      'Coaching scalability challenges?',
    ],
  },
  {
    icon: Users,
    title: 'Coaching & Development',
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
    questions: [
      'How do you scale personalized coaching?',
      'Can every call be analyzed?',
      'Identify skill gaps across team?',
    ],
  },
  {
    icon: Eye,
    title: 'Visibility & Insights',
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-500/10',
    questions: [
      'Deal health indicators available?',
      'Win/loss analysis process?',
      'Forecasting confidence level?',
    ],
  },
];

export function DiscoverySlide() {
  return (
    <div className="flex flex-col h-full px-8 py-8">
      {/* Header */}
      <div className="text-center mb-6">
        <h2 className="text-3xl md:text-4xl font-bold mb-2">Discovery Framework</h2>
        <p className="text-muted-foreground text-lg">
          Key questions that uncover where this platform adds value
        </p>
      </div>

      {/* 2x2 Grid */}
      <div className="flex-1 grid grid-cols-2 gap-4 max-w-5xl mx-auto w-full">
        {quadrants.map((quadrant) => {
          const Icon = quadrant.icon;
          return (
            <Card key={quadrant.title} className="p-5 flex flex-col">
              <div className="flex items-center gap-3 mb-4">
                <div className={`p-2.5 rounded-lg ${quadrant.bgColor}`}>
                  <Icon className={`h-5 w-5 ${quadrant.color}`} />
                </div>
                <h3 className="font-semibold text-lg">{quadrant.title}</h3>
              </div>
              <ul className="space-y-2.5 flex-1">
                {quadrant.questions.map((question, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <span className={`mt-1.5 w-1.5 h-1.5 rounded-full ${quadrant.bgColor} shrink-0`} />
                    {question}
                  </li>
                ))}
              </ul>
            </Card>
          );
        })}
      </div>

      {/* Footer Callout */}
      <div className="mt-6 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm">
          <span className="font-medium">
            Every "yes, that's a problem" → a capability this platform delivers
          </span>
        </div>
      </div>
    </div>
  );
}
