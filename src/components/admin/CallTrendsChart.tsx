import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { subDays, format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';

const log = createLogger('CallTrendsChart');

interface DailyCount {
  date: string;
  count: number;
}

export function CallTrendsChart() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['call-trends', '30-days'],
    queryFn: async () => {
      const thirtyDaysAgo = subDays(new Date(), 30).toISOString();

      const { data: calls, error: fetchError } = await supabase
        .from('call_transcripts')
        .select('created_at')
        .eq('analysis_status', 'completed')
        .gte('created_at', thirtyDaysAgo)
        .order('created_at', { ascending: true });

      if (fetchError) {
        throw fetchError;
      }

      // Group by date
      const countsByDate = new Map<string, number>();
      
      // Initialize all dates in range with 0
      for (let i = 29; i >= 0; i--) {
        const date = format(subDays(new Date(), i), 'MMM d');
        countsByDate.set(date, 0);
      }

      // Count calls per date
      calls?.forEach((call) => {
        const date = format(new Date(call.created_at), 'MMM d');
        countsByDate.set(date, (countsByDate.get(date) || 0) + 1);
      });

      // Convert to array
      const chartData: DailyCount[] = Array.from(countsByDate.entries()).map(([date, count]) => ({
        date,
        count,
      }));

      return chartData;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - trends data doesn't change frequently
  });

  // Re-throw error for error boundary to catch
  if (error) {
    throw error;
  }

  if (isLoading || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Call Analysis Trends (30 days)</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[200px] w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Call Analysis Trends (30 days)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorCalls" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
                className="text-muted-foreground"
              />
              <YAxis 
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
                className="text-muted-foreground"
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '12px'
                }}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
              />
              <Area
                type="monotone"
                dataKey="count"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                fill="url(#colorCalls)"
                name="Calls Analyzed"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
