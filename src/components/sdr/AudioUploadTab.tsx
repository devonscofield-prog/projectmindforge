import { useState, useRef, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { useUploadAudio, useVoiceUsageQuota } from '@/hooks/sdr/audioHooks';
import {
  validateAudioFile,
  formatFileSize,
  getAudioDuration,
  AUDIO_EXTENSIONS,
  MAX_AUDIO_SIZE_DISPLAY,
} from '@/utils/audioFileValidation';
import { Loader2, Upload, X, AlertCircle, Music } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AudioUploadTabProps {
  sdrId?: string;
  onUploadComplete?: () => void;
  uploadForName?: string;
}

export function AudioUploadTab({ sdrId, onUploadComplete, uploadForName }: AudioUploadTabProps) {
  const { user } = useAuth();
  const uploadAudioMutation = useUploadAudio();
  const { data: quotaData } = useVoiceUsageQuota(user?.id);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [audioDuration, setAudioDuration] = useState<number | null>(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [callDate, setCallDate] = useState(new Date().toLocaleDateString('en-CA'));

  const quotaUsed = quotaData?.used ?? 0;
  const quotaLimit = quotaData?.limit ?? 0;
  const quotaExceeded = quotaLimit > 0 && quotaUsed >= quotaLimit;

  // Clean up preview URL on unmount or file change
  useEffect(() => {
    return () => {
      if (audioPreviewUrl) {
        URL.revokeObjectURL(audioPreviewUrl);
      }
    };
  }, [audioPreviewUrl]);

  const processFile = async (file: File) => {
    // Validate
    const validation = validateAudioFile(file);
    if (!validation.isValid) {
      setValidationError(validation.error);
      setSelectedFile(null);
      setAudioDuration(null);
      setAudioPreviewUrl(null);
      return;
    }

    setValidationError(null);
    setSelectedFile(file);

    // Create audio preview URL
    const previewUrl = URL.createObjectURL(file);
    if (audioPreviewUrl) {
      URL.revokeObjectURL(audioPreviewUrl);
    }
    setAudioPreviewUrl(previewUrl);

    // Get duration
    const duration = await getAudioDuration(file);
    setAudioDuration(duration);
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setValidationError(null);
    setAudioDuration(null);
    if (audioPreviewUrl) {
      URL.revokeObjectURL(audioPreviewUrl);
      setAudioPreviewUrl(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Drag-and-drop handlers (pattern from TranscriptUploadForm)
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    if (e.dataTransfer.types.includes('Files')) setIsDragging(true);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current === 0) setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleUpload = () => {
    if (!selectedFile || quotaExceeded) return;

    uploadAudioMutation.mutate(
      { file: selectedFile, callDate, pipeline: 'sdr', sdrId },
      {
        onSuccess: () => {
          handleRemoveFile();
          onUploadComplete?.();
        },
      },
    );
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        {/* Quota indicator */}
        {quotaData && (
          <div
            className={cn(
              'rounded-md border p-3 text-sm',
              quotaExceeded
                ? 'border-destructive/50 bg-destructive/5 text-destructive'
                : 'border-border bg-muted/30 text-muted-foreground',
            )}
          >
            <div className="flex items-center justify-between">
              <span>
                {quotaUsed} of {quotaLimit} voice analyses used this month
              </span>
              {quotaData.resetDate && (
                <span className="text-xs">
                  Resets{' '}
                  {new Date(quotaData.resetDate).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
              )}
            </div>
            {quotaExceeded && (
              <p className="mt-1 flex items-center gap-1 text-xs font-medium">
                <AlertCircle className="h-3.5 w-3.5" />
                Quota exceeded. Audio uploads are disabled until your quota resets.
              </p>
            )}
          </div>
        )}

        {/* Call date input */}
        <div className="space-y-2">
          <Label htmlFor="audio-call-date">Call Date</Label>
          <Input
            id="audio-call-date"
            type="date"
            value={callDate}
            onChange={(e) => setCallDate(e.target.value)}
          />
        </div>

        {/* Drop zone */}
        {!selectedFile && (
          <div className="space-y-2">
            <Label>Audio File</Label>
            <div
              role="button"
              tabIndex={0}
              aria-label="Drop audio file here or click to browse"
              className={cn(
                'relative flex cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed p-8 transition-colors',
                isDragging
                  ? 'border-primary bg-primary/5'
                  : 'border-muted-foreground/25 hover:border-primary/50',
                quotaExceeded && 'pointer-events-none opacity-50',
              )}
              onDragEnter={handleDragEnter}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => !quotaExceeded && fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if ((e.key === 'Enter' || e.key === ' ') && !quotaExceeded) {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
            >
              <Upload className="mb-3 h-10 w-10 text-muted-foreground" />
              <p className="font-medium">Drop audio file here</p>
              <p className="mt-1 text-sm text-muted-foreground">
                or click to browse &bull; {AUDIO_EXTENSIONS.join(', ')} &bull; Max{' '}
                {MAX_AUDIO_SIZE_DISPLAY}
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*,.mp3,.wav,.m4a,.webm,.ogg"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        )}

        {/* Validation error */}
        {validationError && (
          <p className="flex items-center gap-1 text-sm text-destructive">
            <AlertCircle className="h-3.5 w-3.5" />
            {validationError}
          </p>
        )}

        {/* Selected file preview */}
        {selectedFile && (
          <div className="space-y-3 rounded-md border bg-muted/30 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex-shrink-0 rounded-md bg-primary/10 p-2">
                  <Music className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="truncate font-medium text-sm">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(selectedFile.size)}
                    {audioDuration != null && (
                      <> &bull; {formatDuration(audioDuration)}</>
                    )}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 flex-shrink-0 text-muted-foreground hover:text-destructive"
                onClick={handleRemoveFile}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Audio preview */}
            {audioPreviewUrl && (
              <audio controls className="w-full h-8" preload="metadata">
                <source src={audioPreviewUrl} type={selectedFile.type} />
                Your browser does not support the audio element.
              </audio>
            )}
          </div>
        )}

        {/* Upload for name notice */}
        {uploadForName && (
          <p className="text-sm text-muted-foreground">
            Uploading on behalf of <span className="font-medium">{uploadForName}</span>
          </p>
        )}

        {/* Submit button */}
        <Button
          onClick={handleUpload}
          disabled={!selectedFile || uploadAudioMutation.isPending || quotaExceeded}
        >
          {uploadAudioMutation.isPending && (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          )}
          Upload &amp; Process Audio
        </Button>
      </CardContent>
    </Card>
  );
}
