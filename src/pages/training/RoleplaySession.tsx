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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
  AlertTriangle,
  Monitor,
  MonitorOff,
  Pause,
  Play
} from 'lucide-react';
import { RoleplayBriefing } from '@/components/training/RoleplayBriefing';
import { RoleplayPostSession } from '@/components/training/RoleplayPostSession';
import { RoleplayTranscriptPanel } from '@/components/training/RoleplayTranscriptPanel';
import { RoleplayScenarioSelector } from '@/components/training/RoleplayScenarioSelector';
import { cn } from '@/lib/utils';
import { ScreenCapture } from '@/utils/ScreenCapture';
import { AudioLevelMeter } from '@/components/training/AudioLevelMeter';
import type { PersonaClient } from '@/types/persona';

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
  const [sessionType, setSessionType] = useState<'discovery' | 'demo' | 'objection_handling' | 'negotiation'>('discovery');
  const [scenarioPrompt, setScenarioPrompt] = useState('');
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  // Flag: only abandon session on unmount if user intentionally left
  const intentionalLeaveRef = useRef(false);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const screenCaptureRef = useRef<ScreenCapture | null>(null);
  // Use ref to track current transcript to avoid stale closure in handleDataChannelMessage
  const currentTranscriptRef = useRef('');
  // Use refs for sessionId and status to avoid stale closures in cleanup/beforeunload
  const sessionIdRef = useRef<string | null>(null);
  const statusRef = useRef<SessionStatus>('briefing');
  // Timestamp when the active call started (for drift-free elapsed time)
  const callStartTimeRef = useRef<number | null>(null);
  // Track whether duration warnings have been shown
  const durationWarningShownRef = useRef(false);
  // Ref to endSession so the timer can call it without stale closures
  const endSessionRef = useRef<() => void>(() => {});
  // Track cumulative paused time for accurate elapsed calculation
  const pausedTimeRef = useRef(0);
  const pauseStartRef = useRef<number | null>(null);
  // Audio recording refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  // Token timeout ref
  const tokenTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      return data as PersonaClient;
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

  // Keep refs in sync with state to avoid stale closures in cleanup/beforeunload
  useEffect(() => { sessionIdRef.current = sessionId; }, [sessionId]);
  useEffect(() => { statusRef.current = status; }, [status]);

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript, currentTranscript]);

  // Maximum session duration in seconds (30 minutes)
  const MAX_SESSION_SECONDS = 30 * 60;
  // Warning threshold (25 minutes)
  const WARN_SESSION_SECONDS = 25 * 60;

  // Drift-free timer using Date.now() instead of incrementing a counter.
  // Paused time is excluded from the elapsed calculation.
  // Also enforces max session duration with a warning at 25 min and auto-end at 30 min.
  useEffect(() => {
    const isActive = (status === 'connected' || status === 'speaking' || status === 'listening') && !isPaused;
    if (isActive) {
      if (callStartTimeRef.current === null) {
        callStartTimeRef.current = Date.now();
      }
      timerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - callStartTimeRef.current! - pausedTimeRef.current) / 1000);
        setElapsedSeconds(elapsed);

        // Show warning at 25 minutes
        if (elapsed >= WARN_SESSION_SECONDS && !durationWarningShownRef.current) {
          durationWarningShownRef.current = true;
          toast.warning('5 minutes remaining. The session will auto-end at 30 minutes.');
        }

        // Auto-end at 30 minutes
        if (elapsed >= MAX_SESSION_SECONDS) {
          toast.info('Maximum session duration reached. Ending call.');
          endSessionRef.current();
        }
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, isPaused]);

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
      // Ephemeral token has ~60s TTL - must complete WebRTC handshake quickly
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

      // Handle rate limiting (429)
      if (sessionError && sessionError.message?.includes('429')) {
        toast.error('You\'ve created too many sessions recently. Please wait a few minutes and try again.');
        setStatus('idle');
        cleanup();
        return;
      }

      if (sessionError || !sessionData?.ephemeralToken) {
        throw new Error(sessionError?.message || 'Failed to create session');
      }

      setSessionId(sessionData.sessionId);
      console.log('Session created:', sessionData.sessionId);

      // Set a 30s timeout for the WebRTC handshake (ephemeral token has ~60s TTL)
      tokenTimeoutRef.current = setTimeout(() => {
        if (statusRef.current === 'connecting') {
          toast.error('Connection timed out. The session token may have expired. Please try again.');
          setStatus('idle');
          cleanup();
        }
      }, 30000);

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

      // Monitor WebRTC connection state for disconnections (Fix 13)
      pc.onconnectionstatechange = () => {
        const state = pc.connectionState;
        console.log('WebRTC connection state:', state);
        if (state === 'disconnected') {
          toast.warning('Connection unstable. Attempting to reconnect...');
        } else if (state === 'failed') {
          toast.error('Connection lost. Please end the call and try again.');
        }
      };

      pc.oniceconnectionstatechange = () => {
        const state = pc.iceConnectionState;
        console.log('ICE connection state:', state);
        if (state === 'disconnected') {
          toast.warning('Network connection interrupted. Waiting for recovery...');
        } else if (state === 'failed') {
          toast.error('Network connection failed. The call may not recover — consider ending and restarting.');
        }
      };

      // Surface ICE candidate errors for connectivity diagnostics (Fix 14)
      pc.onicecandidateerror = (event) => {
        console.warn('ICE candidate error:', event);
        // Only surface to user if it's a meaningful failure (error code 701 = TURN allocation failure)
        if ((event as RTCPeerConnectionIceErrorEvent).errorCode === 701) {
          toast.warning('Network connectivity issue detected. The call may have trouble connecting.');
        }
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

        const realtime = sessionData?.realtime;
        const voice = realtime?.voice || sessionData?.persona?.voice || persona?.voice;
        const instructions = realtime?.instructions;

        // Configure session settings (GA nested audio format)
        // In GA, turn_detection is nested inside audio.input (not session root).
        // audio.input.format is omitted — WebRTC negotiates codec automatically.
        dc.send(JSON.stringify({
          type: 'session.update',
          session: {
            type: 'realtime',
            instructions,
            audio: {
              output: { voice },
              input: {
                transcription: { model: 'whisper-1' },
                noise_reduction: { type: 'near_field' },
                turn_detection: {
                  type: 'server_vad',
                  threshold: 0.5,
                  prefix_padding_ms: 300,
                  silence_duration_ms: silenceDurationMs
                }
              }
            }
          }
        }));
        console.log('Session configured with voice:', voice, 'silence_duration_ms:', silenceDurationMs);
      };

      dc.onmessage = handleDataChannelMessage;

      dc.onerror = (e) => {
        console.error('Data channel error:', e);
      };

      // Create and set local description
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Connect to OpenAI Realtime API (GA endpoint)
      const model = sessionData?.realtime?.model || 'gpt-realtime-mini-2025-12-15';
      const response = await fetch(`https://api.openai.com/v1/realtime/calls?model=${encodeURIComponent(model)}`, {
        method: 'POST',
        body: offer.sdp,
        headers: {
          'Authorization': `Bearer ${sessionData.ephemeralToken}`,
          'Content-Type': 'application/sdp',
        }
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        throw new Error(`WebRTC connection failed: ${response.status}${errText ? ` - ${errText}` : ''}`);
      }

      const answerSdp = await response.text();
      const answer: RTCSessionDescriptionInit = {
        type: 'answer',
        sdp: answerSdp
      };
      
      await pc.setRemoteDescription(answer);
      console.log('WebRTC connection established');
      
      // Clear token timeout - handshake succeeded
      if (tokenTimeoutRef.current) {
        clearTimeout(tokenTimeoutRef.current);
        tokenTimeoutRef.current = null;
      }

      // Start audio recording
      try {
        const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
        recordedChunksRef.current = [];
        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) recordedChunksRef.current.push(e.data);
        };
        mediaRecorder.start(1000); // Collect in 1s chunks
        mediaRecorderRef.current = mediaRecorder;
        console.log('Audio recording started');
      } catch (recErr) {
        console.warn('Audio recording not supported:', recErr);
      }

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
    // Clear token timeout
    if (tokenTimeoutRef.current) {
      clearTimeout(tokenTimeoutRef.current);
      tokenTimeoutRef.current = null;
    }
    // Stop audio recording
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    // Stop screen capture
    if (screenCaptureRef.current) {
      screenCaptureRef.current.stop();
      screenCaptureRef.current = null;
    }
    setIsScreenSharing(false);
    setIsPaused(false);
    
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
      intervalMs: 4000,
      maxWidthPx: 1024,
    });

    const success = await screenCapture.start();
    if (success) {
      screenCaptureRef.current = screenCapture;
      setIsScreenSharing(true);
      toast.success(`Screen sharing active - ${persona?.name || 'AI Prospect'} can now see your screen`);
    } else {
      toast.error('Failed to start screen sharing');
    }
  };

  const stopScreenShare = () => {
    if (screenCaptureRef.current) {
      screenCaptureRef.current.stop();
      screenCaptureRef.current = null;
    }
    setIsScreenSharing(false);
    toast.info('Screen sharing stopped');
  };

  /**
   * Upload recorded audio to storage and update session record.
   */
  const uploadRecording = async (sid: string) => {
    if (recordedChunksRef.current.length === 0) return;
    try {
      const blob = new Blob(recordedChunksRef.current, { type: 'audio/webm' });
      const filePath = `${user!.id}/${sid}.webm`;
      const { error: uploadError } = await supabase.storage
        .from('roleplay-recordings')
        .upload(filePath, blob, { contentType: 'audio/webm', upsert: true });
      if (uploadError) {
        console.error('Recording upload error:', uploadError);
        return;
      }
      const { data: urlData } = supabase.storage
        .from('roleplay-recordings')
        .getPublicUrl(filePath);
      if (urlData?.publicUrl) {
        await supabase
          .from('roleplay_sessions')
          .update({ audio_recording_url: urlData.publicUrl } as any)
          .eq('id', sid);
        console.log('Recording saved:', urlData.publicUrl);
      }
    } catch (err) {
      console.error('Failed to upload recording:', err);
    }
  };

  const endSession = async () => {
    // Guard against double-end (auto-end timer + manual end can race)
    if (statusRef.current === 'ending' || statusRef.current === 'ended') return;
    intentionalLeaveRef.current = true;
    setStatus('ending');

    // Stop recording before uploading
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    
    const MIN_DURATION_FOR_GRADING = 15;
    const isShortSession = elapsedSeconds < MIN_DURATION_FOR_GRADING;

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

        // Upload recording in background
        uploadRecording(sessionId);

        // Only trigger grading if session was long enough
        if (isShortSession) {
          console.log('Session too short for grading, skipping');
        } else {
          // Trigger AI grading asynchronously
          supabase.functions.invoke('roleplay-grade-session', {
            body: { sessionId }
          }).then(() => {
            console.log('Grading complete');
          }).catch((err) => {
            console.error('Grading failed:', err);
          });
        }
      }
    } catch (error) {
      console.error('Failed to save session:', error);
    }
    
    cleanup();
    setStatus('ended');
    
    if (isShortSession) {
      toast.info('Session was too short for meaningful feedback. Try practicing for at least 15 seconds.');
    } else {
      toast.success('Session completed! Your performance is being evaluated.');
    }
  };

  // Keep endSessionRef in sync so the timer can call it without stale closures
  endSessionRef.current = endSession;

  const toggleMute = () => {
    if (streamRef.current) {
      const audioTrack = streamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  /**
   * Pause/Resume the session. Mutes mic, cancels AI response, and pauses the timer.
   */
  const togglePause = () => {
    if (isPaused) {
      // Resume
      if (pauseStartRef.current) {
        pausedTimeRef.current += Date.now() - pauseStartRef.current;
        pauseStartRef.current = null;
      }
      // Unmute mic
      if (streamRef.current) {
        const audioTrack = streamRef.current.getAudioTracks()[0];
        if (audioTrack) audioTrack.enabled = true;
      }
      setIsMuted(false);
      setIsPaused(false);
      toast.info('Session resumed');
    } else {
      // Pause
      pauseStartRef.current = Date.now();
      // Mute mic
      if (streamRef.current) {
        const audioTrack = streamRef.current.getAudioTracks()[0];
        if (audioTrack) audioTrack.enabled = false;
      }
      setIsMuted(true);
      // Cancel any in-progress AI response
      if (dcRef.current?.readyState === 'open') {
        dcRef.current.send(JSON.stringify({ type: 'response.cancel' }));
      }
      setIsPaused(true);
      toast.info('Session paused');
    }
  };

  // Abandon active session via sendBeacon (works on both unmount and browser close).
  // Uses refs to always read the latest sessionId/status and avoid stale closures.
  // sendBeacon is the only abandon mechanism to prevent double-abandon race conditions.
  useEffect(() => {
    const abandonViaBeacon = () => {
      const sid = sessionIdRef.current;
      const st = statusRef.current;
      if (sid && st !== 'briefing' && st !== 'idle' && st !== 'ending' && st !== 'ended') {
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/roleplay-abandon-session`;
        navigator.sendBeacon(url, JSON.stringify({ sessionId: sid, traineeId: user?.id }));
      }
    };

    window.addEventListener('beforeunload', abandonViaBeacon);

    return () => {
      window.removeEventListener('beforeunload', abandonViaBeacon);
      // On unmount (e.g. React navigation), also fire the beacon
      abandonViaBeacon();
      cleanup();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
              
              {isPaused && (
                <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/30 animate-pulse">
                  <Pause className="h-3 w-3 mr-1" />
                  Paused
                </Badge>
              )}
              
              <Badge 
                variant={status === 'connected' || status === 'listening' ? 'default' : 'secondary'}
                className={cn(
                  status === 'speaking' && !isPaused && 'bg-success animate-pulse',
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
                      status === 'speaking' && 'text-primary font-medium',
                      isPaused && 'text-amber-500 font-medium'
                    )}>
                      {isPaused ? 'Paused' : status === 'speaking' ? 'Speaking...' : 'Listening...'}
                    </p>
                    
                    {/* Visual waveform when speaking */}
                    {status === 'speaking' && !isPaused && (
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
                    
                    {/* Mic level indicator when listening */}
                    {(status === 'connected' || status === 'listening') && !isPaused && (
                      <div className="flex items-center gap-2 mt-4 text-sm text-muted-foreground">
                        <AudioLevelMeter stream={streamRef.current} isActive={!isMuted && !isPaused} />
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

                  {/* Pause/Resume Button */}
                  <Button
                    size="lg"
                    variant={isPaused ? 'default' : 'outline'}
                    className="gap-2"
                    onClick={togglePause}
                  >
                    {isPaused ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
                    {isPaused ? 'Resume' : 'Pause'}
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
                    onClick={() => setShowEndConfirm(true)}
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
              callStartTimeRef.current = null;
              durationWarningShownRef.current = false;
              pausedTimeRef.current = 0;
              pauseStartRef.current = null;
            }}
            onBackToTraining={() => navigate('/training')}
          />
        )}

        {/* End Call Confirmation Dialog */}
        <AlertDialog open={showEndConfirm} onOpenChange={setShowEndConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                End this call?
              </AlertDialogTitle>
              <AlertDialogDescription>
                This will end your practice session with {persona.name} and submit it for grading. You cannot resume a session once ended.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Continue Call</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={endSession}
              >
                End Call
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        </div>
      </div>
    </AppLayout>
  );
}