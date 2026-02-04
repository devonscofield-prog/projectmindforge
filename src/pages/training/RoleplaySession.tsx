import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { 
  Mic, 
  MicOff, 
  Phone, 
  PhoneOff, 
  Volume2,
  Bot,
  Loader2,
  ArrowLeft,
  Clock,
  AlertCircle,
  Monitor,
  MonitorOff
} from 'lucide-react';
import { RoleplayBriefing } from '@/components/training/RoleplayBriefing';
import { RoleplayPostSession } from '@/components/training/RoleplayPostSession';
import { RoleplayTranscriptPanel } from '@/components/training/RoleplayTranscriptPanel';
import { RoleplayScenarioSelector } from '@/components/training/RoleplayScenarioSelector';
import { cn } from '@/lib/utils';
import { ScreenCapture } from '@/utils/ScreenCapture';

interface Persona {
  id: string;
  name: string;
  persona_type: string;
  disc_profile: string | null;
  difficulty_level: string;
  industry: string | null;
  backstory: string | null;
  voice: string;
  communication_style: Record<string, unknown> | null;
  common_objections?: Array<{ objection: string; category: string; severity: string }>;
  pain_points?: Array<{ pain: string; severity: string; visible: boolean }>;
  dos_and_donts?: { dos: string[]; donts: string[] };
}

interface TranscriptEntry {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

type SessionStatus = 'briefing' | 'idle' | 'connecting' | 'connected' | 'speaking' | 'listening' | 'ending' | 'ended';

export default function RoleplaySession() {
  const { personaId } = useParams<{ personaId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [status, setStatus] = useState<SessionStatus>('briefing');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [sessionType, setSessionType] = useState<'discovery' | 'demo'>('discovery');
  const [scenarioPrompt, setScenarioPrompt] = useState('');
  
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const screenCaptureRef = useRef<ScreenCapture | null>(null);
  // Use ref to track current transcript to avoid stale closure in handleDataChannelMessage
  const currentTranscriptRef = useRef('');

  // Fetch persona details with extended fields
  const { data: persona, isLoading: personaLoading } = useQuery({
    queryKey: ['roleplay-persona', personaId],
    queryFn: async () => {
      if (!personaId) throw new Error('No persona ID');
      
      const { data, error } = await supabase
        .from('roleplay_personas')
        .select('id, name, persona_type, disc_profile, difficulty_level, industry, backstory, voice, communication_style, common_objections, pain_points, dos_and_donts')
        .eq('id', personaId)
        .single();
      
      if (error) throw error;
      return data as Persona;
    },
    enabled: !!personaId,
  });

  // Redirect if persona not found
  useEffect(() => {
    if (!personaLoading && !persona && personaId) {
      toast.error('Practice partner not found');
      navigate('/training');
    }
  }, [persona, personaLoading, personaId, navigate]);

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript, currentTranscript]);

