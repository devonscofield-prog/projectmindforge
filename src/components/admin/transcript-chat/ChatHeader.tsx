import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Sparkles, Search, Download, FileText, CheckCircle2 } from 'lucide-react';

interface ChatHeaderProps {
  useRag: boolean;
  autoSaved: boolean;
  transcriptCount: number;
  totalTokens: number;
  hasMessages: boolean;
  onExport: () => void;
}

export function ChatHeader({ useRag, autoSaved, transcriptCount, totalTokens, hasMessages, onExport }: ChatHeaderProps) {
  return (
    <SheetHeader className="px-6 py-4 border-b">
      <div className="flex items-center justify-between">
        <SheetTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Transcript Analysis
          {useRag && (
            <Badge variant="secondary" className="text-xs gap-1">
              <Search className="h-3 w-3" />
              RAG Mode
            </Badge>
          )}
        </SheetTitle>
        <div className="flex items-center gap-2">
          {autoSaved && (
            <Badge variant="outline" className="text-xs gap-1 text-success border-success/30">
              <CheckCircle2 className="h-3 w-3" />
              Saved
            </Badge>
          )}
          {hasMessages && (
            <Button
              variant="outline"
              size="sm"
              onClick={onExport}
              className="gap-1"
            >
              <Download className="h-4 w-4" />
              Export
            </Button>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <FileText className="h-4 w-4" />
        {transcriptCount} transcripts selected
        {!useRag && (
          <Badge variant="outline" className="text-xs">
            ~{Math.round(totalTokens).toLocaleString()} tokens
          </Badge>
        )}
      </div>
    </SheetHeader>
  );
}
