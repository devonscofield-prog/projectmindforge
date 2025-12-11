import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { User, Check, X, Quote, Mail, Copy, ChevronRight } from 'lucide-react';
import type { PsychologyProfile } from '@/utils/analysis-schemas';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface ProspectPersonaCardProps {
  psychology: PsychologyProfile | null;
  isLoading?: boolean;
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

export function ProspectPersonaCard({ psychology, isLoading = false }: ProspectPersonaCardProps) {
  const [copiedSubject, setCopiedSubject] = useState(false);

  const handleCopySubject = async () => {
    if (!psychology?.suggested_email_subject) return;
    try {
      await navigator.clipboard.writeText(psychology.suggested_email_subject);
      setCopiedSubject(true);
      toast('Subject copied to clipboard');
      setTimeout(() => setCopiedSubject(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  // Loading state - compact trigger skeleton
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-card">
        <Skeleton className="h-4 w-4 rounded-full" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-5 w-28 rounded-full" />
      </div>
    );
  }

  // No data state - compact
  if (!psychology) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-muted-foreground/25 bg-muted/30">
        <User className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">No persona data</span>
      </div>
    );
  }

  const discEmoji = DISC_EMOJIS[psychology.disc_profile] || '👤';
  const discColor = DISC_COLORS[psychology.disc_profile] || 'bg-muted text-muted-foreground';

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-card hover:bg-muted/50 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="View prospect persona details"
        >
          <User className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Prospect Persona</span>
          <Badge 
            variant="outline" 
            className={cn("text-xs", discColor)}
          >
            {discEmoji} {psychology.disc_profile}
          </Badge>
          <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto" />
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl md:max-w-2xl lg:max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            Prospect Persona
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Persona & DISC Header */}
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-3xl shrink-0">
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

          {/* Evidence Quote */}
          {psychology.evidence_quote && (
            <div className="rounded-lg bg-muted/30 p-3 border-l-2 border-primary/50">
              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1 mb-1">
                <Quote className="h-3 w-3" />
                Evidence
              </p>
              <p className="text-sm italic text-muted-foreground">
                "{psychology.evidence_quote}"
              </p>
            </div>
          )}

          {/* Communication Style */}
          <div className="rounded-lg bg-muted/50 p-3 space-y-2">
            <p className="text-sm font-medium">Communication Style</p>
            <div className="text-sm text-muted-foreground space-y-1">
              <p><span className="font-medium text-foreground">Tone:</span> {psychology.communication_style.tone}</p>
              <p><span className="font-medium text-foreground">Preference:</span> {psychology.communication_style.preference}</p>
            </div>
          </div>

          {/* Suggested Email Subject */}
          {psychology.suggested_email_subject && (
            <div className="rounded-lg bg-primary/5 p-3 space-y-2">
              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Mail className="h-3 w-3" />
                Suggested Email Subject
              </p>
              <div className="flex items-center gap-2">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <p className="text-sm font-medium flex-1 truncate cursor-help">
                        {psychology.suggested_email_subject}
                      </p>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs">
                      <p className="text-sm">{psychology.suggested_email_subject}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-7 w-7 p-0 shrink-0 transition-colors",
                    copiedSubject && "text-green-600"
                  )}
                  aria-label="Copy email subject to clipboard"
                  onClick={handleCopySubject}
                >
                  {copiedSubject ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>
          )}

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
        </div>
      </DialogContent>
    </Dialog>
  );
}