import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { AudioMetricsData } from '@/types/audioAnalysis';
import { WPMTimelineChart } from './WPMTimelineChart';
import { FillerWordChart } from './FillerWordChart';
import { AudioTalkListenRatio } from './AudioTalkListenRatio';

interface AudioMetricsDashboardProps {
  data: AudioMetricsData | null | undefined;
  callDurationSeconds: number;
  onTimestampClick?: (seconds: number) => void;
  isLoading?: boolean;
  className?: string;
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      {/* WPM Timeline skeleton (full width) */}
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[250px] w-full" />
        </CardContent>
      </Card>

      {/* Bottom row skeleton (2-column) */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <Skeleton className="h-5 w-36" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-8 w-full rounded-full" />
            <Skeleton className="h-2 w-full rounded-full" />
            <div className="flex justify-between">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-16" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[200px] w-full" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function AudioMetricsDashboard({
  data,
  callDurationSeconds,
  onTimestampClick,
  isLoading,
  className,
}: AudioMetricsDashboardProps) {
  // Loading state
  if (isLoading || !data) {
    return (
      <div className={cn(className)}>
        <DashboardSkeleton />
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Full-width WPM Timeline */}
      <WPMTimelineChart
        data={data.wpm_timeline}
        speakers={data.speakers}
        callDurationSeconds={callDurationSeconds}
        onTimestampClick={onTimestampClick}
      />

      {/* Two-column grid: Talk/Listen Ratio | Filler Words */}
      <div className="grid gap-4 md:grid-cols-2">
        <AudioTalkListenRatio data={data.talk_listen_ratio} />
        <FillerWordChart data={data.filler_words} />
      </div>
    </div>
  );
}
