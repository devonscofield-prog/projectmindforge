import { useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Star,
  Clock,
  ArrowRight,
  RefreshCw,
  Check,
  TrendingUp,
  AlertCircle,
  Loader2,
  RotateCcw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Json } from '@/integrations/supabase/types';
import { gradeColors } from '@/constants/training';

// Maximum number of poll attempts before showing timeout (30 * 2s = 60 seconds)
const MAX_POLL_ATTEMPTS = 30;

interface RoleplayPostSessionProps {
  sessionId: string;
  durationSeconds: number;
  personaName: string;
  onViewDetails: () => void;
  onNewSession: () => void;
  onBackToTraining: () => void;
}

interface GradeData {
  id: string;
  overall_grade: string | null;
  scores: Json;
  feedback: Json | null;
  focus_areas: Json | null;
  coaching_prescription: string | null;
  feedback_visibility: string | null;
}

export function RoleplayPostSession({
  sessionId,
  durationSeconds,
  personaName,
  onViewDetails,
  onNewSession,
  onBackToTraining,
}: RoleplayPostSessionProps) {
  const queryClient = useQueryClient();
  const pollCountRef = useRef(0);

  // Poll for grade with refetch interval and timeout
  const { data: grade, isLoading } = useQuery({
    queryKey: ['roleplay-grade', sessionId],
    queryFn: async () => {
      pollCountRef.current += 1;
      const { data, error } = await supabase
        .from('roleplay_grades')
        .select('id, overall_grade, scores, feedback, focus_areas, coaching_prescription, feedback_visibility')
        .eq('session_id', sessionId)
        .maybeSingle();

      if (error) throw error;
      return data as GradeData | null;
    },
    refetchInterval: (query) => {
      // Stop polling once we have a grade
      if (query.state.data?.overall_grade) return false;
      // Stop polling after max attempts
      if (pollCountRef.current >= MAX_POLL_ATTEMPTS) return false;
      return 2000; // Poll every 2 seconds
    },
    enabled: !!sessionId,
  });

  const gradingTimedOut = !grade?.overall_grade && pollCountRef.current >= MAX_POLL_ATTEMPTS;

  const retryGradingPoll = () => {
    pollCountRef.current = 0;
    queryClient.invalidateQueries({ queryKey: ['roleplay-grade', sessionId] });
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  // scores available via grade?.scores
  const feedback = grade?.feedback as Record<string, unknown> | undefined;
  const focusAreas = grade?.focus_areas as string[] | undefined;
  const strengths = Array.isArray(feedback?.strengths) ? feedback.strengths.slice(0, 2) : [];
  const improvements = Array.isArray(feedback?.improvements) ? feedback.improvements.slice(0, 2) : [];
  const showFullFeedback = grade?.feedback_visibility !== 'restricted';

  return (
    <div className="space-y-6">
      {/* Success Header */}
      <div className="text-center">
        <div className="w-20 h-20 mx-auto rounded-full bg-green-500/20 flex items-center justify-center mb-4">
          <Check className="h-10 w-10 text-green-500" />
        </div>
        <h2 className="text-2xl font-bold">Session Complete!</h2>
        <p className="text-muted-foreground mt-1">
          Great job practicing with {personaName}
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <Clock className="h-5 w-5 mx-auto text-muted-foreground mb-2" />
            <p className="text-2xl font-bold">{formatDuration(durationSeconds)}</p>
            <p className="text-sm text-muted-foreground">Duration</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            {grade?.overall_grade ? (
              <>
                <Star className="h-5 w-5 mx-auto text-primary mb-2" />
                <Badge
                  className={cn(
                    "text-xl px-4 py-1 font-bold",
                    gradeColors[grade.overall_grade] || 'bg-secondary'
                  )}
                >
                  {grade.overall_grade}
                </Badge>
                <p className="text-sm text-muted-foreground mt-1">Overall Grade</p>
              </>
            ) : gradingTimedOut ? (
              <>
                <AlertCircle className="h-5 w-5 mx-auto text-amber-500 mb-2" />
                <p className="text-sm font-medium text-muted-foreground">Grading is taking longer than expected</p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2 gap-1"
                  onClick={retryGradingPoll}
                >
                  <RotateCcw className="h-3 w-3" />
                  Check Again
                </Button>
              </>
            ) : (
              <>
                <Loader2 className="h-5 w-5 mx-auto text-muted-foreground mb-2 animate-spin" />
                <p className="text-lg font-medium text-muted-foreground">Grading...</p>
                <p className="text-sm text-muted-foreground">Please wait</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Feedback (only if grade available and not restricted) */}
      {grade?.overall_grade && showFullFeedback && (strengths.length > 0 || improvements.length > 0) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Quick Feedback</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Top Strength */}
            {strengths.length > 0 && (
              <div>
                <div className="flex items-center gap-2 text-sm font-medium text-green-600 mb-1">
                  <TrendingUp className="h-4 w-4" />
                  Top Strength
                </div>
                <p className="text-sm text-muted-foreground">{String(strengths[0])}</p>
              </div>
            )}
            
            {/* Area to Improve */}
            {improvements.length > 0 && (
              <div>
                <div className="flex items-center gap-2 text-sm font-medium text-amber-600 mb-1">
                  <AlertCircle className="h-4 w-4" />
                  Focus Area
                </div>
                <p className="text-sm text-muted-foreground">{String(improvements[0])}</p>
              </div>
            )}

            {/* Focus Areas Tags */}
            {focusAreas && focusAreas.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2 border-t">
                {focusAreas.map((area, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">
                    {area}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Restricted Feedback Message */}
      {grade?.overall_grade && !showFullFeedback && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="py-6 text-center">
            <p className="text-sm text-muted-foreground">
              Keep practicing to unlock detailed coaching feedback!
            </p>
          </CardContent>
        </Card>
      )}

      {/* Grading in Progress */}
      {isLoading && (
        <Card className="border-dashed">
          <CardContent className="py-6">
            <div className="flex items-center gap-3">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="flex-1">
                <Skeleton className="h-4 w-32 mb-2" />
                <Skeleton className="h-3 w-48" />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3 pt-4">
        <Button 
          variant="outline" 
          className="flex-1"
          onClick={onBackToTraining}
        >
          Back to Training
        </Button>
        <Button 
          variant="outline"
          className="flex-1 gap-2"
          onClick={onNewSession}
        >
          <RefreshCw className="h-4 w-4" />
          Practice Again
        </Button>
        <Button
          className="flex-1 gap-2"
          onClick={onViewDetails}
          disabled={!grade?.overall_grade && !gradingTimedOut}
        >
          {gradingTimedOut && !grade?.overall_grade ? 'View Session' : 'View Full Feedback'}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
