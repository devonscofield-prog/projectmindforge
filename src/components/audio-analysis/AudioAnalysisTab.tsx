import { useState, useCallback, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, Headphones } from 'lucide-react';
import { useAudioAnalysis, useAudioSignedUrl } from '@/hooks/sdr/audioHooks';
import { AudioPlayer } from './AudioPlayer';
import { AudioMetricsDashboard } from './AudioMetricsDashboard';
import { AudioCoachingCard } from '@/components/calls/coaching/AudioCoachingCard';
import { EnergySentimentArc } from './EnergySentimentArc';
import { SilenceGapVisualization } from './SilenceGapVisualization';
import type { AudioCoachingData, AudioMetricsData } from '@/types/audioAnalysis';

interface AudioAnalysisTabProps {
  transcriptId: string;
  audioFilePath: string | null;
  pipeline: 'full_cycle' | 'sdr';
  callDurationSeconds?: number;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function AudioAnalysisTab({
  transcriptId,
  audioFilePath,
  pipeline: _pipeline,
  callDurationSeconds,
}: AudioAnalysisTabProps) {
  const { data: voiceData, isLoading, isError, error } = useAudioAnalysis(transcriptId);
  const { data: signedUrl } = useAudioSignedUrl(audioFilePath);

  const [currentTime, setCurrentTime] = useState(0);
  const lastTimeUpdateRef = useRef(0);

  const handleTimestampClick = useCallback((seconds: number) => {
    setCurrentTime(seconds);
  }, []);

  // Throttle time updates to ~1/sec to avoid ~4 re-renders/sec from timeupdate events
  const handleTimeUpdate = useCallback((seconds: number) => {
    const now = Date.now();
    if (now - lastTimeUpdateRef.current > 1000) {
      lastTimeUpdateRef.current = now;
      setCurrentTime(seconds);
    }
  }, []);

  const effectiveDuration = callDurationSeconds ?? voiceData?.audio_duration_sec ?? 0;
  const metrics: AudioMetricsData | null = voiceData?.metrics ?? null;
  const coaching: AudioCoachingData | null = voiceData?.coaching ?? null;

  // Show processing states
  const isProcessing = voiceData?.processing_stage &&
    voiceData.processing_stage !== 'complete' &&
    voiceData.processing_stage !== 'error';

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-[160px]" />
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-[140px]" />
          <Skeleton className="h-[140px]" />
        </div>
        <Skeleton className="h-[300px]" />
        <Skeleton className="h-[120px]" />
      </div>
    );
  }

  // Error state
  if (isError) {
    return (
      <Card className="border-destructive">
        <CardContent className="py-8">
          <div className="flex items-center gap-3 text-destructive">
            <AlertTriangle className="h-8 w-8" />
            <div>
              <h3 className="font-semibold text-lg">Voice Analysis Error</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {(error as Error)?.message || 'Failed to load voice analysis data.'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Processing state
  if (isProcessing) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Headphones className="h-10 w-10 text-primary mx-auto mb-3 animate-pulse" />
          <h3 className="font-semibold text-lg">Voice Analysis in Progress</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Currently {voiceData?.processing_stage?.replace(/_/g, ' ')}. This page will update automatically.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Voice analysis error (from the pipeline itself)
  if (voiceData?.processing_stage === 'error') {
    return (
      <Card className="border-destructive">
        <CardContent className="py-8">
          <div className="flex items-center gap-3 text-destructive">
            <AlertTriangle className="h-8 w-8" />
            <div>
              <h3 className="font-semibold text-lg">Voice Analysis Failed</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {voiceData.error_message || 'An error occurred during voice analysis.'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Empty state — no voice data at all
  if (!voiceData || (!metrics && !coaching)) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Headphones className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <h3 className="font-semibold text-lg">Voice Analysis Not Available</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Voice analysis data is not available for this call. Upload an audio recording to enable voice insights.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Voice Coaching Card (Phase 4 component) */}
      <AudioCoachingCard
        data={coaching}
        isLoading={false}
        defaultOpen
        onSeekTo={signedUrl ? handleTimestampClick : undefined}
      />

      {/* Metrics Dashboard (Phase 4 component — includes WPM, Talk/Listen, Filler Words) */}
      <AudioMetricsDashboard
        data={metrics}
        callDurationSeconds={effectiveDuration}
        onTimestampClick={signedUrl ? handleTimestampClick : undefined}
        isLoading={false}
      />

      {/* Energy & Sentiment Arc */}
      {metrics && metrics.energy_sentiment_arc.length > 0 && (
        <EnergySentimentArc
          data={metrics.energy_sentiment_arc}
          callDurationSeconds={effectiveDuration}
          onTimestampClick={signedUrl ? handleTimestampClick : undefined}
        />
      )}

      {/* Silence Gap Visualization */}
      {metrics && metrics.silence_gaps.length > 0 && (
        <SilenceGapVisualization
          gaps={metrics.silence_gaps}
          callDurationSeconds={effectiveDuration}
          onTimestampClick={signedUrl ? handleTimestampClick : undefined}
        />
      )}

      {/* Audio Player — sticky bottom */}
      {signedUrl && (
        <AudioPlayer
          audioUrl={signedUrl}
          duration={effectiveDuration}
          currentTime={currentTime}
          onTimeUpdate={handleTimeUpdate}
          compact
        />
      )}
    </div>
  );
}
