import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { Search, Copy, Check, User, UserCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TranscriptEntry {
  speaker: string;
  time?: string;
  text: string;
}

interface TranscriptViewerProps {
  transcriptText: string;
}

/**
 * Attempts to parse transcript text as JSON array of speaker entries
 */
function parseJsonTranscript(text: string): TranscriptEntry[] | null {
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].speaker && parsed[0].text) {
      return parsed as TranscriptEntry[];
    }
  } catch {
    // Not JSON, return null
  }
  return null;
}

/**
 * Attempts to parse speaker-formatted text (e.g., "Speaker 1: Hello")
 */
function parseSpeakerLines(text: string): TranscriptEntry[] | null {
  const lines = text.split('\n').filter(line => line.trim());
  const speakerPattern = /^([^:]+):\s*(.+)$/;
  
  const entries: TranscriptEntry[] = [];
  let currentSpeaker = '';
  let currentText = '';
  
  for (const line of lines) {
    const match = line.match(speakerPattern);
    if (match) {
      // Save previous entry if exists
      if (currentSpeaker && currentText) {
        entries.push({ speaker: currentSpeaker, text: currentText.trim() });
      }
      currentSpeaker = match[1].trim();
      currentText = match[2];
    } else if (currentSpeaker) {
      // Continuation of previous speaker's text
      currentText += ' ' + line.trim();
    }
  }
  
  // Save last entry
  if (currentSpeaker && currentText) {
    entries.push({ speaker: currentSpeaker, text: currentText.trim() });
  }
  
  // Only return if we found at least 2 entries with different speakers
  if (entries.length >= 2) {
    const speakers = new Set(entries.map(e => e.speaker));
    if (speakers.size >= 2) {
      return entries;
    }
  }
  
  return null;
}

/**
 * Prettifies raw text by adding proper line breaks
 */
function prettifyRawText(text: string): string {
  return text
    .replace(/\. /g, '.\n\n')
    .replace(/\? /g, '?\n\n')
    .replace(/! /g, '!\n\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Determines if speaker is likely the rep (sales person)
 */
function isRepSpeaker(speaker: string): boolean {
  const repPatterns = /rep|sales|agent|host|presenter|me|self/i;
  const prospectPatterns = /customer|client|prospect|guest|them|buyer|attendee/i;
  
  if (repPatterns.test(speaker)) return true;
  if (prospectPatterns.test(speaker)) return false;
  
  // Default: first speaker is usually the rep
  return speaker.toLowerCase().includes('1') || speaker.toLowerCase().includes('a');
}

/**
 * Highlights search term in text
 */
function highlightText(text: string, searchTerm: string): React.ReactNode {
  if (!searchTerm.trim()) return text;
  
  const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = text.split(regex);
  
  return parts.map((part, i) => 
    regex.test(part) ? (
      <mark key={i} className="bg-yellow-300 dark:bg-yellow-700 text-foreground rounded px-0.5">
        {part}
      </mark>
    ) : (
      part
    )
  );
}

export function TranscriptViewer({ transcriptText }: TranscriptViewerProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  // Parse transcript into structured format if possible
  const { entries, isStructured } = useMemo(() => {
    // Try JSON first
    const jsonEntries = parseJsonTranscript(transcriptText);
    if (jsonEntries) {
      return { entries: jsonEntries, isStructured: true };
    }
    
    // Try speaker-line format
    const speakerEntries = parseSpeakerLines(transcriptText);
    if (speakerEntries) {
      return { entries: speakerEntries, isStructured: true };
    }
    
    // Fall back to raw text
    return { entries: null, isStructured: false };
  }, [transcriptText]);

  // Filter entries based on search
  const matchCount = useMemo(() => {
    if (!searchTerm.trim()) return 0;
    const regex = new RegExp(searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    return (transcriptText.match(regex) || []).length;
  }, [transcriptText, searchTerm]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(transcriptText);
      setCopied(true);
      toast({ title: 'Copied to clipboard' });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: 'Failed to copy', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-4">
      {/* Search and Copy Controls */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search transcript..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
          {searchTerm && matchCount > 0 && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
              {matchCount} match{matchCount !== 1 ? 'es' : ''}
            </span>
          )}
        </div>
        <Button variant="outline" onClick={handleCopy} className="shrink-0">
          {copied ? (
            <>
              <Check className="h-4 w-4 mr-2" />
              Copied
            </>
          ) : (
            <>
              <Copy className="h-4 w-4 mr-2" />
              Copy Full Text
            </>
          )}
        </Button>
      </div>

      {/* Transcript Content */}
      <ScrollArea className="h-[500px] rounded-md border bg-muted/30 p-4">
        {isStructured && entries ? (
          // Chat Bubble View
          <div className="space-y-3">
            {entries.map((entry, idx) => {
              const isRep = isRepSpeaker(entry.speaker);
              return (
                <div
                  key={idx}
                  className={cn(
                    'flex gap-2 max-w-[85%]',
                    isRep ? 'ml-auto flex-row-reverse' : 'mr-auto'
                  )}
                >
                  <div className={cn(
                    'shrink-0 h-8 w-8 rounded-full flex items-center justify-center',
                    isRep ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
                  )}>
                    {isRep ? <User className="h-4 w-4" /> : <UserCircle className="h-4 w-4" />}
                  </div>
                  <div
                    className={cn(
                      'rounded-lg px-3 py-2 text-sm',
                      isRep 
                        ? 'bg-primary text-primary-foreground rounded-tr-none' 
                        : 'bg-secondary text-secondary-foreground rounded-tl-none'
                    )}
                  >
                    <p className="font-medium text-xs opacity-80 mb-1">
                      {entry.speaker}
                      {entry.time && <span className="ml-2">{entry.time}</span>}
                    </p>
                    <p className="whitespace-pre-wrap">
                      {highlightText(entry.text, searchTerm)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          // Raw Text View (prettified)
          <pre className="whitespace-pre-wrap text-sm font-mono text-foreground leading-relaxed">
            {highlightText(prettifyRawText(transcriptText), searchTerm)}
          </pre>
        )}
      </ScrollArea>

      {/* Footer info */}
      <p className="text-xs text-muted-foreground text-center">
        {isStructured 
          ? `${entries?.length} conversation turns detected` 
          : `${transcriptText.length.toLocaleString()} characters`
        }
      </p>
    </div>
  );
}
