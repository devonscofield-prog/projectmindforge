import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { User, Check, X } from 'lucide-react';
import type { PsychologyProfile } from '@/utils/analysis-schemas';
import { cn } from '@/lib/utils';

interface ProspectPersonaCardProps {
  psychology: PsychologyProfile | null;
}

const DISC_EMOJIS: Record<string, string> = {
  'D - Dominance': '🦁',
  'I - Influence': '🦋',
  'S - Steadiness': '🐢',
  'C - Compliance': '🦉',
};

const DISC_COLORS: Record<string, string> = {
  'D - Dominance': 'bg-red-500/10 text-red-600 border-red-500/30',
  'I - Influence': 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30',
  'S - Steadiness': 'bg-green-500/10 text-green-600 border-green-500/30',
  'C - Compliance': 'bg-blue-500/10 text-blue-600 border-blue-500/30',
};

export function ProspectPersonaCard({ psychology }: ProspectPersonaCardProps) {
  if (!psychology) {
    return null;
  }

  const discEmoji = DISC_EMOJIS[psychology.disc_profile] || '👤';
  const discColor = DISC_COLORS[psychology.disc_profile] || 'bg-muted text-muted-foreground';

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <User className="h-4 w-4 text-primary" />
          Prospect Persona
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Persona & DISC Header */}
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-3xl">
            {discEmoji}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg truncate">
              {psychology.prospect_persona}
            </h3>
            <Badge 
              variant="outline" 
              className={cn("mt-1", discColor)}
            >
              {psychology.disc_profile}
            </Badge>
          </div>
        </div>

        {/* Communication Style */}
        <div className="rounded-lg bg-muted/50 p-3 space-y-2">
          <p className="text-sm font-medium">Communication Style</p>
          <div className="text-sm text-muted-foreground space-y-1">
            <p><span className="font-medium text-foreground">Tone:</span> {psychology.communication_style.tone}</p>
            <p><span className="font-medium text-foreground">Preference:</span> {psychology.communication_style.preference}</p>
          </div>
        </div>

        <Separator />

        {/* How to Sell to Me */}
        <div className="space-y-3">
          <p className="text-sm font-semibold">How to Sell to This Buyer</p>
          
          {/* Dos */}
          {psychology.dos_and_donts.do.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-green-600 flex items-center gap-1">
                <Check className="h-3 w-3" />
                DO
              </p>
              <ul className="space-y-1">
                {psychology.dos_and_donts.do.map((item, idx) => (
                  <li key={idx} className="text-sm text-muted-foreground pl-4 relative before:absolute before:left-0 before:content-['•'] before:text-green-500">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {/* Don'ts */}
          {psychology.dos_and_donts.dont.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-destructive flex items-center gap-1">
                <X className="h-3 w-3" />
                DON'T
              </p>
              <ul className="space-y-1">
                {psychology.dos_and_donts.dont.map((item, idx) => (
                  <li key={idx} className="text-sm text-muted-foreground pl-4 relative before:absolute before:left-0 before:content-['•'] before:text-destructive">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
