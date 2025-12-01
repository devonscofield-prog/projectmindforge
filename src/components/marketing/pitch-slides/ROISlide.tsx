import { Clock, TrendingUp, DollarSign, Users } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

const metrics = [
  {
    icon: Clock,
    value: '70%',
    label: 'Admin Time Reduction',
    description: 'Less time on documentation with AI-generated notes and emails',
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
  },
  {
    icon: TrendingUp,
    value: '5-15%',
    label: 'Expected Win Rate Lift',
    description: 'Through better methodology adherence and deal execution',
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
  },
  {
    icon: Users,
    value: '4x',
    label: 'Coaching Scalability',
    description: 'More reps can receive personalized coaching per manager',
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
  },
  {
    icon: DollarSign,
    value: '2-3 mo',
    label: 'Expected Payback',
    description: 'Typical time to realize positive ROI from platform adoption',
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
  },
];

export function ROISlide() {
  return (
    <div className="flex flex-col h-full px-8 py-6">
      <div className="text-center mb-8">
        <h2 className="text-3xl md:text-4xl font-bold mb-3">Expected Business Impact</h2>
        <p className="text-muted-foreground text-lg">
          Projected benefits based on industry benchmarks
        </p>
      </div>
      
      <div className="grid md:grid-cols-2 gap-6 flex-1">
        {metrics.map((metric, index) => (
          <Card key={index} className="border-2">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-xl ${metric.bgColor}`}>
                  <metric.icon className={`h-6 w-6 ${metric.color}`} />
                </div>
                <div className="flex-1">
                  <p className={`text-4xl font-bold ${metric.color} mb-1`}>{metric.value}</p>
                  <p className="font-semibold mb-1">{metric.label}</p>
                  <p className="text-sm text-muted-foreground">{metric.description}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      <div className="mt-6 p-4 rounded-xl bg-primary/10 text-center">
        <p className="text-sm font-medium">
          Use our <span className="text-primary">ROI Calculator</span> to model impact for our specific team size
        </p>
      </div>
    </div>
  );
}
