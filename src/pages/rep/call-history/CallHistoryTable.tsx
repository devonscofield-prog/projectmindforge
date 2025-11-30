import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PullToRefresh } from '@/components/ui/pull-to-refresh';
import { MobileCallCard } from '@/components/calls/MobileCallCard';
import { ListSkeleton, TableSkeleton } from '@/components/ui/skeletons';
import { CallTranscriptWithHeat } from '@/api/aiCallAnalysis';
import { CallType, callTypeLabels } from '@/constants/callTypes';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  CheckCircle,
  AlertCircle,
  Clock,
  ArrowRight,
  History,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Flame,
  Mic,
} from 'lucide-react';
import { PAGE_SIZE_OPTIONS, SortColumn } from './constants';

interface CallHistoryTableProps {
  transcripts: CallTranscriptWithHeat[];
  totalCount: number;
  isLoading: boolean;
  hasActiveFilters: boolean;
  currentPage: number;
  pageSize: number;
  totalPages: number;
  sortBy: SortColumn;
  onRefresh: () => Promise<void>;
  onToggleSort: (column: SortColumn) => void;
  onGoToPage: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

export function CallHistoryTable({
  transcripts,
  totalCount,
  isLoading,
  hasActiveFilters,
  currentPage,
  pageSize,
  totalPages,
  sortBy,
  onRefresh,
  onToggleSort,
  onGoToPage,
  onPageSizeChange,
}: CallHistoryTableProps) {
  const navigate = useNavigate();

  const startItem = totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalCount);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="gap-1"><CheckCircle className="h-3 w-3" /> Analyzed</Badge>;
      case 'processing':
        return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" /> Processing</Badge>;
      case 'error':
        return <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" /> Error</Badge>;
      default:
        return <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" /> Pending</Badge>;
    }
  };

  const getCallTypeDisplay = (t: CallTranscriptWithHeat) => {
    if (t.call_type === 'other' && t.call_type_other) {
      return t.call_type_other;
    }
    if (t.call_type) {
      return callTypeLabels[t.call_type as CallType] || t.call_type;
    }
    return '-';
  };

  const getHeatBadge = (heatScore: number | null) => {
    if (heatScore === null) return <span className="text-muted-foreground">-</span>;
    
    return (
      <Badge 
        variant="outline" 
        className={cn(
          "gap-1",
          heatScore >= 7 && "border-orange-500 text-orange-600 dark:border-orange-400 dark:text-orange-400",
          heatScore >= 4 && heatScore < 7 && "border-yellow-500 text-yellow-600 dark:border-yellow-400 dark:text-yellow-400",
          heatScore < 4 && "border-blue-500 text-blue-600 dark:border-blue-400 dark:text-blue-400"
        )}
      >
        <Flame className="h-3 w-3" />
        {heatScore}/10
      </Badge>
    );
  };

  const formatCurrency = (value: number | null) => {
    if (value === null || value === undefined) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">
            {isLoading ? 'Loading...' : `${totalCount} Call${totalCount !== 1 ? 's' : ''}`}
          </CardTitle>
        </div>
        <CardDescription>
          Click on a call to view detailed analysis
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <>
            <div className="md:hidden">
              <ListSkeleton count={5} />
            </div>
            <div className="hidden md:block">
              <TableSkeleton rows={8} columns={8} />
            </div>
          </>
        ) : transcripts.length === 0 ? (
          <div className="text-center py-12">
            <div className="mx-auto mb-4 rounded-full bg-muted p-4 w-fit">
              <History className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
            </div>
            <h3 className="text-lg font-semibold">No calls found</h3>
            <p className="text-muted-foreground mt-2 mb-4 max-w-sm mx-auto">
              {hasActiveFilters
                ? 'Try adjusting your filters or search terms to find what you\'re looking for.'
                : 'Submit your first call transcript to get AI-powered coaching and insights.'}
            </p>
            {!hasActiveFilters && (
              <Button onClick={() => navigate('/rep')}>
                <Mic className="h-4 w-4 mr-2" />
                Submit a Call
              </Button>
            )}
          </div>
        ) : (
          <>
            {/* Mobile Card View with Pull-to-Refresh */}
            <PullToRefresh onRefresh={onRefresh} className="md:hidden">
              <div className="space-y-3">
                {transcripts.map((t) => (
                  <MobileCallCard
                    key={t.id}
                    call={t}
                    onClick={() => navigate(`/calls/${t.id}`)}
                  />
                ))}
              </div>
            </PullToRefresh>

            {/* Desktop Table View */}
            <div className="hidden md:block rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => onToggleSort('call_date')}
                    >
                      <div className="flex items-center gap-1">
                        Date
                        <ArrowUpDown className="h-3 w-3" />
                      </div>
                    </TableHead>
                    <TableHead>Stakeholder</TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => onToggleSort('account_name')}
                    >
                      <div className="flex items-center gap-1">
                        Account
                        <ArrowUpDown className="h-3 w-3" />
                      </div>
                    </TableHead>
                    <TableHead>Call Type</TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => onToggleSort('heat_score')}
                    >
                      <div className="flex items-center gap-1">
                        <Flame className="h-3 w-3" />
                        Heat
                        <ArrowUpDown className="h-3 w-3" />
                      </div>
                    </TableHead>
                    <TableHead>Revenue</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transcripts.map((t) => (
                    <TableRow 
                      key={t.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/calls/${t.id}`)}
                    >
                      <TableCell className="font-medium">
                        {format(new Date(t.call_date), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell>{t.primary_stakeholder_name || '-'}</TableCell>
                      <TableCell>{t.account_name || '-'}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{getCallTypeDisplay(t)}</Badge>
                      </TableCell>
                      <TableCell>{getHeatBadge(t.heat_score)}</TableCell>
                      <TableCell>{formatCurrency(t.potential_revenue)}</TableCell>
                      <TableCell>{getStatusBadge(t.analysis_status)}</TableCell>
                      <TableCell>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4 pt-4 border-t">
                <div className="text-sm text-muted-foreground">
                  Showing {startItem} to {endItem} of {totalCount} call{totalCount !== 1 ? 's' : ''}
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Per page:</span>
                    <Select 
                      value={String(pageSize)} 
                      onValueChange={(v) => onPageSizeChange(parseInt(v, 10))}
                    >
                      <SelectTrigger className="w-[70px] h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PAGE_SIZE_OPTIONS.map((size) => (
                          <SelectItem key={size} value={String(size)}>
                            {size}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => onGoToPage(1)}
                      disabled={currentPage === 1}
                    >
                      <ChevronsLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => onGoToPage(currentPage - 1)}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    
                    <span className="text-sm px-2">
                      Page {currentPage} of {totalPages}
                    </span>
                    
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => onGoToPage(currentPage + 1)}
                      disabled={currentPage === totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => onGoToPage(totalPages)}
                      disabled={currentPage === totalPages}
                    >
                      <ChevronsRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
