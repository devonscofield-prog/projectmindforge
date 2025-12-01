import { ArrowRight, Calendar, Mail, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function CTASlide() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-8">
      <h2 className="text-4xl md:text-5xl font-bold mb-4">
        Ready to Transform
        <br />
        <span className="text-primary">Your Sales Team?</span>
      </h2>
      
      <p className="text-xl text-muted-foreground max-w-xl mb-10">
        Join leading sales organizations using AI to drive performance and revenue growth.
      </p>
      
      <div className="flex flex-col sm:flex-row gap-4 mb-12">
        <Button size="lg" className="gap-2 text-lg px-8">
          <Calendar className="h-5 w-5" />
          Request a Demo
          <ArrowRight className="h-5 w-5" />
        </Button>
        <Button size="lg" variant="outline" className="gap-2 text-lg px-8">
          <Mail className="h-5 w-5" />
          Contact Sales
        </Button>
      </div>
      
      <div className="space-y-4 text-muted-foreground">
        <p className="text-sm">Or reach us directly:</p>
        <div className="flex flex-wrap justify-center gap-6">
          <a href="mailto:sales@salestracker.ai" className="flex items-center gap-2 hover:text-primary transition-colors">
            <Mail className="h-4 w-4" />
            sales@salestracker.ai
          </a>
          <a href="tel:+1-800-SALES-AI" className="flex items-center gap-2 hover:text-primary transition-colors">
            <Phone className="h-4 w-4" />
            1-800-SALES-AI
          </a>
        </div>
      </div>
      
      <div className="mt-12 pt-8 border-t border-border w-full max-w-md">
        <p className="text-xs text-muted-foreground">
          © 2024 Sales Performance Tracker. All rights reserved.
        </p>
      </div>
    </div>
  );
}
