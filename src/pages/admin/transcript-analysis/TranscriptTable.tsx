import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { EmptyState } from '@/components/ui/empty-state';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { MessageSquare, FileText, Loader2, AlertCircle, CheckCircle, Clock, SkipForward, Users } from 'lucide-react';
import { CALL_TYPES, Transcript } from './constants';

interface TranscriptTableProps {
  transcripts: Transcript[];
  totalCount: number;
  isLoading: boolean;
  selectedTranscriptIds: Set<string>;
  currentPage: number;
  totalPages: number;
  pageSize: number;
  onToggleTranscript: (id: string) => void;
  onPageChange: (page: number) => void;
  onClearFilters?: () => void;
}

const STATUS_CONFIG = {
  pending: {
    label: 'Pending',
    variant: 'secondary' as const,
    className: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
    icon: Clock,
  },
  processing: {
    label: 'Processing',
    variant: 'secondary' as const,
    className: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
    icon: Loader2,
  },
  completed: {
    label: 'Analyzed',
    variant: 'default' as const,
    className: 'bg-green-500/10 text-green-600 border-green-500/20',
    icon: CheckCircle,
  },
  error: {
    label: 'Error',
    variant: 'destructive' as const,
    className: 'bg-red-500/10 text-red-600 border-red-500/20',
    icon: AlertCircle,
  },
  skipped: {
    label: 'Indexed Only',
    variant: 'secondary' as const,
    className: 'bg-muted text-muted-foreground',
    icon: SkipForward,
  },
} as const;

export function TranscriptTable({
  transcripts,
  totalCount,
  isLoading,
  selectedTranscriptIds,
  currentPage,
  totalPages,
  pageSize,
  onToggleTranscript,
  onPageChange,
  onClearFilters,
}: TranscriptTableProps) {
  const renderStatusBadge = (status: string) => {
    const config = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending;
    const Icon = config.icon;
    
    return (
      <Badge 
        variant={config.variant}
        className={cn("text-xs gap-1", config.className)}
      >
        <Icon className={cn("h-3 w-3", status === 'processing' && "animate-spin")} />
        {config.label}
      </Badge>
    );
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">
          Transcripts ({totalCount} total, showing {transcripts.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : transcripts?.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No transcripts found"
            description="No transcripts match your current filters."
            className="py-12"
            action={onClearFilters ? {
              label: 'Clear All Filters',
              onClick: onClearFilters
            } : undefined}
          />
        ) : (
          <ScrollArea className="h-[500px]">
            <table className="w-full">
              <thead className="sticky top-0 z-20 bg-card border-b">
                <tr className="text-left text-sm text-muted-foreground">
                  <th className="p-3 w-10">
                    <span className="sr-only">Select</span>
                  </th>
                  <th className="p-3">Date</th>
                  <th className="p-3">Account</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Rep</th>
                  <th className="p-3">Team</th>
                  <th className="p-3">Preview</th>
                </tr>
              </thead>
              <tbody>
                {transcripts?.map(transcript => (
                  <tr
                    key={transcript.id}
                    tabIndex={0}
                    className={cn(
                      "border-b hover:bg-muted/50 cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-inset",
                      selectedTranscriptIds.has(transcript.id) && "bg-primary/5"
                    )}
                    onClick={() => onToggleTranscript(transcript.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onToggleTranscript(transcript.id);
                      }
                    }}
                  >
                    <td className="p-3" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        id={`transcript-${transcript.id}`}
                        checked={selectedTranscriptIds.has(transcript.id)}
                        onCheckedChange={() => onToggleTranscript(transcript.id)}
                        aria-label={`Select transcript for ${transcript.account_name || 'Unknown'}`}
                      />
                    </td>
                    <td className="p-3 text-sm">
                      <div className="flex items-center gap-2">
                        {format(new Date(transcript.call_date), 'MMM d, yyyy')}
                        {transcript.manager_id && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Users className="h-4 w-4 text-primary shrink-0" />
                              </TooltipTrigger>
                              <TooltipContent>Manager was on this call</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                    </td>
                    <td className="p-3 text-sm font-medium">
                      {transcript.account_name || 'Unknown'}
                    </td>
                    <td className="p-3">
                      <Badge variant="outline" className="text-xs">
                        {CALL_TYPES.find(t => t.value === transcript.call_type)?.label || transcript.call_type || 'Call'}
                      </Badge>
                    </td>
                    <td className="p-3">
                      {renderStatusBadge(transcript.analysis_status)}
                    </td>
                    <td className="p-3 text-sm">{transcript.rep_name}</td>
                    <td className="p-3 text-sm text-muted-foreground">{transcript.team_name}</td>
                    <td className="p-3">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-xs"
                            onClick={(e) => e.stopPropagation()}
                            aria-label={`Preview transcript for ${transcript.account_name || 'Unknown'}`}
                          >
                            <MessageSquare className="h-3 w-3 mr-1" />
                            Preview
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-lg max-h-[80vh]">
                          <DialogHeader>
                            <DialogTitle>
                              {transcript.account_name} - {format(new Date(transcript.call_date), 'MMM d, yyyy')}
                            </DialogTitle>
                          </DialogHeader>
                          <ScrollArea className="h-[400px] pr-4">
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                              {transcript.raw_text?.substring(0, 2000)}
                              {(transcript.raw_text?.length || 0) > 2000 && '...'}
                            </p>
                          </ScrollArea>
                        </DialogContent>
                      </Dialog>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollArea>
        )}
        
        {/* Pagination Controls */}
        {totalCount > pageSize && (
          <div className="p-4 border-t">
            <PaginationControls
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalCount}
              pageSize={pageSize}
              onPageChange={onPageChange}
              showPageSize={false}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
