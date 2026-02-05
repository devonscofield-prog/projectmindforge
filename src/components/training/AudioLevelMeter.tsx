import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface AudioLevelMeterProps {
  stream: MediaStream | null;
  isActive: boolean;
  className?: string;
}

/**
 * Real-time mic audio level indicator using Web Audio API's AnalyserNode.
 * Shows a small animated bar indicating mic input level.
 */
export function AudioLevelMeter({ stream, isActive, className }: AudioLevelMeterProps) {
  const [level, setLevel] = useState(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!stream || !isActive) {
      setLevel(0);
      return;
    }

    const audioCtx = new AudioContext();
    audioCtxRef.current = audioCtx;

    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.8;
    analyserRef.current = analyser;

    const source = audioCtx.createMediaStreamSource(stream);
    source.connect(analyser);

    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const tick = () => {
      analyser.getByteFrequencyData(dataArray);
      // Compute RMS of frequency data
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i] * dataArray[i];
      }
      const rms = Math.sqrt(sum / dataArray.length);
      // Normalize to 0-1 range (max byte value is 255)
      setLevel(Math.min(rms / 128, 1));
      rafRef.current = requestAnimationFrame(tick);
    };

    tick();

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      source.disconnect();
      audioCtx.close();
    };
  }, [stream, isActive]);

  if (!isActive || !stream) return null;

  const barCount = 5;

  return (
    <div className={cn("flex items-end gap-0.5 h-6", className)} aria-label="Microphone level">
      {Array.from({ length: barCount }).map((_, i) => {
        const threshold = (i + 1) / barCount;
        const isLit = level >= threshold * 0.5;
        return (
          <div
            key={i}
            className={cn(
              "w-1 rounded-full transition-all duration-75",
              isLit ? 'bg-primary' : 'bg-muted-foreground/20'
            )}
            style={{
              height: `${8 + (i + 1) * 3}px`,
            }}
          />
        );
      })}
    </div>
  );
}
