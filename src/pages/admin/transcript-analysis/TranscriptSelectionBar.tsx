import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { TranscriptChatPanel } from '@/components/admin/TranscriptChatPanel';
import { cn } from '@/lib/utils';
import {
  CheckSquare,
  Square,
  Save,
  FolderOpen,
  Lightbulb,
  Database,
  Loader2,
  Sparkles,
  Info,
} from 'lucide-react';
import { Transcript } from './constants';

interface TranscriptSelectionBarProps {
  transcripts: Transcript[];
  selectedTranscriptIds: Set<string>;
  selectedTranscripts: Transcript[];
  currentSelectionId: string | null;
  estimatedTokens: number;
  chunkStatus: { indexed: number; total: number } | undefined;
  isIndexing: boolean;
  analysisMode: { label: string; color: string; useRag: boolean };
  chatOpen: boolean;
  onChatOpenChange: (open: boolean) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onPreIndex: () => void;
  onSaveClick: () => void;
  onLoadClick: () => void;
  onInsightsClick: () => void;
}

export function TranscriptSelectionBar({
  transcripts,
  selectedTranscriptIds,
  selectedTranscripts,
  currentSelectionId,
  estimatedTokens,
  chunkStatus,
  isIndexing,
  analysisMode,
  chatOpen,
  onChatOpenChange,
  onSelectAll,
  onDeselectAll,
  onPreIndex,
  onSaveClick,
  onLoadClick,
  onInsightsClick,
}: TranscriptSelectionBarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-muted/50 rounded-lg">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onSelectAll} disabled={!transcripts?.length}>
            <CheckSquare className="h-4 w-4 mr-1" />
            Select All
          </Button>
          <Button variant="outline" size="sm" onClick={onDeselectAll} disabled={selectedTranscriptIds.size === 0}>
            <Square className="h-4 w-4 mr-1" />
            Deselect All
          </Button>
        </div>
        
        <div className="text-sm">
          <span className="font-medium">{selectedTranscriptIds.size}</span>
          <span className="text-muted-foreground"> of {transcripts?.length || 0} transcripts selected</span>
        </div>

        <div className="text-sm text-muted-foreground">
          ~{estimatedTokens.toLocaleString()} tokens
        </div>

        {/* Pre-Index Status */}
        {chunkStatus && chunkStatus.total > 0 && (
          <Badge 
            variant={chunkStatus.indexed === chunkStatus.total ? 'default' : 'secondary'}
            className={cn(
              "text-xs",
              chunkStatus.indexed === chunkStatus.total 
                ? "bg-green-500/10 text-green-600 border-green-500/20" 
                : "bg-amber-500/10 text-amber-600 border-amber-500/20"
            )}
          >
            <Database className="h-3 w-3 mr-1" />
            {chunkStatus.indexed} / {chunkStatus.total} indexed
          </Badge>
        )}
      </div>

      <div className="flex items-center gap-3">
        {/* Pre-Index & Save/Load Buttons */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onPreIndex}
            disabled={!transcripts?.length || isIndexing || (chunkStatus?.indexed === chunkStatus?.total && (chunkStatus?.total ?? 0) > 0)}
            title="Pre-index transcripts for faster RAG queries"
          >
            {isIndexing ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Database className="h-4 w-4 mr-1" />
            )}
            {isIndexing ? 'Indexing...' : 'Pre-Index'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onSaveClick}
            disabled={selectedTranscriptIds.size === 0}
          >
            <Save className="h-4 w-4 mr-1" />
            Save
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onLoadClick}
          >
            <FolderOpen className="h-4 w-4 mr-1" />
            Load
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onInsightsClick}
          >
            <Lightbulb className="h-4 w-4 mr-1" />
            Insights
          </Button>
        </div>
        
        <div className="flex items-center gap-2">
          <span className={cn("text-sm font-medium", analysisMode.color)}>
            {analysisMode.label}
          </span>
          <HoverCard>
            <HoverCardTrigger>
              <Info className="h-4 w-4 text-muted-foreground cursor-help" />
            </HoverCardTrigger>
            <HoverCardContent className="w-80">
              <div className="space-y-2 text-sm">
                <p><strong>Direct Analysis (1-20):</strong> Full transcript text sent to AI for complete context</p>
                <p><strong>RAG Mode (20+):</strong> AI searches for relevant sections using semantic search, enabling analysis of unlimited transcripts</p>
              </div>
            </HoverCardContent>
          </HoverCard>
        </div>

        <Sheet open={chatOpen} onOpenChange={onChatOpenChange}>
          <SheetTrigger asChild>
            <Button
              disabled={selectedTranscriptIds.size === 0}
              className="gap-2"
            >
              <Sparkles className="h-4 w-4" />
              Analyze with AI
              {analysisMode.useRag && (
                <Badge variant="secondary" className="ml-1">RAG</Badge>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent className="w-full sm:max-w-xl flex flex-col p-0">
            <TranscriptChatPanel
              selectedTranscripts={selectedTranscripts}
              useRag={analysisMode.useRag}
              selectionId={currentSelectionId}
              onClose={() => onChatOpenChange(false)}
            />
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}
