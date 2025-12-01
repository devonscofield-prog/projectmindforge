import { Quote, TrendingUp, Clock, Target } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

const metrics = [
  {
    icon: TrendingUp,
    before: '22%',
    after: '31%',
    label: 'Win Rate',
    color: 'text-green-500',
  },
  {
    icon: Clock,
    before: '10h',
    after: '3h',
    label: 'Admin Time/Week',
    color: 'text-blue-500',
  },
  {
    icon: Target,
    before: '1:6',
    after: '1:12',
    label: 'Coach:Rep Ratio',
    color: 'text-purple-500',
  },
];

export function SuccessSlide() {
  return (
    <div className="flex flex-col h-full px-8 py-6">
      <div className="text-center mb-6">
        <h2 className="text-3xl md:text-4xl font-bold mb-3">Customer Success</h2>
        <p className="text-muted-foreground text-lg">
          Real results from real teams
        </p>
      </div>
      
      <div className="flex-1 space-y-6">
        {/* Testimonial */}
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-6">
            <Quote className="h-8 w-8 text-primary/30 mb-3" />
            <blockquote className="text-lg italic mb-4">
              "Within 90 days, our team's win rate improved by 9 percentage points. The AI coaching 
              gives every rep access to the same quality guidance that only our top performers used to get."
            </blockquote>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center font-bold text-primary">
                JD
              </div>
              <div>
                <p className="font-semibold">Jane Doe</p>
                <p className="text-sm text-muted-foreground">VP of Sales, Enterprise Tech Co.</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Before/After Metrics */}
        <div className="grid md:grid-cols-3 gap-4">
          {metrics.map((metric, index) => (
            <Card key={index}>
              <CardContent className="p-5 text-center">
                <metric.icon className={`h-6 w-6 ${metric.color} mx-auto mb-3`} />
                <p className="text-sm text-muted-foreground mb-2">{metric.label}</p>
                <div className="flex items-center justify-center gap-3">
                  <span className="text-xl text-muted-foreground line-through">{metric.before}</span>
                  <span className="text-2xl">→</span>
                  <span className={`text-2xl font-bold ${metric.color}`}>{metric.after}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        
        {/* Additional Stats */}
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-3xl font-bold text-primary">50+</p>
            <p className="text-sm text-muted-foreground">Enterprise Customers</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-primary">10K+</p>
            <p className="text-sm text-muted-foreground">Calls Analyzed Monthly</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-primary">4.8/5</p>
            <p className="text-sm text-muted-foreground">Customer Satisfaction</p>
          </div>
        </div>
      </div>
    </div>
  );
}
