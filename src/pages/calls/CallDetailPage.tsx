import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { getCallWithAnalysis, getAnalysisForCall, CallAnalysis, CallTranscript } from '@/api/aiCallAnalysis';
import { CallAnalysisResultsView } from '@/components/calls/CallAnalysisResultsView';
import { format } from 'date-fns';
import { 
  ArrowLeft, 
  Calendar, 
  Loader2, 
  ShieldAlert,
  FileText,
  RefreshCw
} from 'lucide-react';

type CallSource = 'zoom' | 'teams' | 'dialer' | 'other';

const sourceLabels: Record<CallSource, string> = {
  zoom: 'Zoom',
  teams: 'Teams',
  dialer: 'Dialer',
  other: 'Other',
};

export default function CallDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const { toast } = useToast();

  const [transcript, setTranscript] = useState<CallTranscript | null>(null);
  const [analysis, setAnalysis] = useState<CallAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [notAuthorized, setNotAuthorized] = useState(false);
  const [isPolling, setIsPolling] = useState(false);

  const isOwner = transcript?.rep_id === user?.id;
  const isManager = role === 'manager' || role === 'admin';

  // Poll for analysis completion
  const pollForAnalysis = useCallback(async (callId: string) => {
    setIsPolling(true);
    let attempts = 0;
    const maxAttempts = 30;

    const poll = async () => {
      attempts++;
      try {
        const result = await getAnalysisForCall(callId);
        if (result) {
          setAnalysis(result);
          setIsPolling(false);
          toast({
            title: 'Analysis complete',
            description: 'Your call has been analyzed.',
          });
          return;
        }
      } catch (error) {
        console.error('Poll error:', error);
      }

      if (attempts < maxAttempts) {
        setTimeout(poll, 2000);
      } else {
        setIsPolling(false);
        toast({
          title: 'Analysis taking longer than expected',
          description: 'Please refresh the page in a moment.',
          variant: 'destructive',
        });
      }
    };

    poll();
  }, [toast]);

  useEffect(() => {
    async function loadCall() {
      if (!id || !user) return;

      setLoading(true);
      try {
        const result = await getCallWithAnalysis(id);
        
        if (!result) {
          toast({
            title: 'Call not found',
            description: 'The requested call could not be found.',
            variant: 'destructive',
          });
          navigate(-1);
          return;
        }

        // Role-based access check
        if (role === 'rep' && result.transcript.rep_id !== user.id) {
          setNotAuthorized(true);
          setLoading(false);
          return;
        }

        setTranscript(result.transcript);
        setAnalysis(result.analysis);

        // If analysis is still pending/processing, start polling
        if (!result.analysis && (result.transcript.analysis_status === 'pending' || result.transcript.analysis_status === 'processing')) {
          pollForAnalysis(id);
        }
      } catch (error) {
        console.error('Error loading call:', error);
        toast({
          title: 'Error',
          description: 'Failed to load call details.',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    }

    loadCall();
  }, [id, user, role, navigate, toast, pollForAnalysis]);

  const getBackPath = () => {
    if (role === 'manager') return '/manager/coaching';
    if (role === 'admin') return '/admin';
    return '/rep';
  };

  const handleRefresh = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const result = await getCallWithAnalysis(id);
      if (result) {
        setTranscript(result.transcript);
        setAnalysis(result.analysis);
      }
    } catch (error) {
      console.error('Error refreshing:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto" />
            <p className="text-muted-foreground">Loading call details...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (notAuthorized) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <ShieldAlert className="h-16 w-16 text-destructive" />
          <h1 className="text-2xl font-bold">Not Authorized</h1>
          <p className="text-muted-foreground">You are not authorized to view this call.</p>
          <Button onClick={() => navigate(getBackPath())}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </div>
      </AppLayout>
    );
  }

  if (!transcript) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <h1 className="text-2xl font-bold">Call Not Found</h1>
          <Button onClick={() => navigate(getBackPath())}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(getBackPath())}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">
                {transcript.notes || 'Call Details'}
              </h1>
              <p className="text-muted-foreground">
                Full AI coaching breakdown for this call
              </p>
            </div>
          </div>
          {(transcript.analysis_status === 'pending' || transcript.analysis_status === 'processing' || isPolling) && (
            <Button variant="outline" onClick={handleRefresh} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isPolling ? 'animate-spin' : ''}`} />
              {isPolling ? 'Analyzing...' : 'Refresh'}
            </Button>
          )}
        </div>

        {/* Call Metadata */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Call Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{format(new Date(transcript.call_date), 'MMMM d, yyyy')}</span>
              </div>
              <Badge variant="outline">{sourceLabels[transcript.source as CallSource]}</Badge>
              <Badge variant={
                transcript.analysis_status === 'completed' ? 'default' : 
                transcript.analysis_status === 'error' ? 'destructive' : 
                'secondary'
              }>
                {transcript.analysis_status === 'processing' || isPolling ? 'Analyzing...' : transcript.analysis_status}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Analysis Results - Uses shared component with ownership info */}
        <CallAnalysisResultsView 
          call={transcript} 
          analysis={analysis} 
          isOwner={isOwner}
          isManager={isManager && !isOwner}
        />
      </div>
    </AppLayout>
  );
}
