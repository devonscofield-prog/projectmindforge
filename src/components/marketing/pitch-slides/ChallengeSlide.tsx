import { Clock, TrendingDown, Users, Target } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

const challenges = [
  {
    icon: Clock,
    title: '30% Time on Admin',
    description: 'Sales reps spend nearly a third of their time on documentation and admin tasks instead of selling.',
    color: 'text-red-500',
    bgColor: 'bg-red-500/10',
  },
  {
    icon: TrendingDown,
    title: 'Inconsistent Execution',
    description: 'Without real-time guidance, sales methodology execution varies wildly across the team.',
    color: 'text-orange-500',
    bgColor: 'bg-orange-500/10',
  },
  {
    icon: Users,
    title: 'Limited Coaching Scale',
    description: '1:8 manager-to-rep ratio means most reps get insufficient personalized coaching.',
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
  },
  {
    icon: Target,
    title: 'Missed Follow-ups',
    description: 'Critical deal opportunities lost due to forgotten or delayed follow-up actions.',
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-500/10',
  },
];

export function ChallengeSlide() {
  return (
    <div className="flex flex-col h-full px-8 py-6">
      <div className="text-center mb-8">
        <h2 className="text-3xl md:text-4xl font-bold mb-3">The Challenge</h2>
        <p className="text-muted-foreground text-lg">
          Today's sales teams face critical obstacles to peak performance
        </p>
      </div>
      
      <div className="grid md:grid-cols-2 gap-6 flex-1">
        {challenges.map((challenge, index) => (
          <Card key={index} className="border-2 hover:border-primary/50 transition-colors">
            <CardContent className="p-6 flex items-start gap-4">
              <div className={`p-3 rounded-xl ${challenge.bgColor}`}>
                <challenge.icon className={`h-6 w-6 ${challenge.color}`} />
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-1">{challenge.title}</h3>
                <p className="text-muted-foreground text-sm">{challenge.description}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      <div className="mt-6 text-center">
        <p className="text-sm text-muted-foreground italic">
          "The average B2B sales team loses 20-30% of potential revenue due to these challenges"
        </p>
      </div>
    </div>
  );
}
