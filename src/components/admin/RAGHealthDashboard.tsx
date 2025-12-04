import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Database, 
  Brain, 
  FileText, 
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock
} from 'lucide-react';

interface ChunkStats {
  total_chunks: number;
  with_embeddings: number;
  ner_completed: number;
  ner_pending: number;
  ner_failed: number;
  avg_chunk_length: number;
  min_chunk_length: number;
  max_chunk_length: number;
  unique_transcripts: number;
}

async function fetchChunkStats(): Promise<ChunkStats> {
  const { data, error } = await supabase
    .from('transcript_chunks')
    .select('id, embedding, extraction_status, chunk_text, transcript_id');

  if (error) throw error;

  const chunks = data || [];
  const uniqueTranscripts = new Set(chunks.map(c => c.transcript_id)).size;
  const chunkLengths = chunks.map(c => c.chunk_text?.length || 0);

  return {
    total_chunks: chunks.length,
    with_embeddings: chunks.filter(c => c.embedding !== null).length,
    ner_completed: chunks.filter(c => c.extraction_status === 'completed').length,
    ner_pending: chunks.filter(c => c.extraction_status === 'pending' || c.extraction_status === null).length,
    ner_failed: chunks.filter(c => c.extraction_status === 'failed').length,
    avg_chunk_length: chunkLengths.length > 0 ? Math.round(chunkLengths.reduce((a, b) => a + b, 0) / chunkLengths.length) : 0,
    min_chunk_length: chunkLengths.length > 0 ? Math.min(...chunkLengths) : 0,
    max_chunk_length: chunkLengths.length > 0 ? Math.max(...chunkLengths) : 0,
    unique_transcripts: uniqueTranscripts,
  };
}

function StatCard({ 
  label, 
  value, 
  total, 
  icon: Icon, 
  color 
}: { 
  label: string; 
  value: number; 
  total: number; 
  icon: React.ElementType; 
  color: string;
}) {
  const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
  
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${color}`} />
          <span className="text-sm font-medium">{label}</span>
        </div>
        <span className="text-sm text-muted-foreground">
          {value.toLocaleString()} / {total.toLocaleString()}
        </span>
      </div>
      <Progress value={percentage} className="h-2" />
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{percentage}% complete</span>
        {percentage === 100 && (
          <Badge variant="outline" className="text-xs bg-green-500/10 text-green-600 border-green-500/20">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Done
          </Badge>
        )}
        {percentage > 0 && percentage < 100 && (
          <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-600 border-amber-500/20">
            <Clock className="h-3 w-3 mr-1" />
            In Progress
          </Badge>
        )}
        {percentage === 0 && total > 0 && (
          <Badge variant="outline" className="text-xs bg-red-500/10 text-red-600 border-red-500/20">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Not Started
          </Badge>
        )}
      </div>
    </div>
  );
}

function NERStatusBadges({ stats }: { stats: ChunkStats }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Badge variant="outline" className="text-xs bg-green-500/10 text-green-600 border-green-500/20">
        <CheckCircle2 className="h-3 w-3 mr-1" />
        {stats.ner_completed} extracted
      </Badge>
      <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-600 border-amber-500/20">
        <Clock className="h-3 w-3 mr-1" />
        {stats.ner_pending} pending
      </Badge>
      {stats.ner_failed > 0 && (
        <Badge variant="outline" className="text-xs bg-red-500/10 text-red-600 border-red-500/20">
          <XCircle className="h-3 w-3 mr-1" />
          {stats.ner_failed} failed
        </Badge>
      )}
    </div>
  );
}

export function RAGHealthDashboard() {
  const { data: stats, isLoading, error } = useQuery({
    queryKey: ['rag-health-stats'],
    queryFn: fetchChunkStats,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="flex items-center gap-2 text-destructive">
        <AlertTriangle className="h-4 w-4" />
        <p className="text-sm">Failed to load RAG system stats</p>
      </div>
    );
  }

  const embeddingPct = stats.total_chunks > 0 ? Math.round((stats.with_embeddings / stats.total_chunks) * 100) : 0;
  const nerPct = stats.total_chunks > 0 ? Math.round((stats.ner_completed / stats.total_chunks) * 100) : 0;
  const overallHealth = Math.round((embeddingPct + nerPct) / 2);

  return (
    <div className="space-y-5">
      {/* Overall Health Badge */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Overall Readiness</span>
        <Badge 
          variant="outline" 
          className={`text-xs ${
            overallHealth >= 80 
              ? 'bg-green-500/10 text-green-600 border-green-500/20' 
              : overallHealth >= 50 
                ? 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                : 'bg-red-500/10 text-red-600 border-red-500/20'
          }`}
        >
          {overallHealth}% Ready
        </Badge>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-2 gap-4 text-center">
        <div className="p-3 rounded-lg bg-muted/50">
          <p className="text-2xl font-bold">{stats.total_chunks.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">Total Chunks</p>
        </div>
        <div className="p-3 rounded-lg bg-muted/50">
          <p className="text-2xl font-bold">{stats.unique_transcripts.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">Transcripts Indexed</p>
        </div>
      </div>

      {/* Embedding Progress */}
      <StatCard
        label="Vector Embeddings"
        value={stats.with_embeddings}
        total={stats.total_chunks}
        icon={Database}
        color="text-blue-500"
      />

      {/* NER Progress */}
      <div className="space-y-2">
        <StatCard
          label="NER Extraction"
          value={stats.ner_completed}
          total={stats.total_chunks}
          icon={Brain}
          color="text-purple-500"
        />
        <NERStatusBadges stats={stats} />
      </div>

      {/* Chunk Quality */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Chunk Quality</span>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-2 rounded bg-muted/30">
            <p className="text-sm font-medium">{stats.min_chunk_length.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Min chars</p>
          </div>
          <div className="p-2 rounded bg-muted/30">
            <p className="text-sm font-medium">{stats.avg_chunk_length.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Avg chars</p>
          </div>
          <div className="p-2 rounded bg-muted/30">
            <p className="text-sm font-medium">{stats.max_chunk_length.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Max chars</p>
          </div>
        </div>
      </div>

      {/* Health Warning */}
      {overallHealth < 50 && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-700 dark:text-amber-400">
            RAG system is operating in degraded mode. Run embedding and NER backfills from Admin Tools to enable full semantic search.
          </p>
        </div>
      )}
    </div>
  );
}
