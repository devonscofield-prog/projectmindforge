import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { UserRole, Profile } from '@/types/database';
import {
  Phone,
  GraduationCap,
  Building2,
  CheckSquare,
  Upload,
  Star,
  TrendingUp,
  Users,
  MessageSquare,
  BarChart3,
  Settings,
  ArrowRight,
  ArrowLeft,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface OnboardingFlowProps {
  profile: Profile;
  role: UserRole;
  onComplete: () => void;
  onDismiss: () => void;
}

const roleSubtitles: Record<UserRole, string> = {
  rep: 'Your AI-powered sales coaching assistant',
  sdr: 'Track and improve your cold calling skills',
  manager: 'Manage your team\'s performance and coaching',
  sdr_manager: 'Grade and coach your SDR team',
  admin: 'Manage your organization\'s sales performance',
};

type FeatureCard = {
  icon: React.ElementType;
  title: string;
  description: string;
};

const roleFeatures: Record<UserRole, FeatureCard[]> = {
  rep: [
    { icon: Phone, title: 'Submit Calls', description: 'Upload call recordings for AI analysis' },
    { icon: GraduationCap, title: 'AI Coaching', description: 'Get personalized feedback on every call' },
    { icon: Building2, title: 'Manage Accounts', description: 'Track prospects and follow-ups' },
    { icon: CheckSquare, title: 'Track Tasks', description: 'Stay on top of action items' },
  ],
  sdr: [
    { icon: Upload, title: 'Upload Transcripts', description: 'Submit cold call transcripts for review' },
    { icon: Star, title: 'View Grades', description: 'See how your calls are scored' },
    { icon: TrendingUp, title: 'Track Progress', description: 'Monitor your improvement over time' },
  ],
  manager: [
    { icon: Users, title: 'Team Overview', description: 'See your team\'s performance at a glance' },
    { icon: MessageSquare, title: 'Coaching Sessions', description: 'Run and track coaching meetings' },
    { icon: BarChart3, title: 'Performance Trends', description: 'Analyze team metrics over time' },
    { icon: Building2, title: 'Accounts', description: 'Monitor team account health' },
  ],
  sdr_manager: [
    { icon: Upload, title: 'Upload for Team', description: 'Submit transcripts on behalf of your team' },
    { icon: Star, title: 'View Grades', description: 'Review call quality scores' },
    { icon: Settings, title: 'Coaching Prompts', description: 'Customize AI grading criteria' },
    { icon: BarChart3, title: 'Team Analytics', description: 'Track team-wide performance' },
  ],
  admin: [
    { icon: Users, title: 'User Management', description: 'Manage users, roles, and teams' },
    { icon: BarChart3, title: 'Reporting', description: 'Organization-wide analytics' },
    { icon: GraduationCap, title: 'Training', description: 'Configure training and coaching' },
    { icon: Settings, title: 'System Settings', description: 'Configure platform settings' },
  ],
};

const roleCTA: Record<UserRole, { label: string; href: string }> = {
  rep: { label: 'Submit your first call', href: '/rep' },
  sdr: { label: 'Upload your first transcript', href: '/sdr' },
  manager: { label: 'View your team', href: '/manager' },
  sdr_manager: { label: 'View your team', href: '/sdr-manager' },
  admin: { label: 'Go to dashboard', href: '/admin' },
};

const TOTAL_STEPS = 3;

export function OnboardingFlow({ profile, role, onComplete, onDismiss }: OnboardingFlowProps) {
  const [step, setStep] = useState(0);
  const navigate = useNavigate();

  const features = roleFeatures[role] || roleFeatures.rep;
  const cta = roleCTA[role] || roleCTA.rep;
  const subtitle = roleSubtitles[role] || roleSubtitles.rep;

  const handleGetStarted = () => {
    onComplete();
    navigate(cta.href);
  };

  const handleNext = () => {
    if (step < TOTAL_STEPS - 1) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onDismiss(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          {step === 0 && (
            <>
              <DialogTitle className="text-2xl">
                Welcome to MindForge, {profile.name || 'there'}!
              </DialogTitle>
              <DialogDescription className="text-base">
                {subtitle}
              </DialogDescription>
            </>
          )}
          {step === 1 && (
            <>
              <DialogTitle className="text-2xl">
                Key Features
              </DialogTitle>
              <DialogDescription>
                Here is what you can do
              </DialogDescription>
            </>
          )}
          {step === 2 && (
            <>
              <DialogTitle className="text-2xl">
                You are all set!
              </DialogTitle>
              <DialogDescription>
                Jump right in and get started
              </DialogDescription>
            </>
          )}
        </DialogHeader>

        <div className="min-h-[200px] flex flex-col justify-center">
          {/* Step 0: Welcome */}
          {step === 0 && (
            <div className="text-center py-6">
              <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-3xl font-bold text-primary">
                  {profile.name?.charAt(0).toUpperCase() || 'U'}
                </span>
              </div>
              <p className="text-muted-foreground">
                Let us give you a quick tour of what MindForge can do for you.
              </p>
            </div>
          )}

          {/* Step 1: Features */}
          {step === 1 && (
            <div className={cn(
              'grid gap-3 py-2',
              features.length <= 3 ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-2'
            )}>
              {features.map((feature) => {
                const Icon = feature.icon;
                return (
                  <div
                    key={feature.title}
                    className="rounded-lg border p-3 flex flex-col items-center text-center gap-2"
                  >
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <p className="font-medium text-sm">{feature.title}</p>
                    <p className="text-xs text-muted-foreground leading-tight">{feature.description}</p>
                  </div>
                );
              })}
            </div>
          )}

          {/* Step 2: Get Started */}
          {step === 2 && (
            <div className="flex flex-col items-center gap-4 py-6">
              <p className="text-muted-foreground text-center">
                Ready to dive in? Click below to get started.
              </p>
              <Button size="lg" onClick={handleGetStarted} className="gap-2">
                {cta.label}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Footer: Navigation + Skip */}
        <div className="flex items-center justify-between pt-2 border-t">
          <button
            type="button"
            onClick={onDismiss}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Skip tour
          </button>

          <div className="flex items-center gap-3">
            {/* Step dots */}
            <div className="flex gap-1.5">
              {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    'h-2 w-2 rounded-full transition-colors',
                    i === step ? 'bg-primary' : 'bg-muted-foreground/30'
                  )}
                />
              ))}
            </div>

            {/* Nav buttons */}
            <div className="flex gap-2">
              {step > 0 && (
                <Button variant="outline" size="sm" onClick={handleBack}>
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Back
                </Button>
              )}
              {step < TOTAL_STEPS - 1 && (
                <Button size="sm" onClick={handleNext}>
                  Next
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
