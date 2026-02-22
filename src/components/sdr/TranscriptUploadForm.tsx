import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
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
import { useUploadSDRTranscript } from '@/hooks/sdr/mutations';
import { Loader2, FileUp, AlertCircle, HelpCircle, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TranscriptUploadFormProps {
  sdrId?: string;
  onUploadComplete?: () => void;
  uploadForName?: string;
  children?: React.ReactNode;
}

const MIN_LENGTH = 50;
const MAX_LENGTH = 5_000_000;
const SHORT_WARN_LENGTH = 500;

export function TranscriptUploadForm({
  sdrId,
  onUploadComplete,
  uploadForName,
  children,
}: TranscriptUploadFormProps) {
  const uploadMutation = useUploadSDRTranscript();
  const [rawText, setRawText] = useState('');
  const [transcriptDate, setTranscriptDate] = useState(new Date().toLocaleDateString('en-CA'));
  const [fileName, setFileName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [formatGuideOpen, setFormatGuideOpen] = useState(false);
  const [showShortWarning, setShowShortWarning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  const charCount = rawText.length;
  const validationError =
    charCount > 0 && charCount < MIN_LENGTH
      ? `Transcript must be at least ${MIN_LENGTH} characters (currently ${charCount}).`
      : charCount > MAX_LENGTH
        ? `Transcript exceeds maximum size of 5 MB (~${MAX_LENGTH.toLocaleString()} characters). Current: ${charCount.toLocaleString()}.`
        : null;

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
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      setRawText((ev.target?.result as string) || '');
    };
    reader.readAsText(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      setRawText((ev.target?.result as string) || '');
    };
    reader.readAsText(file);
  };

  const doUpload = () => {
    uploadMutation.mutate(
      { rawText, transcriptDate, sdrId },
      {
        onSuccess: () => {
          setRawText('');
          setFileName(null);
          if (fileInputRef.current) fileInputRef.current.value = '';
          onUploadComplete?.();
        },
      },
    );
  };

  const handleUpload = () => {
    if (!rawText.trim() || validationError) return;
    if (charCount < SHORT_WARN_LENGTH) {
      setShowShortWarning(true);
      return;
    }
    doUpload();
  };

  const title = uploadForName
    ? `Upload Transcript for ${uploadForName}`
    : 'Upload Daily Transcript';
  const description = uploadForName
    ? 'Upload a daily transcript on behalf of a team member'
    : 'Paste your full-day dialer transcript below';

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {children}
          <div className="space-y-2">
            <Label htmlFor="transcript-date">Transcript Date</Label>
            <Input
              id="transcript-date"
              type="date"
              value={transcriptDate}
              onChange={(e) => setTranscriptDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="transcript-text">Transcript Text</Label>
            <div
              className="relative"
              onDragEnter={handleDragEnter}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <Textarea
                id="transcript-text"
                aria-label="Transcript text input"
                placeholder="Paste your full-day transcript here or drag & drop a file..."
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                rows={10}
                className={cn(
                  'font-mono text-sm transition-colors',
                  isDragging && 'border-primary border-dashed',
                )}
              />
              {isDragging && (
                <div className="absolute inset-0 rounded-md border-2 border-dashed border-primary bg-primary/5 flex items-center justify-center pointer-events-none">
                  <div className="text-center">
                    <FileUp className="h-10 w-10 mx-auto text-primary mb-2" />
                    <p className="font-medium text-primary">Drop file here</p>
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center justify-between text-sm">
              <div className="flex-1">
                {validationError ? (
                  <p className="text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {validationError}
                  </p>
                ) : fileName ? (
                  <p className="text-muted-foreground">Loaded from: {fileName}</p>
                ) : (
                  <span />
                )}
              </div>
              <p className="text-muted-foreground ml-4">
                {charCount.toLocaleString()} characters
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.text"
              className="hidden"
              onChange={handleFileChange}
            />
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={() => fileInputRef.current?.click()}
            >
              <FileUp className="h-4 w-4 mr-2" />
              Choose File
            </Button>
          </div>
          <Collapsible open={formatGuideOpen} onOpenChange={setFormatGuideOpen}>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                type="button"
                className="gap-1.5 text-muted-foreground px-2"
              >
                <HelpCircle className="h-4 w-4" />
                Format Guide
                <ChevronDown
                  className={cn(
                    'h-3.5 w-3.5 transition-transform',
                    formatGuideOpen && 'rotate-180',
                  )}
                />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="rounded-md border bg-muted/30 p-4 text-sm space-y-2 mt-2">
                <p className="font-medium">
                  Expected format: Your dialer transcript with timestamps.
                </p>
                <div>
                  <p className="text-muted-foreground mb-1">Example:</p>
                  <pre className="text-xs font-mono bg-background rounded p-2 overflow-x-auto">
                    {`Speaker 1 | 09:15:23 | Hello, this is John from Acme...
Speaker 2 | 09:15:28 | Hi John, what's this about?`}
                  </pre>
                </div>
                <p className="text-muted-foreground">
                  Supported: Otter.ai, Gong, Salesloft, or any timestamped transcript.
                </p>
                <p className="text-muted-foreground">
                  Tip: Paste the full day's transcript — we'll automatically split it into
                  individual calls.
                </p>
              </div>
            </CollapsibleContent>
          </Collapsible>
          <Button
            onClick={handleUpload}
            disabled={uploadMutation.isPending || !rawText.trim() || !!validationError}
          >
            {uploadMutation.isPending && (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            )}
            Process Transcript
          </Button>
        </CardContent>
      </Card>

      <AlertDialog open={showShortWarning} onOpenChange={setShowShortWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Short Transcript</AlertDialogTitle>
            <AlertDialogDescription>
              This transcript seems very short ({charCount} characters). Are you sure you
              want to submit it?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowShortWarning(false);
                doUpload();
              }}
            >
              Submit Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
