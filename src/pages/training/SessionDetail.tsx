import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { 
  ArrowLeft, 
  Clock, 
  Calendar,
  Bot,
  User,
  Star,
  Target,
  MessageSquare,
  Lightbulb,
  AlertCircle,
  RefreshCw,
  Lock,
  RotateCcw,
  Loader2,
  Sparkles,
  Play
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { KeyMomentsSection } from '@/components/training/KeyMomentsSection';
import { AppLayout } from '@/components/layout/AppLayout';
import { gradeColors } from '@/constants/training';
import type { Json } from '@/integrations/supabase/types';

interface TranscriptEntry {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: number;
}

interface Session {
  id: string;
  persona_id: string;
  session_type: string;
  status: string;
  started_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  created_at: string;
  audio_recording_url: string | null;
  roleplay_personas: {
    id: string;
    name: string;
    persona_type: string;
    difficulty_level: string;
    disc_profile: string | null;
    industry: string | null;
  } | null;
  roleplay_grades: Array<{
    id: string;
    overall_grade: string | null;
    scores: Json;
    feedback: Json | null;
    focus_areas: Json | null;
    coaching_prescription: string | null;
    graded_at: string | null;
    feedback_visibility: string | null;
  }>;
  roleplay_transcripts: Array<{
    id: string;
    transcript_json: Json | null;
    raw_text: string | null;
  }>;
}

// Default score categories (used when persona doesn't have custom criteria)
const defaultScoreCategories = [
  { key: 'discovery', label: 'Discovery Skills', icon: Target },
  { key: 'objection_handling', label: 'Objection Handling', icon: MessageSquare },
  { key: 'rapport', label: 'Rapport Building', icon: User },
  { key: 'closing', label: 'Closing Ability', icon: Star },
  { key: 'persona_adaptation', label: 'Persona Adaptation', icon: Bot },
];

export default function SessionDetail() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: userRole } = useUserRole(user?.id);
  const queryClient = useQueryClient();
  const [isRetrying, setIsRetrying] = useState(false);

  const { data: session, isLoading, error } = useQuery({
    queryKey: ['session-detail', sessionId],
    queryFn: async () => {
      if (!sessionId) throw new Error('No session ID');
      
      const { data, error } = await supabase
        .from('roleplay_sessions')
        .select(`
          *,
          roleplay_personas (
            id,
            name,
            persona_type,
            difficulty_level,
            disc_profile,
            industry
          ),
          roleplay_grades (
            id,
            overall_grade,
            scores,
            feedback,
            focus_areas,
            coaching_prescription,
            graded_at,
            feedback_visibility
          ),
          roleplay_transcripts (
            id,
            transcript_json,
            raw_text
          )
        `)
        .eq('id', sessionId)
        .single();
      
      if (error) throw error;
      return data as unknown as Session;
    },
    enabled: !!sessionId && !!user?.id,
  });

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '-';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-blue-500';
    if (score >= 40) return 'text-amber-500';
    return 'text-red-500';
  };

  // Determine if user can see full feedback
  const canViewFullFeedback = (feedbackVisibility: string | null): boolean => {
    // Managers and admins can always see everything
    if (userRole === 'admin' || userRole === 'manager') {
      return true;
    }
    // Reps can only see full feedback if visibility is 'full'
    return feedbackVisibility !== 'restricted';
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="min-h-screen bg-background">
          <div className="container mx-auto px-4 py-8 max-w-4xl">
            <Skeleton className="h-8 w-48 mb-6" />
            <Skeleton className="h-64 w-full mb-6" />
            <Skeleton className="h-96 w-full" />
          </div>
        </div>
      </AppLayout>
    );
  }

  if (error || !session) {
    return (
      <AppLayout>
        <div className="min-h-screen bg-background flex items-center justify-center">
          <Card className="p-8 text-center max-w-md">
            <AlertCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
            <h2 className="text-xl font-semibold mb-2">Session Not Found</h2>
            <p className="text-muted-foreground mb-4">
              This session doesn't exist or you don't have access to it.
            </p>
            <Button onClick={() => navigate('/training/history')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to History
            </Button>
          </Card>
        </div>
      </AppLayout>
    );
  }

  const grade = session.roleplay_grades?.[0];
  const transcript = session.roleplay_transcripts?.[0];
  const transcriptEntries: TranscriptEntry[] = transcript?.transcript_json 
    ? (transcript.transcript_json as unknown as TranscriptEntry[])
    : [];
  const scores = grade?.scores as Record<string, number> | undefined;
  const feedback = grade?.feedback as Record<string, unknown> | undefined;
  const focusAreas = grade?.focus_areas as string[] | undefined;
  const keyMoments = Array.isArray(feedback?.key_moments) 
    ? feedback.key_moments as Array<{ moment: string; assessment: string; suggestion: string }>
    : [];
  
  const showFullFeedback = canViewFullFeedback(grade?.feedback_visibility ?? null);
  const canRetryGrade = (userRole === 'admin' || userRole === 'manager') && 
    session.status === 'completed' && !grade;

  // Retry grading handler
  const handleRetryGrade = async () => {
    if (!sessionId) return;
    setIsRetrying(true);
    try {
      const { error } = await supabase.functions.invoke('roleplay-grade-session', {
        body: { sessionId }
      });
      if (error) throw error;
      toast.success('Grading started. Please wait a moment and refresh.');
      // Refetch after a delay
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['session-detail', sessionId] });
      }, 5000);
    } catch (err) {
      console.error('Retry grading error:', err);
      toast.error('Failed to retry grading');
    } finally {
      setIsRetrying(false);
    }
  };

  // Build score categories from the scores object (supports custom criteria)
  const scoreCategories = scores 
    ? Object.keys(scores)
        .filter(key => key !== 'overall')
        .map(key => {
          // Try to find a matching default category for the icon
          const defaultCat = defaultScoreCategories.find(dc => dc.key === key);
          return {
            key,
            label: defaultCat?.label || key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
            icon: defaultCat?.icon || Target,
          };
        })
    : defaultScoreCategories;

  return (
    <AppLayout>
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" onClick={() => navigate('/training/history')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">Session Details</h1>
            <p className="text-muted-foreground">
              {session.roleplay_personas?.name || 'Unknown Persona'}
            </p>
          </div>
          {session.status === 'completed' && (
            <div className="flex items-center gap-2">
              {/* Discuss with Sales Coach Button */}
              {showFullFeedback && grade?.coaching_prescription && (
                <Button 
                  variant="secondary"
                  onClick={() => {
                    const contextMessage = `I just completed a roleplay training session with ${session.roleplay_personas?.name || 'an AI persona'}. Here's my coaching feedback: "${grade.coaching_prescription}". ${focusAreas?.length ? `Focus areas identified: ${focusAreas.join(', ')}.` : ''} Can you help me practice and improve on this?`;
                    navigate(`/training?coachContext=${encodeURIComponent(contextMessage)}`);
                    toast.info('Opening Sales Coach with your roleplay feedback...');
                  }}
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Discuss with Coach
                </Button>
              )}
              
              {session.roleplay_personas && (
                <Button 
                  variant="outline"
                  onClick={() => navigate(`/training/roleplay/${session.persona_id}`)}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Practice Again
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Session Overview */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center">
                  <Bot className="h-6 w-6 text-muted-foreground" />
                </div>
                <div>
                  <CardTitle>{session.roleplay_personas?.name || 'Unknown'}</CardTitle>
                  <CardDescription className="capitalize">
                    {session.roleplay_personas?.persona_type?.replace('_', ' ')} • {session.roleplay_personas?.industry || 'General'}
                  </CardDescription>
                </div>
              </div>
              {grade?.overall_grade && (
                <Badge 
                  className={cn(
                    "text-lg px-4 py-2 font-bold",
                    gradeColors[grade.overall_grade] || 'bg-secondary'
                  )}
                >
                  <Star className="h-4 w-4 mr-1" />
                  {grade.overall_grade}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Date</p>
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">
                    {format(new Date(session.created_at), 'MMM d, yyyy')}
                  </span>
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Duration</p>
                <div className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{formatDuration(session.duration_seconds)}</span>
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Difficulty</p>
                <Badge variant="secondary" className="capitalize mt-1">
                  {session.roleplay_personas?.difficulty_level || 'medium'}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <Badge variant="outline" className="capitalize mt-1">
                  {session.status.replace('_', ' ')}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Restricted Feedback Message for Reps */}
        {grade && !showFullFeedback && (
          <Card className="mb-6 border-amber-500/50 bg-amber-500/5">
            <CardContent className="py-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
                  <Lock className="h-6 w-6 text-amber-500" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-1">Keep Practicing</h3>
                  <p className="text-muted-foreground">
                    Your detailed feedback is available after you achieve a higher score. 
                    Focus on active listening, asking open-ended questions, and uncovering 
                    the prospect's true challenges. Try again to unlock your coaching insights.
                  </p>
                  <Button 
                    className="mt-4"
                    onClick={() => navigate(`/training/roleplay/${session.persona_id}`)}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Practice Again
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Scores - Always show if available */}
        {scores && showFullFeedback && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Performance Scores
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {scoreCategories.map(({ key, label, icon: Icon }) => {
                  const score = scores[key];
                  if (score === undefined) return null;
                  return (
                    <div key={key} className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50">
                      <Icon className="h-5 w-5 text-muted-foreground" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">{label}</p>
                      </div>
                      <span className={cn("text-xl font-bold", getScoreColor(score))}>
                        {score}
                      </span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Focus Areas & Coaching - Only show for full visibility */}
        {showFullFeedback && (focusAreas?.length || grade?.coaching_prescription) && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5" />
                Coaching Recommendations
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {focusAreas && focusAreas.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Focus Areas</p>
                  <div className="flex flex-wrap gap-2">
                    {focusAreas.map((area, idx) => (
                      <Badge key={idx} variant="outline">{area}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {grade?.coaching_prescription && (
                <div>
                  <p className="text-sm font-medium mb-2">Coaching Prescription</p>
                  <p className="text-sm text-muted-foreground bg-secondary/50 p-3 rounded-lg">
                    {grade.coaching_prescription}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Key Moments - Only show for full visibility */}
        {showFullFeedback && keyMoments.length > 0 && (
          <KeyMomentsSection keyMoments={keyMoments} />
        )}

        {/* Detailed Feedback - Only show for full visibility */}
        {showFullFeedback && feedback && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Detailed Feedback
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Strengths */}
              {Array.isArray(feedback.strengths) && feedback.strengths.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-green-600 mb-2">Strengths</p>
                  <ul className="space-y-1">
                    {feedback.strengths.map((strength, idx) => (
                      <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                        <span className="text-green-500 mt-1">✓</span>
                        {String(strength)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {/* Improvements */}
              {Array.isArray(feedback.improvements) && feedback.improvements.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-amber-600 mb-2">Areas for Improvement</p>
                  <ul className="space-y-1">
                    {feedback.improvements.map((improvement, idx) => (
                      <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                        <span className="text-amber-500 mt-1">→</span>
                        {String(improvement)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {/* Missed Opportunities */}
              {Array.isArray(feedback.missed_opportunities) && feedback.missed_opportunities.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-red-600 mb-2">Missed Opportunities</p>
                  <ul className="space-y-1">
                    {feedback.missed_opportunities.map((missed, idx) => (
                      <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                        <span className="text-red-500 mt-1">✗</span>
                        {String(missed)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {/* Persona-specific feedback */}
              {typeof feedback.persona_specific === 'string' && feedback.persona_specific && (
                <div>
                  <p className="text-sm font-medium mb-2">Persona Adaptation</p>
                  <p className="text-sm text-muted-foreground bg-secondary/50 p-3 rounded-lg">
                    {feedback.persona_specific}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Audio Recording Playback */}
        {session.audio_recording_url && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Play className="h-5 w-5" />
                Session Recording
              </CardTitle>
            </CardHeader>
            <CardContent>
              <audio controls className="w-full" src={session.audio_recording_url}>
                Your browser does not support audio playback.
              </audio>
            </CardContent>
          </Card>
        )}

        {/* Transcript */}
        {transcriptEntries.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Conversation Transcript
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 max-h-[500px] overflow-y-auto">
                {transcriptEntries.map((entry, idx) => (
                  <div 
                    key={idx}
                    className={cn(
                      "flex gap-3",
                      entry.role === 'user' ? 'flex-row-reverse' : ''
                    )}
                  >
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                      entry.role === 'user' ? 'bg-primary' : 'bg-secondary'
                    )}>
                      {entry.role === 'user' ? (
                        <User className="h-4 w-4 text-primary-foreground" />
                      ) : (
                        <Bot className="h-4 w-4" />
                      )}
                    </div>
                    <div className={cn(
                      "rounded-lg px-4 py-2 max-w-[80%]",
                      entry.role === 'user' 
                        ? 'bg-primary text-primary-foreground' 
                        : 'bg-secondary'
                    )}>
                      <p className="text-sm">{entry.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Non-completed session message */}
        {(session.status === 'abandoned' || session.status === 'pending') && (
          <Card className="border-dashed border-muted-foreground/30">
            <CardContent className="py-8 text-center">
              <AlertCircle className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="font-medium">Session Not Completed</p>
              <p className="text-sm text-muted-foreground mb-4">
                This session was {session.status === 'abandoned' ? 'ended early or timed out' : 'never started'}. No feedback is available.
              </p>
              {session.roleplay_personas && (
                <Button onClick={() => navigate(`/training/roleplay/${session.persona_id}`)}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try Again
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* No Grade Yet */}
        {!grade && session.status === 'completed' && (
          <Card className="border-dashed">
            <CardContent className="py-8 text-center">
              <Clock className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="font-medium">Grading in Progress</p>
              <p className="text-sm text-muted-foreground mb-4">
                Your session is being evaluated. Check back shortly.
              </p>
              {canRetryGrade && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRetryGrade}
                  disabled={isRetrying}
                >
                  {isRetrying ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Grading...
                    </>
                  ) : (
                    <>
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Retry Grading
                    </>
                  )}
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
    </AppLayout>
  );
}
