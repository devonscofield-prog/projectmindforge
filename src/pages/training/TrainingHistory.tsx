import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  ArrowLeft, 
  Clock, 
  Calendar,
  CheckCircle,
  XCircle,
  PlayCircle,
  Bot,
  Star
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

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
    name: string;
    persona_type: string;
    difficulty_level: string;
  } | null;
  roleplay_grades: Array<{
    overall_grade: string | null;
    graded_at: string;
  }>;
}

const statusIcons: Record<string, React.ReactNode> = {
  completed: <CheckCircle className="h-4 w-4 text-green-500" />,
  abandoned: <XCircle className="h-4 w-4 text-red-500" />,
  in_progress: <PlayCircle className="h-4 w-4 text-amber-500" />,
  pending: <Clock className="h-4 w-4 text-muted-foreground" />,
};

const gradeColors: Record<string, string> = {
  'A+': 'bg-green-500 text-white',
  'A': 'bg-green-500 text-white',
  'B': 'bg-blue-500 text-white',
  'C': 'bg-amber-500 text-white',
  'D': 'bg-orange-500 text-white',
  'F': 'bg-red-500 text-white',
};

export default function TrainingHistory() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: sessions, isLoading } = useQuery({
    queryKey: ['training-history', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('roleplay_sessions')
        .select(`
          *,
          roleplay_personas (
            name,
            persona_type,
            difficulty_level
          ),
          roleplay_grades (
            overall_grade,
            graded_at
          )
        `)
        .eq('trainee_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data as Session[];
    },
    enabled: !!user?.id,
  });

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '-';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" onClick={() => navigate('/training')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Training History</h1>
            <p className="text-muted-foreground">Review your past practice sessions</p>
          </div>
        </div>

        {/* Sessions List */}
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <Skeleton className="h-16 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : sessions && sessions.length > 0 ? (
          <div className="space-y-4">
            {sessions.map((session) => (
              <Card 
                key={session.id} 
                className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => navigate(`/training/session/${session.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                        <Bot className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <h3 className="font-medium">
                          {session.roleplay_personas?.name || 'Unknown Persona'}
                        </h3>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          <span>
                            {format(new Date(session.created_at), 'MMM d, yyyy h:mm a')}
                          </span>
                          <span>•</span>
                          <Clock className="h-3 w-3" />
                          <span>{formatDuration(session.duration_seconds)}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      {/* Grade Badge */}
                      {session.roleplay_grades?.[0]?.overall_grade && (
                        <Badge 
                          className={cn(
                            "font-bold",
                            gradeColors[session.roleplay_grades[0].overall_grade] || 'bg-secondary'
                          )}
                        >
                          <Star className="h-3 w-3 mr-1" />
                          {session.roleplay_grades[0].overall_grade}
                        </Badge>
                      )}
                      
                      {/* Status Badge */}
                      <Badge variant="outline" className="flex items-center gap-1.5 capitalize">
                        {statusIcons[session.status] || statusIcons.pending}
                        {session.status.replace('_', ' ')}
                      </Badge>
                      
                      {/* Difficulty */}
                      <Badge variant="secondary" className="capitalize">
                        {session.roleplay_personas?.difficulty_level || 'medium'}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-8 text-center">
            <PlayCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Sessions Yet</h3>
            <p className="text-muted-foreground mb-4">
              Start your first practice session to see your history here.
            </p>
            <Button onClick={() => navigate('/training')}>
              Start Practicing
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
}
