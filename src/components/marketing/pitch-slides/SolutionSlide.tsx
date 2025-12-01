import { Brain, MessageSquare, TrendingUp, Bell } from 'lucide-react';

const pillars = [
  {
    icon: Brain,
    title: 'AI Call Analysis',
    description: 'Automatic transcription, scoring, and insights from every sales call',
  },
  {
    icon: MessageSquare,
    title: 'Real-Time Sales Coach',
    description: 'On-demand AI coaching for deal strategy and objection handling',
  },
  {
    icon: TrendingUp,
    title: 'Trend Intelligence',
    description: 'Track skill development and identify coaching opportunities over time',
  },
  {
    icon: Bell,
    title: 'Automated Follow-ups',
    description: 'AI-generated action items so no opportunity falls through the cracks',
  },
];

export function SolutionSlide() {
  return (
    <div className="flex flex-col h-full px-8 py-6">
      <div className="text-center mb-8">
        <h2 className="text-3xl md:text-4xl font-bold mb-3">Platform Capabilities</h2>
        <p className="text-muted-foreground text-lg">
          Four core pillars powering our sales enablement solution
        </p>
      </div>
      
      <div className="flex-1 flex items-center">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 w-full">
          {pillars.map((pillar, index) => (
            <div 
              key={index} 
              className="flex flex-col items-center text-center p-6 rounded-2xl bg-gradient-to-b from-primary/10 to-transparent border border-primary/20 hover:border-primary/40 transition-colors"
            >
              <div className="p-4 rounded-xl bg-primary/20 mb-4">
                <pillar.icon className="h-8 w-8 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">{pillar.title}</h3>
              <p className="text-sm text-muted-foreground">{pillar.description}</p>
            </div>
          ))}
        </div>
      </div>
      
      <div className="mt-8 text-center">
        <div className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-primary/10 text-primary font-medium">
          Built on Lovable Cloud with enterprise-grade AI
        </div>
      </div>
    </div>
  );
}
