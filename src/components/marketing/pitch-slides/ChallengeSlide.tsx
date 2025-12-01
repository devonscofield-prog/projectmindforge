import { Clock, TrendingDown, Users, Target } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

const challenges = [
  {
    icon: Clock,
    title: 'Administrative Burden',
    description: 'Reps spend significant time on call documentation, notes, and follow-up emails instead of selling.',
    color: 'text-red-500',
    bgColor: 'bg-red-500/10',
  },
  {
    icon: TrendingDown,
    title: 'Inconsistent Execution',
    description: 'Sales methodology adherence varies across the team without real-time guidance and feedback.',
    color: 'text-orange-500',
    bgColor: 'bg-orange-500/10',
  },
  {
    icon: Users,
    title: 'Coaching Scalability',
    description: 'Managers can only provide limited personalized coaching given team sizes and time constraints.',
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
  },
  {
    icon: Target,
    title: 'Visibility Gaps',
    description: 'Leadership lacks real-time insights into deal health, skill gaps, and coaching opportunities across all reps.',
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-500/10',
  },
];

export function ChallengeSlide() {
  return (
    <div className="flex flex-col h-full px-8 py-6">
      <div className="text-center mb-8">
        <h2 className="text-3xl md:text-4xl font-bold mb-3">Problems We're Solving</h2>
        <p className="text-muted-foreground text-lg">
          Key challenges this platform addresses for our sales organization
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
    </div>
  );
}
