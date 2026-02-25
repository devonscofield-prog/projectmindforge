import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Play, Pause, Volume2, VolumeX, Loader2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

interface AudioPlayerProps {
  audioUrl: string;
  duration?: number;
  currentTime?: number;
  onTimeUpdate?: (seconds: number) => void;
  className?: string;
  compact?: boolean;
}

const PLAYBACK_SPEEDS = [0.75, 1, 1.25, 1.5, 2] as const;

/** Format seconds into M:SS display */
function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function AudioPlayer({
  audioUrl,
  duration: externalDuration,
  currentTime: controlledTime,
  onTimeUpdate,
  className,
  compact = false,
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const lastTimeUpdateRef = useRef<number>(0);
  const isSeekingFromPropRef = useRef(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [internalCurrentTime, setInternalCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(externalDuration ?? 0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const isMobile = useIsMobile();

  // Sync duration from prop or audio metadata
  useEffect(() => {
    if (externalDuration && externalDuration > 0) {
      setAudioDuration(externalDuration);
    }
  }, [externalDuration]);

  // Handle controlled seek from external currentTime prop
  useEffect(() => {
    if (controlledTime === undefined || controlledTime === null) return;
    const audio = audioRef.current;
    if (!audio) return;

    // Avoid feedback loops: only seek if the difference is > 0.5s
    const diff = Math.abs(audio.currentTime - controlledTime);
    if (diff > 0.5) {
      isSeekingFromPropRef.current = true;
      audio.currentTime = controlledTime;
      setInternalCurrentTime(controlledTime);
      // Reset flag after a short delay to allow timeupdate to settle
      setTimeout(() => {
        isSeekingFromPropRef.current = false;
      }, 100);
    }
  }, [controlledTime]);

  // Audio event handlers
  const handleLoadedMetadata = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!externalDuration || externalDuration <= 0) {
      setAudioDuration(audio.duration);
    }
    setIsLoading(false);
    setHasError(false);
  }, [externalDuration]);

  const handleCanPlay = useCallback(() => {
    setIsLoading(false);
  }, []);

  const handleError = useCallback(() => {
    setIsLoading(false);
    setHasError(true);
    setIsPlaying(false);
  }, []);

  const handleTimeUpdate = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || isSeekingFromPropRef.current) return;

    // Throttle to ~4 updates/sec
    const now = performance.now();
    if (now - lastTimeUpdateRef.current < 250) return;
    lastTimeUpdateRef.current = now;

    setInternalCurrentTime(audio.currentTime);
    onTimeUpdate?.(audio.currentTime);
  }, [onTimeUpdate]);

  const handleEnded = useCallback(() => {
    setIsPlaying(false);
  }, []);

  const handlePlay = useCallback(() => {
    setIsPlaying(true);
  }, []);

  const handlePause = useCallback(() => {
    setIsPlaying(false);
  }, []);

  // Register audio event listeners
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('error', handleError);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
    };
  }, [handleLoadedMetadata, handleCanPlay, handleError, handleTimeUpdate, handleEnded, handlePlay, handlePause]);

  // Toggle play/pause
  const togglePlayPause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || hasError) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch(() => {
        setHasError(true);
      });
    }
  }, [isPlaying, hasError]);

  // Seek via slider
  const handleSeek = useCallback((value: number[]) => {
    const audio = audioRef.current;
    if (!audio) return;
    const newTime = value[0];
    audio.currentTime = newTime;
    setInternalCurrentTime(newTime);
    onTimeUpdate?.(newTime);
  }, [onTimeUpdate]);

  // Playback rate
  const handlePlaybackRateChange = useCallback((rate: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.playbackRate = rate;
    setPlaybackRate(rate);
  }, []);

  // Volume
  const handleVolumeChange = useCallback((value: number[]) => {
    const audio = audioRef.current;
    if (!audio) return;
    const newVolume = value[0];
    audio.volume = newVolume;
    setVolume(newVolume);
    if (newVolume > 0 && isMuted) {
      audio.muted = false;
      setIsMuted(false);
    }
  }, [isMuted]);

  const toggleMute = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const newMuted = !isMuted;
    audio.muted = newMuted;
    setIsMuted(newMuted);
  }, [isMuted]);

  // Keyboard shortcut support
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      const audio = audioRef.current;
      if (!audio) return;

      switch (event.key) {
        case ' ':
        case 'k':
          event.preventDefault();
          togglePlayPause();
          break;
        case 'ArrowLeft':
          event.preventDefault();
          audio.currentTime = Math.max(0, audio.currentTime - 5);
          setInternalCurrentTime(audio.currentTime);
          break;
        case 'ArrowRight':
          event.preventDefault();
          audio.currentTime = Math.min(audioDuration, audio.currentTime + 5);
          setInternalCurrentTime(audio.currentTime);
          break;
        case 'm':
          event.preventDefault();
          toggleMute();
          break;
      }
    },
    [togglePlayPause, toggleMute, audioDuration],
  );

  const playbackRateLabel = useMemo(() => {
    return playbackRate === 1 ? '1x' : `${playbackRate}x`;
  }, [playbackRate]);

  if (hasError) {
    return (
      <div
        className={cn(
          'sticky bottom-0 z-10 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80',
          'px-4 py-3',
          className,
        )}
      >
        <div className="flex items-center justify-center gap-2 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4" />
          <span>Failed to load audio. The file may be unavailable or the URL has expired.</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'sticky bottom-0 z-10 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80',
        className,
      )}
      role="region"
      aria-label="Audio player"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      {/* Hidden native audio element */}
      <audio ref={audioRef} src={audioUrl} preload="metadata" />

      <div className={cn('px-4 py-3', compact ? 'flex items-center gap-3' : 'space-y-2')}>
        {/* Top row: Play/Pause + Time + Seek */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* Play/Pause */}
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={togglePlayPause}
            disabled={isLoading}
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : isPlaying ? (
              <Pause className="h-5 w-5" />
            ) : (
              <Play className="h-5 w-5" />
            )}
          </Button>

          {/* Time display */}
          <span className="text-xs font-mono text-muted-foreground tabular-nums whitespace-nowrap shrink-0">
            {formatTime(internalCurrentTime)} / {formatTime(audioDuration)}
          </span>

          {/* Seek bar */}
          <Slider
            value={[internalCurrentTime]}
            min={0}
            max={audioDuration || 1}
            step={0.5}
            onValueChange={handleSeek}
            className="flex-1 min-w-[80px]"
            aria-label="Seek position"
          />
        </div>

        {/* Bottom row (or inline in compact): Speed + Volume */}
        <div className={cn('flex items-center gap-2', compact ? 'shrink-0' : 'justify-end')}>
          {/* Playback speed */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs font-mono tabular-nums"
                aria-label={`Playback speed: ${playbackRateLabel}`}
              >
                {playbackRateLabel}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[4rem]">
              {PLAYBACK_SPEEDS.map((speed) => (
                <DropdownMenuItem
                  key={speed}
                  onClick={() => handlePlaybackRateChange(speed)}
                  className={cn(
                    'text-xs justify-center',
                    speed === playbackRate && 'font-bold bg-accent',
                  )}
                >
                  {speed}x
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Volume control (hidden on mobile) */}
          {!isMobile && (
            <div className="flex items-center gap-1.5">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={toggleMute}
                aria-label={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="h-4 w-4" />
                ) : (
                  <Volume2 className="h-4 w-4" />
                )}
              </Button>
              <Slider
                value={[isMuted ? 0 : volume]}
                min={0}
                max={1}
                step={0.05}
                onValueChange={handleVolumeChange}
                className="w-20"
                aria-label="Volume"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
