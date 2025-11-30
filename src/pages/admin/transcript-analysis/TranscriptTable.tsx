import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { cn } from '@/lib/utils';
import { MessageSquare } from 'lucide-react';
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
}

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
}: TranscriptTableProps) {
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
          <div className="text-center py-12 text-muted-foreground">
            No transcripts found matching your filters
          </div>
        ) : (
          <ScrollArea className="h-[500px]">
            <table className="w-full">
              <thead className="sticky top-0 bg-background border-b">
                <tr className="text-left text-sm text-muted-foreground">
                  <th className="p-3 w-10"></th>
                  <th className="p-3">Date</th>
                  <th className="p-3">Account</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Rep</th>
                  <th className="p-3">Team</th>
                  <th className="p-3">Preview</th>
                </tr>
              </thead>
              <tbody>
                {transcripts?.map(transcript => (
                  <tr
                    key={transcript.id}
                    className={cn(
                      "border-b hover:bg-muted/50 cursor-pointer transition-colors",
                      selectedTranscriptIds.has(transcript.id) && "bg-primary/5"
                    )}
                    onClick={() => onToggleTranscript(transcript.id)}
                  >
                    <td className="p-3" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedTranscriptIds.has(transcript.id)}
                        onCheckedChange={() => onToggleTranscript(transcript.id)}
                      />
                    </td>
                    <td className="p-3 text-sm">
                      {format(new Date(transcript.call_date), 'MMM d, yyyy')}
                    </td>
                    <td className="p-3 text-sm font-medium">
                      {transcript.account_name || 'Unknown'}
                    </td>
                    <td className="p-3">
                      <Badge variant="outline" className="text-xs">
                        {CALL_TYPES.find(t => t.value === transcript.call_type)?.label || transcript.call_type || 'Call'}
                      </Badge>
                    </td>
                    <td className="p-3 text-sm">{transcript.rep_name}</td>
                    <td className="p-3 text-sm text-muted-foreground">{transcript.team_name}</td>
                    <td className="p-3">
                      <HoverCard>
                        <HoverCardTrigger asChild>
                          <Button variant="ghost" size="sm" className="text-xs">
                            <MessageSquare className="h-3 w-3 mr-1" />
                            Preview
                          </Button>
                        </HoverCardTrigger>
                        <HoverCardContent className="w-96" align="end">
                          <div className="space-y-2">
                            <div className="font-medium text-sm">
                              {transcript.account_name} - {format(new Date(transcript.call_date), 'MMM d, yyyy')}
                            </div>
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                              {transcript.raw_text?.substring(0, 500)}
                              {(transcript.raw_text?.length || 0) > 500 && '...'}
                            </p>
                          </div>
                        </HoverCardContent>
                      </HoverCard>
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
