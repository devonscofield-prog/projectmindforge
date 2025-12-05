import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
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
  RefreshCw,
  Settings2,
  Zap,
  RotateCcw,
  Brain,
} from 'lucide-react';
import { Transcript } from './constants';

interface TranscriptSelectionBarProps {
  transcripts: Transcript[];
  selectedTranscriptIds: Set<string>;
  selectedTranscripts: Transcript[];
  currentSelectionId: string | null;
  estimatedTokens: number;
  totalCount: number;
  chunkStatus: { indexed: number; total: number } | undefined;
  globalChunkStatus?: { 
    indexed: number; 
    total: number;
    totalChunks?: number;
    withEmbeddings?: number;
    missingEmbeddings?: number;
    nerCompleted?: number;
    nerPending?: number;
  };
  isIndexing: boolean;
  isBackfilling?: boolean;
  isBackfillingEmbeddings?: boolean;
  isBackfillingEntities?: boolean;
  isResetting?: boolean;
  resetProgress?: string | null;
  embeddingsProgress?: { processed: number; total: number } | null;
  analysisMode: { label: string; color: string; useRag: boolean };
  chatOpen: boolean;
  isAdmin?: boolean;
  onChatOpenChange: (open: boolean) => void;
  onSelectAll: () => void;
  onSelectAllMatching: () => void;
  onDeselectAll: () => void;
  onPreIndex: () => void;
  onBackfillAll?: () => void;
  onBackfillEmbeddings?: () => void;
  onBackfillEntities?: () => void;
  onStopEmbeddingsBackfill?: () => void;
  onResetAndReindex?: () => void;
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
  totalCount,
  chunkStatus,
  globalChunkStatus,
  isIndexing,
  isBackfilling,
  isBackfillingEmbeddings,
  isBackfillingEntities,
  isResetting,
  resetProgress,
  embeddingsProgress,
  analysisMode,
  chatOpen,
  isAdmin,
  onChatOpenChange,
  onSelectAll,
  onSelectAllMatching,
  onDeselectAll,
  onPreIndex,
  onBackfillAll,
  onBackfillEmbeddings,
  onBackfillEntities,
  onStopEmbeddingsBackfill,
  onResetAndReindex,
  onSaveClick,
  onLoadClick,
  onInsightsClick,
}: TranscriptSelectionBarProps) {
  const hasUnindexed = globalChunkStatus && globalChunkStatus.indexed < globalChunkStatus.total;
  const isAnyBackfillRunning = isIndexing || isBackfilling || isBackfillingEmbeddings || isBackfillingEntities || isResetting;
  const hasAdminActions = isAdmin && (
    hasUnindexed || 
    (globalChunkStatus?.missingEmbeddings && globalChunkStatus.missingEmbeddings > 0) ||
    (globalChunkStatus?.nerPending && globalChunkStatus.nerPending > 0) ||
    (globalChunkStatus?.totalChunks && globalChunkStatus.totalChunks > 0)
  );

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-muted/50 rounded-lg">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onSelectAll} 
            disabled={!transcripts?.length}
            aria-label="Select all transcripts on current page"
          >
            <CheckSquare className="h-4 w-4 mr-1" />
            Page
          </Button>
          {totalCount > transcripts?.length && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onSelectAllMatching}
              aria-label={`Select all ${totalCount} matching transcripts`}
            >
              <CheckSquare className="h-4 w-4 mr-1" />
              All ({totalCount})
            </Button>
          )}
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onDeselectAll} 
            disabled={selectedTranscriptIds.size === 0}
            aria-label="Clear selection"
          >
            <Square className="h-4 w-4 mr-1" />
            Clear
          </Button>
        </div>
        
        <div className="text-sm">
          <span className="font-medium">{selectedTranscriptIds.size}</span>
          <span className="text-muted-foreground"> of {totalCount} selected</span>
        </div>

        {/* Token count - only show in Direct mode */}
        {!analysisMode.useRag && (
          <div className="text-sm text-muted-foreground">
            ~{estimatedTokens.toLocaleString()} tokens
          </div>
        )}

        {/* RAG Mode indicator when in RAG mode */}
        {analysisMode.useRag && (
          <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20">
            <Zap className="h-3 w-3 mr-1" />
            RAG Mode - Unlimited
          </Badge>
        )}

        {/* Pre-Index Status for selection */}
        {chunkStatus && chunkStatus.total > 0 && (
          <Badge 
            variant={chunkStatus.indexed >= chunkStatus.total ? 'default' : 'secondary'}
            className={cn(
              "text-xs",
              chunkStatus.indexed >= chunkStatus.total 
                ? "bg-green-500/10 text-green-600 border-green-500/20" 
                : "bg-amber-500/10 text-amber-600 border-amber-500/20"
            )}
          >
            <Database className="h-3 w-3 mr-1" />
            {Math.min(chunkStatus.indexed, chunkStatus.total)} / {chunkStatus.total} indexed
          </Badge>
        )}

        {/* Global Index Status (Admin only) */}
        {isAdmin && globalChunkStatus && (
          <HoverCard>
            <HoverCardTrigger>
              <Badge 
                variant="outline"
                className={cn(
                  "text-xs cursor-help",
                  globalChunkStatus.indexed >= globalChunkStatus.total 
                    ? "border-green-500/30 text-green-600" 
                    : "border-amber-500/30 text-amber-600"
                )}
              >
                <Database className="h-3 w-3 mr-1" />
                Global: {Math.min(globalChunkStatus.indexed, globalChunkStatus.total)} / {globalChunkStatus.total}
              </Badge>
            </HoverCardTrigger>
            <HoverCardContent className="w-80" side="bottom">
              <div className="space-y-3 text-sm">
                <p><strong>RAG Index Status</strong></p>
                <p>{globalChunkStatus.indexed} of {globalChunkStatus.total} completed transcripts are indexed for RAG search.</p>
                
                {globalChunkStatus.totalChunks !== undefined && (
                  <div className="space-y-1 pt-2 border-t">
                    <p><strong>Chunk Quality:</strong></p>
                    <p className={cn(
                      globalChunkStatus.withEmbeddings === globalChunkStatus.totalChunks 
                        ? "text-green-600" 
                        : "text-amber-600"
                    )}>
                      Embeddings: {globalChunkStatus.withEmbeddings?.toLocaleString()} / {globalChunkStatus.totalChunks?.toLocaleString()}
                    </p>
                    <p className={cn(
                      globalChunkStatus.nerCompleted === globalChunkStatus.totalChunks 
                        ? "text-green-600" 
                        : "text-amber-600"
                    )}>
                      NER Extraction: {globalChunkStatus.nerCompleted?.toLocaleString()} / {globalChunkStatus.totalChunks?.toLocaleString()}
                    </p>
                  </div>
                )}

                {hasUnindexed && (
                  <p className="text-amber-600">
                    {globalChunkStatus.total - globalChunkStatus.indexed} transcripts need indexing for optimal RAG performance.
                  </p>
                )}
              </div>
            </HoverCardContent>
          </HoverCard>
        )}
      </div>

      <div className="flex items-center gap-3">
        {/* Core Actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onPreIndex}
            disabled={!transcripts?.length || isAnyBackfillRunning || (chunkStatus?.indexed === chunkStatus?.total && (chunkStatus?.total ?? 0) > 0)}
            title="Pre-index selected transcripts for faster RAG queries"
            aria-label="Index selected transcripts"
          >
            {isIndexing ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Database className="h-4 w-4 mr-1" />
            )}
            {isIndexing ? 'Indexing...' : 'Index Selected'}
          </Button>

          {/* Admin Tools Dropdown */}
          {hasAdminActions && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isAnyBackfillRunning}
                  className="border-primary/30 text-primary hover:bg-primary/10"
                >
                  {isAnyBackfillRunning ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Settings2 className="h-4 w-4 mr-1" />
                  )}
                  Admin Tools
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                {hasUnindexed && onBackfillAll && (
                  <DropdownMenuItem 
                    onClick={onBackfillAll}
                    disabled={isAnyBackfillRunning}
                    className="gap-2"
                  >
                    <RefreshCw className="h-4 w-4 text-amber-600" />
                    <div className="flex flex-col">
                      <span>Backfill Chunks</span>
                      <span className="text-xs text-muted-foreground">
                        {(globalChunkStatus?.total || 0) - (globalChunkStatus?.indexed || 0)} unindexed
                      </span>
                    </div>
                  </DropdownMenuItem>
                )}
                
                {globalChunkStatus?.missingEmbeddings && globalChunkStatus.missingEmbeddings > 0 && onBackfillEmbeddings && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={isBackfillingEmbeddings ? onStopEmbeddingsBackfill : onBackfillEmbeddings}
                      disabled={isIndexing || isBackfilling || isBackfillingEntities}
                      className="gap-2"
                    >
                      <Database className={cn("h-4 w-4 text-blue-600", isBackfillingEmbeddings && "animate-spin")} />
                      <div className="flex flex-col">
                        <span>{isBackfillingEmbeddings ? 'Stop Embeddings' : 'Auto-Embeddings'}</span>
                        <span className="text-xs text-muted-foreground">
                          {isBackfillingEmbeddings && embeddingsProgress 
                            ? `${embeddingsProgress.processed}/${embeddingsProgress.total}` 
                            : `${globalChunkStatus.missingEmbeddings.toLocaleString()} missing`}
                        </span>
                      </div>
                    </DropdownMenuItem>
                  </>
                )}
                
                {/* NER Extraction */}
                {globalChunkStatus?.nerPending && globalChunkStatus.nerPending > 0 && onBackfillEntities && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={onBackfillEntities}
                      disabled={isIndexing || isBackfilling || isBackfillingEmbeddings || isResetting}
                      className="gap-2"
                    >
                      <Brain className={cn("h-4 w-4 text-purple-600", isBackfillingEntities && "animate-spin")} />
                      <div className="flex flex-col">
                        <span>{isBackfillingEntities ? 'Extracting Entities...' : 'Backfill NER'}</span>
                        <span className="text-xs text-muted-foreground">
                          {globalChunkStatus.nerPending.toLocaleString()} pending
                        </span>
                      </div>
                    </DropdownMenuItem>
                  </>
                )}

                {/* Reset & Reindex All */}
                {onResetAndReindex && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={onResetAndReindex}
                      disabled={isAnyBackfillRunning}
                      className="gap-2 text-destructive focus:text-destructive"
                    >
                      <RotateCcw className={cn("h-4 w-4", isResetting && "animate-spin")} />
                      <div className="flex flex-col">
                        <span>{isResetting ? 'Resetting...' : 'Reset & Reindex All'}</span>
                        <span className="text-xs text-muted-foreground">
                          {isResetting && resetProgress ? resetProgress : 'Full RAG system reset'}
                        </span>
                      </div>
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={onSaveClick}
            disabled={selectedTranscriptIds.size === 0}
            aria-label="Save current selection"
          >
            <Save className="h-4 w-4 mr-1" />
            Save
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onLoadClick}
            aria-label="Load saved selection"
          >
            <FolderOpen className="h-4 w-4 mr-1" />
            Load
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onInsightsClick}
            aria-label="View saved insights"
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
              <Info className="h-4 w-4 text-muted-foreground cursor-help" aria-label="Analysis mode information" />
            </HoverCardTrigger>
            <HoverCardContent className="w-80" side="bottom">
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
              aria-label={`Analyze ${selectedTranscriptIds.size} transcripts with AI`}
            >
              <Sparkles className="h-4 w-4" />
              Analyze with AI
              {analysisMode.useRag && (
                <Badge variant="secondary" className="ml-1">RAG</Badge>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent className="w-full sm:max-w-2xl lg:max-w-3xl flex flex-col p-0">
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
