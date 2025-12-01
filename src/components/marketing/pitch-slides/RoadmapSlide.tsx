import { Settings, Users, Sparkles, TrendingUp, Check } from 'lucide-react';

const phases = [
  {
    icon: Settings,
    title: 'Setup & Integration',
    timeline: 'Week 1-2',
    items: [
      'Platform configuration',
      'Call recording integration',
      'Team hierarchy setup',
      'Custom framework selection',
    ],
    color: 'bg-blue-500',
    borderColor: 'border-blue-500',
  },
  {
    icon: Users,
    title: 'Team Onboarding',
    timeline: 'Week 3-4',
    items: [
      'User training sessions',
      'Dashboard familiarization',
      'First call uploads',
      'Coach bot introduction',
    ],
    color: 'bg-purple-500',
    borderColor: 'border-purple-500',
  },
  {
    icon: Sparkles,
    title: 'First Insights',
    timeline: 'Month 2',
    items: [
      'Initial trend analysis',
      'Coaching opportunities identified',
      'Baseline metrics established',
      'Quick wins realized',
    ],
    color: 'bg-green-500',
    borderColor: 'border-green-500',
  },
  {
    icon: TrendingUp,
    title: 'ROI Realization',
    timeline: 'Month 3+',
    items: [
      'Measurable win rate improvement',
      'Time savings quantified',
      'Coaching efficiency gains',
      'Revenue impact visible',
    ],
    color: 'bg-amber-500',
    borderColor: 'border-amber-500',
  },
];

export function RoadmapSlide() {
  return (
    <div className="flex flex-col h-full px-8 py-6">
      <div className="text-center mb-6">
        <h2 className="text-3xl md:text-4xl font-bold mb-3">Implementation Roadmap</h2>
        <p className="text-muted-foreground text-lg">
          From setup to ROI in 90 days
        </p>
      </div>
      
      <div className="flex-1 overflow-auto">
        <div className="grid md:grid-cols-4 gap-4">
          {phases.map((phase, index) => (
            <div 
              key={index} 
              className={`p-5 rounded-xl border-2 ${phase.borderColor} bg-card relative`}
            >
              <div className={`absolute -top-3 left-4 px-3 py-1 ${phase.color} text-white text-xs font-bold rounded-full`}>
                {phase.timeline}
              </div>
              
              <div className={`inline-flex p-2 rounded-lg ${phase.color} mt-2 mb-3`}>
                <phase.icon className="h-5 w-5 text-white" />
              </div>
              
              <h3 className="font-semibold mb-3">{phase.title}</h3>
              
              <ul className="space-y-2">
                {phase.items.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <Check className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      
      <div className="mt-6 text-center">
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold">Dedicated success manager</span> assigned to ensure smooth implementation
        </p>
      </div>
    </div>
  );
}