  // Timer effect
  useEffect(() => {
    if (status === 'connected' || status === 'speaking' || status === 'listening') {
      timerRef.current = setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [status]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleDataChannelMessage = useCallback((event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);
      console.log('Received event:', data.type, data);

      switch (data.type) {
        case 'response.audio_transcript.delta':
          // Accumulate assistant transcript using ref to avoid stale closure
          currentTranscriptRef.current += (data.delta || '');
          setCurrentTranscript(currentTranscriptRef.current);
          setStatus('speaking');
          break;
          
        case 'response.audio_transcript.done':
          // Finalize assistant message using ref value
          const finalTranscript = data.transcript || currentTranscriptRef.current;
          if (finalTranscript) {
            setTranscript(prev => [...prev, {
              role: 'assistant',
              content: finalTranscript,
              timestamp: Date.now()
            }]);
          }
          currentTranscriptRef.current = '';
          setCurrentTranscript('');
          setStatus('listening');
          break;
          
        case 'conversation.item.input_audio_transcription.completed':
          // User's speech was transcribed
          if (data.transcript) {
            setTranscript(prev => [...prev, {
              role: 'user',
              content: data.transcript,
              timestamp: Date.now()
            }]);
          }
          break;
          
        case 'input_audio_buffer.speech_started':
          setStatus('listening');
          break;
          
        case 'response.done':
          setStatus('connected');
          break;
          
        case 'error':
          console.error('API Error:', data.error);
          toast.error(data.error?.message || 'An error occurred');
          break;
      }
    } catch (e) {
      console.error('Failed to parse message:', e);
    }
  }, []);

  const startSession = async () => {
    if (!personaId || !user) return;
    
    setStatus('connecting');
    
    try {
      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 24000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      streamRef.current = stream;

      // Get session token from edge function
      const { data: sessionData, error: sessionError } = await supabase.functions.invoke(
        'roleplay-session-manager/create-session',
        {
          body: { 
            personaId, 
            sessionType, 
            screenShareEnabled: isScreenSharing,
            scenarioPrompt: scenarioPrompt.trim() || undefined
          }
        }
      );

      if (sessionError || !sessionData?.ephemeralToken) {
        throw new Error(sessionError?.message || 'Failed to create session');
      }

      setSessionId(sessionData.sessionId);
      console.log('Session created:', sessionData.sessionId);

      // Create WebRTC peer connection
      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      // Create audio element for playback
      const audioEl = document.createElement('audio');
      audioEl.autoplay = true;
      audioElRef.current = audioEl;

      // Handle remote audio
      pc.ontrack = (e) => {
        console.log('Received remote track');
        audioEl.srcObject = e.streams[0];
      };

      // Add local audio track
      const audioTrack = stream.getTracks()[0];
      pc.addTrack(audioTrack);

      // Create data channel for events
      const dc = pc.createDataChannel('oai-events');
      dcRef.current = dc;

      dc.onopen = () => {
        console.log('Data channel opened');
        
        // Determine silence duration based on persona communication style
        // Stoic/minimal personas like Alex use longer pauses (1200ms) to create awkward silences
        const communicationStyle = persona?.communication_style;
        const isSlowPaced = String(communicationStyle?.pace || '').includes('slow') || 
                           String(communicationStyle?.tone || '').includes('monotone');
        const silenceDurationMs = isSlowPaced ? 1200 : 800;
        
        // Configure session settings
        dc.send(JSON.stringify({
          type: 'session.update',
          session: {
            modalities: ['text', 'audio'],
            input_audio_format: 'pcm16',
            output_audio_format: 'pcm16',
            input_audio_transcription: {
              model: 'whisper-1'
            },
            turn_detection: {
              type: 'server_vad',
              threshold: 0.5,
              prefix_padding_ms: 300,
              silence_duration_ms: silenceDurationMs
            }
          }
        }));
        console.log('Session configured with silence_duration_ms:', silenceDurationMs);
      };

      dc.onmessage = handleDataChannelMessage;

      dc.onerror = (e) => {
        console.error('Data channel error:', e);
      };

      // Create and set local description
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Connect to OpenAI Realtime API
      const baseUrl = 'https://api.openai.com/v1/realtime';
      // Must match the model used in roleplay-session-manager edge function
      const model = 'gpt-realtime-mini-2025-12-15';
      
      const response = await fetch(`${baseUrl}?model=${model}`, {
        method: 'POST',
        body: offer.sdp,
        headers: {
          'Authorization': `Bearer ${sessionData.ephemeralToken}`,
          'Content-Type': 'application/sdp'
        }
      });

      if (!response.ok) {
        throw new Error(`WebRTC connection failed: ${response.status}`);
      }

      const answerSdp = await response.text();
      const answer: RTCSessionDescriptionInit = {
        type: 'answer',
        sdp: answerSdp
      };
      
      await pc.setRemoteDescription(answer);
      console.log('WebRTC connection established');
      
      setStatus('connected');
      toast.success(`Connected to ${persona?.name || 'AI Prospect'}`);

    } catch (error) {
      console.error('Failed to start session:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to start session');
      setStatus('idle');
      cleanup();
    }
  };

  const cleanup = () => {
    // Stop screen capture
    if (screenCaptureRef.current) {
      screenCaptureRef.current.stop();
      screenCaptureRef.current = null;
    }
    setIsScreenSharing(false);
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (dcRef.current) {
      dcRef.current.close();
      dcRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (audioElRef.current) {
      audioElRef.current.srcObject = null;
      audioElRef.current = null;
    }
  };

  /**
   * Start screen sharing - sends periodic screenshots to the AI
   */
  const startScreenShare = async () => {
    if (!dcRef.current || dcRef.current.readyState !== 'open') {
      toast.error('Please start the call first');
      return;
    }

    const screenCapture = new ScreenCapture({
      onFrame: (base64Frame) => {
        if (dcRef.current?.readyState === 'open') {
          // Send screenshot as an image message to the AI
          dcRef.current.send(JSON.stringify({
            type: 'conversation.item.create',
            item: {
              type: 'message',
              role: 'user',
              content: [{
                type: 'input_image',
                image_url: `data:image/jpeg;base64,${base64Frame}`
              }]
            }
          }));
          console.log('Sent screen frame to AI');
        }
      },
      onEnd: () => {
        setIsScreenSharing(false);
        toast.info('Screen sharing ended');
      },
      intervalMs: 4000, // Capture every 4 seconds
      maxWidthPx: 1024, // Compress to reasonable size
    });

    const success = await screenCapture.start();
    if (success) {
      screenCaptureRef.current = screenCapture;
      setIsScreenSharing(true);
      toast.success('Screen sharing active - Steven can now see your screen');
    } else {
      toast.error('Failed to start screen sharing');
    }
  };

  /**
   * Stop screen sharing
   */
  const stopScreenShare = () => {
    if (screenCaptureRef.current) {
      screenCaptureRef.current.stop();
      screenCaptureRef.current = null;
    }
    setIsScreenSharing(false);
    toast.info('Screen sharing stopped');
  };

  const endSession = async () => {
    setStatus('ending');
    
    try {
      if (sessionId) {
        // Save the session
        await supabase.functions.invoke('roleplay-session-manager/end-session', {
          body: {
            sessionId,
            transcript,
            durationSeconds: elapsedSeconds
          }
        });

        // Trigger AI grading asynchronously
        supabase.functions.invoke('roleplay-grade-session', {
          body: { sessionId }
        }).then(() => {
          console.log('Grading complete');
        }).catch((err) => {
          console.error('Grading failed:', err);
        });
      }
    } catch (error) {
      console.error('Failed to save session:', error);
    }
    
    cleanup();
    setStatus('ended');
    toast.success('Session completed! Your performance is being evaluated.');
  };

  const toggleMute = () => {
    if (streamRef.current) {
      const audioTrack = streamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  // Cleanup on unmount - also abandon session if still active
  useEffect(() => {
    return () => {
      // If session is active, mark it as abandoned in the database
      if (sessionId && status !== 'idle' && status !== 'ended') {
        // Fire and forget - we're unmounting so can't await
        supabase.functions.invoke('roleplay-session-manager/abandon-session', {
          body: { sessionId }
        }).catch(console.error);
      }
      cleanup();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [sessionId, status]);

  // Handle browser close/refresh - use sendBeacon for reliability
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (sessionId && status !== 'idle' && status !== 'ended') {
        // Use dedicated abandon endpoint that doesn't require auth
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/roleplay-abandon-session`;
        navigator.sendBeacon(url, JSON.stringify({ sessionId }));
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [sessionId, status]);

  if (personaLoading) {
    return (
      <AppLayout>
        <div className="min-h-screen bg-background p-8">
          <Skeleton className="h-8 w-64 mb-4" />
          <Skeleton className="h-96 w-full" />
        </div>
      </AppLayout>
    );
  }

  if (!persona) {
    return (
      <AppLayout>
        <div className="min-h-screen bg-background flex items-center justify-center">
          <Card className="p-8 text-center max-w-md">
            <AlertCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
            <h2 className="text-xl font-semibold mb-2">Persona Not Found</h2>
            <p className="text-muted-foreground mb-4">
              This practice persona is no longer available.
            </p>
            <Button onClick={() => navigate('/training')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Training
            </Button>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-6 max-w-4xl">
        {/* Header - Only show during active call states */}
        {status !== 'briefing' && status !== 'ended' && (
          <div className="flex items-center justify-between mb-6">
            <Button 
              variant="ghost" 
              onClick={() => status === 'idle' ? setStatus('briefing') : null}
              disabled={status !== 'idle'}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span className="font-mono text-lg">{formatTime(elapsedSeconds)}</span>
              </div>
              
              {/* Screen Share Status Badge */}
              {isScreenSharing && (
                <Badge variant="outline" className="bg-success/10 text-success border-success/30">
                  <Monitor className="h-3 w-3 mr-1" />
                  Screen Visible
                </Badge>
              )}
              
              <Badge 
                variant={status === 'connected' || status === 'listening' ? 'default' : 'secondary'}
                className={cn(
                  status === 'speaking' && 'bg-success animate-pulse',
                  status === 'connecting' && 'bg-warning'
                )}
              >
                {status === 'idle' && 'Ready'}
                {status === 'connecting' && 'Connecting...'}
                {status === 'connected' && 'Connected'}
                {status === 'speaking' && 'AI Speaking'}
                {status === 'listening' && 'Listening'}
                {status === 'ending' && 'Saving...'}
              </Badge>
            </div>
          </div>
        )}

        {/* Briefing Screen */}
        {status === 'briefing' && (
          <div className="mb-6">
            <div className="flex items-center gap-4 mb-6">
              <Button variant="ghost" onClick={() => navigate('/training')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Training
              </Button>
            </div>
            <RoleplayBriefing
              persona={persona}
              sessionType={sessionType}
              onStart={() => setStatus('idle')}
              onChangeSessionType={setSessionType}
            />
            
            {/* Custom Scenario Selector */}
            <div className="mt-6">
              <RoleplayScenarioSelector
                scenarioPrompt={scenarioPrompt}
                onScenarioChange={setScenarioPrompt}
              />
            </div>
          </div>
        )}

        {/* Pre-call ready state */}
        {status === 'idle' && (
          <>
            {/* Persona Info Card */}
            <Card className="mb-6 bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                    <Bot className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle>{persona.name}</CardTitle>
                    <p className="text-sm text-muted-foreground capitalize">
                      {persona.persona_type.replace('_', ' ')} • {persona.industry || 'General'} • {sessionType}
                    </p>
                  </div>
                </div>
              </CardHeader>
            </Card>

            {/* Ready to start */}
            <Card className="mb-6 min-h-[300px] flex flex-col">
              <CardHeader className="border-b pb-3">
                <CardTitle className="text-base font-medium flex items-center gap-2">
                  <Volume2 className="h-4 w-4" />
                  Voice Call
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 flex items-center justify-center p-4">
                <div className="flex flex-col items-center justify-center text-muted-foreground">
                  <div className="w-24 h-24 rounded-full bg-secondary flex items-center justify-center mb-6">
                    <Bot className="h-12 w-12 text-muted-foreground" />
                  </div>
                  <p>Ready to start your {sessionType} call</p>
                </div>
              </CardContent>
            </Card>

            {/* Controls */}
            <div className="flex items-center justify-center gap-4">
              <Button 
                size="lg" 
                className="gap-2 px-8"
                onClick={startSession}
              >
                <Phone className="h-5 w-5" />
                Start Call
              </Button>
            </div>
          </>
        )}

        {/* Active call states */}
        {(status === 'connecting' || status === 'connected' || status === 'speaking' || status === 'listening' || status === 'ending') && (
          <>
            {/* Persona Info Card */}
            <Card className="mb-6 bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                    <Bot className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle>{persona.name}</CardTitle>
                    <p className="text-sm text-muted-foreground capitalize">
                      {persona.persona_type.replace('_', ' ')} • {persona.industry || 'General'} • {sessionType}
                    </p>
                  </div>
                </div>
              </CardHeader>
            </Card>

            {/* Voice Activity Indicator */}
            <Card className="mb-4 min-h-[350px] max-h-[400px] overflow-hidden flex flex-col">
              <CardHeader className="border-b pb-3">
                <CardTitle className="text-base font-medium flex items-center gap-2">
                  <Volume2 className="h-4 w-4" />
                  Voice Call
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 flex items-center justify-center p-4">
                {/* Connecting state */}
                {status === 'connecting' && (
                  <div className="flex flex-col items-center justify-center">
                    <div className="relative w-24 h-24">
                      <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
                      <div className="relative w-24 h-24 rounded-full bg-secondary flex items-center justify-center">
                        <Loader2 className="h-12 w-12 text-muted-foreground animate-spin" />
                      </div>
                    </div>
                    <p className="mt-6 text-muted-foreground">Connecting...</p>
                  </div>
                )}
                
                {/* Active call */}
                {(status === 'connected' || status === 'speaking' || status === 'listening') && (
                  <div className="flex flex-col items-center justify-center">
                    {/* AI Avatar with animated rings */}
                    <div className="relative">
                      {/* Pulsing rings when AI is speaking */}
                      {status === 'speaking' && (
                        <>
                          <div 
                            className="absolute inset-[-12px] rounded-full bg-primary/30 animate-ping" 
                            style={{ animationDuration: '1.5s' }} 
                          />
                          <div 
                            className="absolute inset-[-24px] rounded-full bg-primary/15 animate-ping" 
                            style={{ animationDuration: '2s', animationDelay: '0.3s' }} 
                          />
                          <div 
                            className="absolute inset-[-36px] rounded-full bg-primary/10 animate-ping" 
                            style={{ animationDuration: '2.5s', animationDelay: '0.6s' }} 
                          />
                        </>
                      )}
                      
                      {/* Main avatar */}
                      <div className={cn(
                        "relative w-28 h-28 rounded-full flex items-center justify-center transition-all duration-300",
                        status === 'speaking' 
                          ? 'bg-primary scale-110 shadow-lg shadow-primary/30' 
                          : 'bg-secondary'
                      )}>
                        <Bot className={cn(
                          "h-14 w-14 transition-colors",
                          status === 'speaking' ? 'text-primary-foreground' : 'text-muted-foreground'
                        )} />
                      </div>
                    </div>
                    
                    {/* Persona name */}
                    <h3 className="mt-6 text-xl font-semibold">{persona.name}</h3>
                    
                    {/* Status text */}
                    <p className={cn(
                      "mt-2 text-muted-foreground transition-all",
                      status === 'speaking' && 'text-primary font-medium'
                    )}>
                      {status === 'speaking' ? 'Speaking...' : 'Listening...'}
                    </p>
                    
                    {/* Visual waveform when speaking */}
                    {status === 'speaking' && (
                      <div className="flex items-center gap-1 mt-4 h-8">
                        {[...Array(7)].map((_, i) => (
                          <div 
                            key={i}
                            className="w-1.5 bg-primary rounded-full animate-pulse"
                            style={{ 
                              height: `${16 + Math.sin(i * 0.8) * 12}px`,
                              animationDelay: `${i * 0.1}s`,
                              animationDuration: '0.6s'
                            }}
                          />
                        ))}
                      </div>
                    )}
                    
                    {/* Subtle indicator when listening */}
                    {(status === 'connected' || status === 'listening') && (
                      <div className="flex items-center gap-2 mt-4 text-sm text-muted-foreground">
                        <Mic className="h-4 w-4" />
                        <span>Your turn to speak</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Ending state */}
                {status === 'ending' && (
                  <div className="flex flex-col items-center justify-center">
                    <div className="w-24 h-24 rounded-full bg-secondary flex items-center justify-center">
                      <Loader2 className="h-12 w-12 text-muted-foreground animate-spin" />
                    </div>
                    <p className="mt-6 text-muted-foreground">Saving your session...</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Collapsible Transcript Panel - only during active call */}
            {(status === 'connected' || status === 'speaking' || status === 'listening') && (
              <div className="mb-4">
                <RoleplayTranscriptPanel 
                  transcript={transcript} 
                  currentTranscript={currentTranscript}
                />
              </div>
            )}

            {/* Controls */}
            <div className="flex items-center justify-center gap-4">
              {status === 'connecting' && (
                <Button size="lg" disabled className="gap-2 px-8">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Connecting...
                </Button>
              )}
              
              {(status === 'connected' || status === 'speaking' || status === 'listening') && (
                <>
                  {/* Screen Share Button */}
                  <Button
                    size="lg"
                    variant={isScreenSharing ? 'default' : 'outline'}
                    className={cn(
                      "gap-2",
                      isScreenSharing && "bg-success hover:bg-success/90"
                    )}
                    onClick={isScreenSharing ? stopScreenShare : startScreenShare}
                  >
                    {isScreenSharing ? (
                      <>
                        <Monitor className="h-5 w-5" />
                        Screen Visible
                      </>
                    ) : (
                      <>
                        <MonitorOff className="h-5 w-5" />
                        Share Screen
                      </>
                    )}
                  </Button>
                  
                  <Button
                    size="lg"
                    variant={isMuted ? 'destructive' : 'secondary'}
                    className="gap-2"
                    onClick={toggleMute}
                  >
                    {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                    {isMuted ? 'Unmute' : 'Mute'}
                  </Button>
                  
                  <Button 
                    size="lg" 
                    variant="destructive"
                    className="gap-2 px-8"
                    onClick={endSession}
                  >
                    <PhoneOff className="h-5 w-5" />
                    End Call
                  </Button>
                </>
              )}
              
              {status === 'ending' && (
                <Button size="lg" disabled className="gap-2 px-8">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Saving Session...
                </Button>
              )}
            </div>
          </>
        )}
        
        {/* Post-Session Summary */}
        {status === 'ended' && sessionId && (
          <RoleplayPostSession
            sessionId={sessionId}
            durationSeconds={elapsedSeconds}
            personaName={persona.name}
            onViewDetails={() => navigate(`/training/session/${sessionId}`)}
            onNewSession={() => {
              setStatus('briefing');
              setSessionId(null);
              setTranscript([]);
              setElapsedSeconds(0);
            }}
            onBackToTraining={() => navigate('/training')}
          />
        )}
        </div>
      </div>
    </AppLayout>
  );
}