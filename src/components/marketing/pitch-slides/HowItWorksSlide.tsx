import { Upload, Sparkles, LineChart, ArrowRight } from 'lucide-react';

const steps = [
  {
    icon: Upload,
    step: '01',
    title: 'Record & Upload',
    description: 'Connect your call recording platform or upload transcripts directly',
    color: 'bg-blue-500',
  },
  {
    icon: Sparkles,
    step: '02',
    title: 'AI Analysis',
    description: 'Instant insights, scores, and coaching recommendations generated',
    color: 'bg-purple-500',
  },
  {
    icon: LineChart,
    step: '03',
    title: 'Track & Improve',
    description: 'Monitor progress, identify patterns, and measure ROI over time',
    color: 'bg-green-500',
  },
];

export function HowItWorksSlide() {
  return (
    <div className="flex flex-col h-full px-8 py-6">
      <div className="text-center mb-10">
        <h2 className="text-3xl md:text-4xl font-bold mb-3">How It Works</h2>
        <p className="text-muted-foreground text-lg">
          Simple setup, immediate value
        </p>
      </div>
      
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col md:flex-row items-center gap-6 md:gap-4 w-full max-w-4xl">
          {steps.map((step, index) => (
            <div key={index} className="flex items-center gap-4 w-full">
              <div className="flex-1 text-center p-6 rounded-2xl bg-card border-2 hover:border-primary/50 transition-colors">
                <div className={`inline-flex p-4 rounded-xl ${step.color} mb-4`}>
                  <step.icon className="h-8 w-8 text-white" />
                </div>
                <div className="text-xs font-bold text-primary mb-2">{step.step}</div>
                <h3 className="font-semibold text-lg mb-2">{step.title}</h3>
                <p className="text-sm text-muted-foreground">{step.description}</p>
              </div>
              
              {index < steps.length - 1 && (
                <ArrowRight className="hidden md:block h-6 w-6 text-muted-foreground shrink-0" />
              )}
            </div>
          ))}
        </div>
      </div>
      
      <div className="mt-8 text-center">
        <p className="text-muted-foreground">
          <span className="font-semibold">No complex integrations required.</span> Get started in minutes.
        </p>
      </div>
    </div>
  );
}
