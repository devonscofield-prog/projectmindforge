import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
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
  User,
  Bot,
  Loader2,
  ArrowLeft,
  Clock,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';

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
}

interface TranscriptEntry {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

type SessionStatus = 'idle' | 'connecting' | 'connected' | 'speaking' | 'listening' | 'ending' | 'ended';

export default function RoleplaySession() {
  const { personaId } = useParams<{ personaId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [status, setStatus] = useState<SessionStatus>('idle');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState('');
  
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  // Use ref to track current transcript to avoid stale closure in handleDataChannelMessage
  const currentTranscriptRef = useRef('');

  // Fetch persona details
  const { data: persona, isLoading: personaLoading } = useQuery({
    queryKey: ['roleplay-persona', personaId],
    queryFn: async () => {
      if (!personaId) throw new Error('No persona ID');
      
      const { data, error } = await supabase
        .from('roleplay_personas')
        .select('*')
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
          body: { personaId, sessionType: 'discovery' }
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  if (personaLoading) {
    return (
      <div className="min-h-screen bg-background p-8">
        <Skeleton className="h-8 w-64 mb-4" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!persona) {
    return (
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
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Button 
            variant="ghost" 
            onClick={() => status === 'idle' || status === 'ended' ? navigate('/training') : null}
            disabled={status !== 'idle' && status !== 'ended'}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span className="font-mono text-lg">{formatTime(elapsedSeconds)}</span>
            </div>
            
            <Badge 
              variant={status === 'connected' || status === 'listening' ? 'default' : 'secondary'}
              className={cn(
                status === 'speaking' && 'bg-green-500 animate-pulse',
                status === 'connecting' && 'bg-amber-500'
              )}
            >
              {status === 'idle' && 'Ready'}
              {status === 'connecting' && 'Connecting...'}
              {status === 'connected' && 'Connected'}
              {status === 'speaking' && 'AI Speaking'}
              {status === 'listening' && 'Listening'}
              {status === 'ending' && 'Saving...'}
              {status === 'ended' && 'Session Ended'}
            </Badge>
          </div>
        </div>

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
                  {persona.persona_type.replace('_', ' ')} • {persona.industry || 'General'} • {persona.difficulty_level} difficulty
                </p>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Transcript Area */}
        <Card className="mb-6 min-h-[400px] max-h-[500px] overflow-hidden flex flex-col">
          <CardHeader className="border-b pb-3">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Volume2 className="h-4 w-4" />
              Conversation
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
            {status === 'idle' && (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <p>Click "Start Call" to begin your practice session</p>
              </div>
            )}
            
            {transcript.map((entry, idx) => (
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
            
            {/* Current streaming response */}
            {currentTranscript && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="rounded-lg px-4 py-2 max-w-[80%] bg-secondary">
                  <p className="text-sm">{currentTranscript}</p>
                </div>
              </div>
            )}
            
            <div ref={transcriptEndRef} />
          </CardContent>
        </Card>

        {/* Controls */}
        <div className="flex items-center justify-center gap-4">
          {status === 'idle' && (
            <Button 
              size="lg" 
              className="gap-2 px-8"
              onClick={startSession}
            >
              <Phone className="h-5 w-5" />
              Start Call
            </Button>
          )}
          
          {(status === 'connecting') && (
            <Button size="lg" disabled className="gap-2 px-8">
              <Loader2 className="h-5 w-5 animate-spin" />
              Connecting...
            </Button>
          )}
          
          {(status === 'connected' || status === 'speaking' || status === 'listening') && (
            <>
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
          
          {status === 'ended' && (
            <div className="flex gap-4">
              <Button 
                size="lg" 
                variant="outline"
                onClick={() => navigate('/training')}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Training
              </Button>
              <Button 
                size="lg"
                onClick={() => {
                  setStatus('idle');
                  setTranscript([]);
                  setElapsedSeconds(0);
                }}
              >
                <Phone className="h-4 w-4 mr-2" />
                Start New Session
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
