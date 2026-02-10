import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Bot, 
  AlertTriangle, 
  Target, 
  Lightbulb,
  Phone,
  User,
  Building2,
  ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PersonaClient } from '@/types/persona';

interface RoleplayBriefingProps {
  persona: PersonaClient;
  onStart: () => void;
}

const FULL_CALL_TIPS: string[] = [
  'Start with discovery — ask open-ended questions to uncover pain points',
  'Listen more than you speak — aim for a 30/70 talk ratio early on',
  'Transition to your demo only after understanding their needs',
  'Connect every feature back to their stated challenges',
  'Handle objections with LAER: Listen, Acknowledge, Explore, Respond',
  'Anchor on value before discussing price',
  'Secure clear next steps and commitment before ending the call',
];

const DISC_COMMUNICATION_TIPS: Record<string, string[]> = {
  D: [
    'Get to the point quickly - they value efficiency',
    'Focus on results and ROI',
    'Be confident and direct',
    'Respect their time - avoid small talk',
  ],
  I: [
    'Build rapport and connection first',
    'Be enthusiastic and positive',
    'Let them share their stories',
    'Use collaborative language',
  ],
  S: [
    'Be patient and reassuring',
    'Don\'t push too hard for commitment',
    'Address change management concerns',
    'Emphasize support and stability',
  ],
  C: [
    'Provide detailed data and documentation',
    'Be accurate and precise',
    'Answer technical questions thoroughly',
    'Show your process and methodology',
  ],
};

export function RoleplayBriefing({ 
  persona, 
  onStart,
}: RoleplayBriefingProps) {
  const discProfile = persona.disc_profile?.toUpperCase() || 'S';
  const discTips = DISC_COMMUNICATION_TIPS[discProfile] || DISC_COMMUNICATION_TIPS['S'];
  
  // Get visible pain points (challenges they'll openly share)
  const visiblePainPoints = persona.pain_points?.filter(p => p.visible).slice(0, 3) || [];
  const hiddenPainPoints = persona.pain_points?.filter(p => !p.visible).slice(0, 2) || [];
  
  // Get top objections to expect
  const topObjections = persona.common_objections?.slice(0, 3) || [];

  return (
    <div className="space-y-6">
      {/* Persona Profile */}
      <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
              <Bot className="h-8 w-8 text-primary" />
            </div>
            <div className="flex-1">
              <CardTitle className="text-xl">{persona.name}</CardTitle>
              <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                <User className="h-3.5 w-3.5" />
                <span className="capitalize">{persona.persona_type.replace('_', ' ')}</span>
                <span>•</span>
                <Building2 className="h-3.5 w-3.5" />
                <span>{persona.industry || 'General'}</span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <Badge variant="outline" className="capitalize">
                {persona.difficulty_level}
              </Badge>
              {persona.disc_profile && (
                <Badge variant="secondary">
                  DISC: {persona.disc_profile.toUpperCase()}
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        {persona.backstory && (
          <CardContent className="pt-0">
            <p className="text-sm text-muted-foreground italic">
              "{persona.backstory}"
            </p>
          </CardContent>
        )}
      </Card>

      {/* Two-column layout for tips */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Full Sales Call Tips */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              Sales Call Guide
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {FULL_CALL_TIPS.map((tip, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <ChevronRight className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* DISC Communication Tips */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-amber-500" />
              Communicating with {discProfile}-Profile
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {discTips.map((tip, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <ChevronRight className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Challenges to Uncover */}
      {visiblePainPoints.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="h-4 w-4 text-blue-500" />
              Challenges to Uncover
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {visiblePainPoints.map((point, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <Badge variant="outline" className="shrink-0 text-xs">
                    {point.severity}
                  </Badge>
                  <span>{point.pain}</span>
                </div>
              ))}
              {hiddenPainPoints.length > 0 && (
                <p className="text-xs text-muted-foreground italic mt-2 border-t pt-2">
                  💡 Hint: There are {hiddenPainPoints.length} hidden pain point{hiddenPainPoints.length > 1 ? 's' : ''} to discover through skilled questioning
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Objections to Expect */}
      {topObjections.length > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Objections to Expect
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {topObjections.map((objection, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <Badge 
                    variant="outline" 
                    className={cn(
                      "shrink-0 text-xs",
                      objection.severity === 'high' && "border-red-500/50 text-red-600",
                      objection.severity === 'medium' && "border-amber-500/50 text-amber-600",
                      objection.severity === 'low' && "border-green-500/50 text-green-600"
                    )}
                  >
                    {objection.category}
                  </Badge>
                  <span>"{objection.objection}"</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Start Button */}
      <div className="flex justify-center pt-4">
        <Button size="lg" className="gap-2 px-12" onClick={onStart}>
          <Phone className="h-5 w-5" />
          Start Sales Call
        </Button>
      </div>
    </div>
  );
}
