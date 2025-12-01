import { Sparkles } from 'lucide-react';

export function TitleSlide() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-8">
      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
        <Sparkles className="h-4 w-4" />
        Internal Capabilities Overview
      </div>
      
      <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 bg-gradient-to-r from-foreground via-foreground to-primary bg-clip-text">
        Sales Performance
        <br />
        <span className="text-primary">Tracker</span>
      </h1>
      
      <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mb-8">
        Our AI-powered platform for sales enablement and coaching
      </p>
      
      <div className="flex flex-wrap justify-center gap-4 text-sm text-muted-foreground">
        <span className="px-3 py-1 rounded-full border border-border">AI Call Analysis</span>
        <span className="px-3 py-1 rounded-full border border-border">Automated Coaching</span>
        <span className="px-3 py-1 rounded-full border border-border">Performance Intelligence</span>
      </div>
    </div>
  );
}
