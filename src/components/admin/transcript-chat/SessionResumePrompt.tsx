import { Button } from '@/components/ui/button';
import { History, RotateCcw } from 'lucide-react';
import type { AnalysisSession } from '@/api/analysisSessions';

interface SessionResumePromptProps {
  session: AnalysisSession;
  onResume: () => void;
  onStartFresh: () => void;
}

export function SessionResumePrompt({ session, onResume, onStartFresh }: SessionResumePromptProps) {
  return (
    <div className="mx-6 mt-4 p-4 rounded-lg border border-primary/20 bg-primary/5">
      <div className="flex items-start gap-3">
        <History className="h-5 w-5 text-primary shrink-0 mt-0.5" />
        <div className="flex-1">
          <h4 className="font-medium text-sm">Resume Previous Analysis?</h4>
          <p className="text-xs text-muted-foreground mt-1">
            You have a saved analysis with {session.messages.length} messages for these transcripts.
          </p>
          <div className="flex gap-2 mt-3">
            <Button size="sm" onClick={onResume} className="gap-1">
              <RotateCcw className="h-3 w-3" />
              Resume
            </Button>
            <Button size="sm" variant="outline" onClick={onStartFresh}>
              Start Fresh
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
