import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Phone, ArrowRight, User, Building2, Clock, Users } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { format } from 'date-fns';
import { useIsMobile } from '@/hooks/use-mobile';

interface RecentCall {
  id: string;
  call_date: string;
  account_name: string | null;
  call_type: string | null;
  analysis_status: string;
  rep_id: string;
  rep_name: string;
  team_name: string;
  manager_id?: string | null;
}

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  completed: { label: 'Analyzed', variant: 'default' },
  skipped: { label: 'Indexed', variant: 'secondary' },
  processing: { label: 'Processing', variant: 'outline' },
  pending: { label: 'Pending', variant: 'outline' },
  error: { label: 'Error', variant: 'destructive' },
};

const callTypeLabels: Record<string, string> = {
  first_demo: 'First Demo',
  follow_up_demo: 'Follow-up Demo',
  discovery: 'Discovery',
  negotiation: 'Negotiation',
  closing: 'Closing',
  other: 'Other',
};

export function AdminRecentCalls() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  const { data: calls, isLoading } = useQuery({
    queryKey: ['admin-recent-calls'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_admin_transcripts', {
        p_from_date: '2020-01-01',
        p_to_date: '2099-12-31',
        p_analysis_status: ['completed', 'skipped', 'processing', 'pending', 'error'],
        p_limit: 15,
        p_offset: 0,
      });

      if (error) throw error;
      return (data || []) as RecentCall[];
    },
    staleTime: 30 * 1000,
  });

  // Real-time subscription for new calls
  useEffect(() => {
    const channel = supabase
      .channel('admin-recent-calls')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'call_transcripts',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['admin-recent-calls'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const handleRowClick = (callId: string) => {
    navigate(`/calls/${callId}`);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Recent Calls
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 p-3 rounded-lg border">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-6 w-16" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!calls || calls.length === 0) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Recent Calls
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={() => navigate('/admin/transcripts')}>
            View All <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">No calls found</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Phone className="h-5 w-5" />
          Recent Calls
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin/transcripts')}>
          View All <ArrowRight className="ml-1 h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        {isMobile ? (
          // Mobile: Compact card list
          <div className="space-y-3">
            {calls.map((call) => {
              const status = statusConfig[call.analysis_status] || statusConfig.pending;
              return (
                <div
                  key={call.id}
                  onClick={() => handleRowClick(call.id)}
                  className="p-3 rounded-lg border bg-card hover:bg-accent/50 cursor-pointer transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="font-medium truncate">
                            {call.account_name || 'Unknown Account'}
                          </p>
                          {call.manager_id && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Users className="h-3 w-3 text-primary shrink-0" />
                                </TooltipTrigger>
                                <TooltipContent>Manager was on this call</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                          <User className="h-3 w-3 shrink-0" />
                          <span className="truncate">{call.rep_name}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3 shrink-0" />
                          <span>{format(new Date(call.call_date), 'MMM d, yyyy')}</span>
                          <span>•</span>
                          <span>{callTypeLabels[call.call_type || ''] || call.call_type || 'Unknown'}</span>
                      </div>
                    </div>
                    <Badge variant={status.variant} className="shrink-0">
                      {status.label}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          // Desktop: Table view
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b text-left text-sm text-muted-foreground">
                  <th className="pb-3 font-medium">Date</th>
                  <th className="pb-3 font-medium">Rep</th>
                  <th className="pb-3 font-medium">Account</th>
                  <th className="pb-3 font-medium">Type</th>
                  <th className="pb-3 font-medium text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {calls.map((call) => {
                  const status = statusConfig[call.analysis_status] || statusConfig.pending;
                  return (
                    <tr
                      key={call.id}
                      onClick={() => handleRowClick(call.id)}
                      className="border-b last:border-0 hover:bg-accent/50 cursor-pointer transition-colors"
                    >
                      <td className="py-3 text-sm">
                        <div className="flex items-center gap-2">
                          {format(new Date(call.call_date), 'MMM d, yyyy')}
                          {call.manager_id && (
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
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center">
                            <User className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">{call.rep_name}</p>
                            <p className="text-xs text-muted-foreground">{call.team_name}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm truncate max-w-[200px]">
                            {call.account_name || 'Unknown'}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 text-sm text-muted-foreground">
                        {callTypeLabels[call.call_type || ''] || call.call_type || 'Unknown'}
                      </td>
                      <td className="py-3 text-right">
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
