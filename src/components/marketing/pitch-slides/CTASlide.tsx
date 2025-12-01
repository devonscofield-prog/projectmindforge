import { ArrowRight, PlayCircle, MessageSquare, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const nextSteps = [
  {
    icon: PlayCircle,
    title: 'Try the Demo',
    description: 'Explore the platform with sample data to see capabilities firsthand',
  },
  {
    icon: Calendar,
    title: 'Pilot Program',
    description: 'Select a small team to run a 30-day pilot and measure impact',
  },
  {
    icon: MessageSquare,
    title: 'Feedback Session',
    description: 'Schedule time to discuss questions and customization needs',
  },
];

export function CTASlide() {
  return (
    <div className="flex flex-col h-full px-8 py-6">
      <div className="text-center mb-8">
        <h2 className="text-3xl md:text-4xl font-bold mb-3">Next Steps</h2>
        <p className="text-muted-foreground text-lg">
          How to move forward with adoption
        </p>
      </div>
      
      <div className="grid md:grid-cols-3 gap-6 flex-1 items-center">
        {nextSteps.map((step, index) => (
          <Card key={index} className="hover:shadow-lg transition-shadow h-full">
            <CardContent className="p-6 flex flex-col items-center text-center h-full">
              <div className="p-4 rounded-xl bg-primary/10 mb-4">
                <step.icon className="h-8 w-8 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-2">{step.title}</h3>
              <p className="text-sm text-muted-foreground flex-1">{step.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      
      <div className="mt-8 text-center space-y-4">
        <div className="flex flex-wrap justify-center gap-4">
          <Button size="lg" className="gap-2">
            Start Demo
            <ArrowRight className="h-4 w-4" />
          </Button>
          <Button size="lg" variant="outline" className="gap-2">
            View ROI Calculator
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Questions? Reach out to the project team for a walkthrough.
        </p>
      </div>
    </div>
  );
}
