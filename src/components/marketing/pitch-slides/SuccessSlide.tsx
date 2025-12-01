import { TrendingUp, Clock, Target, Users } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

const outcomes = [
  {
    icon: Clock,
    metric: 'Time Savings',
    description: 'Reps can focus on selling instead of documentation, with AI handling notes, summaries, and recap emails automatically.',
  },
  {
    icon: Target,
    metric: 'Better Execution',
    description: 'Real-time scoring and coaching helps reps improve methodology adherence and deal qualification on every call.',
  },
  {
    icon: TrendingUp,
    metric: 'Visibility',
    description: 'Leadership gets real-time insights into team performance, skill gaps, and coaching opportunities across all reps.',
  },
  {
    icon: Users,
    metric: 'Scalable Coaching',
    description: 'AI-assisted coaching means managers can provide personalized guidance to more reps without sacrificing quality.',
  },
];

export function SuccessSlide() {
  return (
    <div className="flex flex-col h-full px-8 py-6">
      <div className="text-center mb-8">
        <h2 className="text-3xl md:text-4xl font-bold mb-3">Expected Outcomes</h2>
        <p className="text-muted-foreground text-lg">
          How the platform benefits our organization
        </p>
      </div>
      
      <div className="grid md:grid-cols-2 gap-6 flex-1">
        {outcomes.map((outcome, index) => (
          <Card key={index} className="border-2 hover:border-primary/50 transition-colors">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-xl bg-primary/10">
                  <outcome.icon className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-2">{outcome.metric}</h3>
                  <p className="text-muted-foreground">{outcome.description}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      <div className="mt-6 p-4 rounded-xl bg-muted text-center">
        <p className="text-sm text-muted-foreground italic">
          "The goal is to make every rep perform like our best reps through consistent coaching and real-time guidance."
        </p>
      </div>
    </div>
  );
}
