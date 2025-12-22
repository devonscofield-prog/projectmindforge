import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
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
  RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
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
  }>;
  roleplay_transcripts: Array<{
    id: string;
    transcript_json: Json | null;
    raw_text: string | null;
  }>;
}

const gradeColors: Record<string, string> = {
  'A+': 'bg-green-500 text-white',
  'A': 'bg-green-500 text-white',
  'B': 'bg-blue-500 text-white',
  'C': 'bg-amber-500 text-white',
  'D': 'bg-orange-500 text-white',
  'F': 'bg-red-500 text-white',
};

const scoreCategories = [
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
            graded_at
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
      return data as Session;
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <Skeleton className="h-8 w-48 mb-6" />
          <Skeleton className="h-64 w-full mb-6" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (error || !session) {
    return (
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
    );
  }

  const grade = session.roleplay_grades?.[0];
  const transcript = session.roleplay_transcripts?.[0];
  const transcriptEntries: TranscriptEntry[] = transcript?.transcript_json 
    ? (transcript.transcript_json as unknown as TranscriptEntry[])
    : [];
  const scores = grade?.scores as Record<string, number> | undefined;
  const feedback = grade?.feedback as Record<string, string> | undefined;
  const focusAreas = grade?.focus_areas as string[] | undefined;

  return (
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

        {/* Scores */}
        {scores && (
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
                        {feedback?.[key] && (
                          <p className="text-xs text-muted-foreground line-clamp-1">{feedback[key]}</p>
                        )}
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

        {/* Focus Areas & Coaching */}
        {(focusAreas?.length || grade?.coaching_prescription) && (
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

        {/* No Grade Yet */}
        {!grade && session.status === 'completed' && (
          <Card className="border-dashed">
            <CardContent className="py-8 text-center">
              <Clock className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="font-medium">Grading in Progress</p>
              <p className="text-sm text-muted-foreground">
                Your session is being evaluated. Check back shortly.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
