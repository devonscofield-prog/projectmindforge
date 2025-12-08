import { useState, useMemo, useCallback, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { 
  Search, Copy, Check, ChevronUp, ChevronDown, 
  FileText, MessageSquare, Code, ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@/components/ui/toggle-group';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

type ViewMode = 'script' | 'chat' | 'raw';

interface TranscriptEntry {
  speaker: string;
  time?: string;
  text: string;
}

interface TranscriptViewerProps {
  transcriptText: string;
}

const STORAGE_KEY = 'transcript-view-mode';
const COLLAPSE_THRESHOLD = 300; // characters

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
 * Highlights search term in text and returns match positions
 */
function highlightText(text: string, searchTerm: string): React.ReactNode {
  if (!searchTerm.trim()) return text;
  
  const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = text.split(regex);
  
  return parts.map((part, i) => 
    regex.test(part) ? (
      <mark key={i} className="bg-yellow-400/80 dark:bg-yellow-600/80 text-foreground rounded px-0.5">
        {part}
      </mark>
    ) : (
      part
    )
  );
}

/**
 * Gets saved view mode from localStorage
 */
function getSavedViewMode(): ViewMode {
  if (typeof window === 'undefined') return 'script';
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === 'script' || saved === 'chat' || saved === 'raw') {
    return saved;
  }
  return 'script';
}

/**
 * Script format entry component with collapsible long text
 */
function ScriptEntry({ 
  entry, 
  isRep, 
  searchTerm,
  index 
}: { 
  entry: TranscriptEntry; 
  isRep: boolean; 
  searchTerm: string;
  index: number;
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const isLong = entry.text.length > COLLAPSE_THRESHOLD;
  const displayText = isLong && !isExpanded 
    ? entry.text.slice(0, COLLAPSE_THRESHOLD) + '...' 
    : entry.text;

  // Auto-expand if search matches within collapsed portion
  useEffect(() => {
    if (searchTerm && isLong && !isExpanded) {
      const collapsedPortion = entry.text.slice(COLLAPSE_THRESHOLD);
      if (collapsedPortion.toLowerCase().includes(searchTerm.toLowerCase())) {
        setIsExpanded(true);
      }
    }
  }, [searchTerm, entry.text, isLong, isExpanded]);

  return (
    <div 
      className={cn(
        'group py-3 px-4 border-l-4 transition-colors',
        isRep 
          ? 'border-l-primary/70 bg-primary/5 hover:bg-primary/10' 
          : 'border-l-muted-foreground/40 bg-muted/30 hover:bg-muted/50',
        index % 2 === 0 ? '' : 'bg-opacity-50'
      )}
    >
      {/* Speaker Header */}
      <div className="flex items-center gap-2 mb-1.5">
        <span className={cn(
          'font-semibold text-sm uppercase tracking-wide',
          isRep ? 'text-primary' : 'text-muted-foreground'
        )}>
          {entry.speaker}
        </span>
        {entry.time && (
          <span className="text-xs text-muted-foreground/70 font-mono">
            {entry.time}
          </span>
        )}
      </div>
      
      {/* Text Content */}
      <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap pl-0">
        {highlightText(displayText, searchTerm)}
      </p>
      
      {/* Expand/Collapse for long entries */}
      {isLong && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="mt-2 text-xs text-primary hover:text-primary/80 flex items-center gap-1 transition-colors"
        >
          <ChevronRight className={cn('h-3 w-3 transition-transform', isExpanded && 'rotate-90')} />
          {isExpanded ? 'Show less' : `Show ${entry.text.length - COLLAPSE_THRESHOLD} more characters`}
        </button>
      )}
    </div>
  );
}

/**
 * Chat bubble entry component (legacy format)
 */
function ChatEntry({ 
  entry, 
  isRep, 
  searchTerm 
}: { 
  entry: TranscriptEntry; 
  isRep: boolean; 
  searchTerm: string;
}) {
  return (
    <div
      className={cn(
        'flex gap-2 max-w-[85%]',
        isRep ? 'ml-auto flex-row-reverse' : 'mr-auto'
      )}
    >
      <div className={cn(
        'shrink-0 h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold',
        isRep ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
      )}>
        {entry.speaker.charAt(0).toUpperCase()}
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
}

export function TranscriptViewer({ transcriptText }: TranscriptViewerProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>(getSavedViewMode);
  const [currentMatch, setCurrentMatch] = useState(0);
  const { toast } = useToast();

  // Parse transcript into structured format if possible
  const { entries, isStructured } = useMemo(() => {
    const jsonEntries = parseJsonTranscript(transcriptText);
    if (jsonEntries) {
      return { entries: jsonEntries, isStructured: true };
    }
    
    const speakerEntries = parseSpeakerLines(transcriptText);
    if (speakerEntries) {
      return { entries: speakerEntries, isStructured: true };
    }
    
    return { entries: null, isStructured: false };
  }, [transcriptText]);

  // Count search matches
  const matchCount = useMemo(() => {
    if (!searchTerm.trim()) return 0;
    const regex = new RegExp(searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    return (transcriptText.match(regex) || []).length;
  }, [transcriptText, searchTerm]);

  // Reset current match when search changes
  useEffect(() => {
    setCurrentMatch(0);
  }, [searchTerm]);

  // Save view mode preference
  const handleViewModeChange = useCallback((value: string) => {
    if (value === 'script' || value === 'chat' || value === 'raw') {
      setViewMode(value);
      localStorage.setItem(STORAGE_KEY, value);
    }
  }, []);

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

  const navigateMatch = (direction: 'prev' | 'next') => {
    if (matchCount === 0) return;
    if (direction === 'next') {
      setCurrentMatch((prev) => (prev + 1) % matchCount);
    } else {
      setCurrentMatch((prev) => (prev - 1 + matchCount) % matchCount);
    }
    // Note: Actual scroll-to-match would require ref tracking, simplified for now
  };

  return (
    <div className="space-y-4">
      {/* Controls Row */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        {/* Search */}
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search transcript..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 pr-28"
          />
          {searchTerm && matchCount > 0 && (
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              <span className="text-xs text-muted-foreground mr-1">
                {currentMatch + 1}/{matchCount}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => navigateMatch('prev')}
              >
                <ChevronUp className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => navigateMatch('next')}
              >
                <ChevronDown className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>

        {/* View Mode Toggle */}
        {isStructured && (
          <ToggleGroup 
            type="single" 
            value={viewMode} 
            onValueChange={handleViewModeChange}
            className="shrink-0"
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <ToggleGroupItem value="script" aria-label="Script view" className="px-3">
                  <FileText className="h-4 w-4" />
                </ToggleGroupItem>
              </TooltipTrigger>
              <TooltipContent>Script Format</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <ToggleGroupItem value="chat" aria-label="Chat view" className="px-3">
                  <MessageSquare className="h-4 w-4" />
                </ToggleGroupItem>
              </TooltipTrigger>
              <TooltipContent>Chat Bubbles</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <ToggleGroupItem value="raw" aria-label="Raw view" className="px-3">
                  <Code className="h-4 w-4" />
                </ToggleGroupItem>
              </TooltipTrigger>
              <TooltipContent>Raw Text</TooltipContent>
            </Tooltip>
          </ToggleGroup>
        )}

        {/* Copy Button */}
        <Button variant="outline" onClick={handleCopy} className="shrink-0">
          {copied ? (
            <>
              <Check className="h-4 w-4 mr-2" />
              Copied
            </>
          ) : (
            <>
              <Copy className="h-4 w-4 mr-2" />
              Copy
            </>
          )}
        </Button>
      </div>

      {/* Transcript Content */}
      <ScrollArea className="h-[500px] rounded-lg border bg-background">
        {isStructured && entries ? (
          viewMode === 'script' ? (
            // Script Format (Default - Professional)
            <div className="divide-y divide-border/50">
              {entries.map((entry, idx) => (
                <ScriptEntry
                  key={idx}
                  entry={entry}
                  isRep={isRepSpeaker(entry.speaker)}
                  searchTerm={searchTerm}
                  index={idx}
                />
              ))}
            </div>
          ) : viewMode === 'chat' ? (
            // Chat Bubble Format (Legacy)
            <div className="space-y-3 p-4">
              {entries.map((entry, idx) => (
                <ChatEntry
                  key={idx}
                  entry={entry}
                  isRep={isRepSpeaker(entry.speaker)}
                  searchTerm={searchTerm}
                />
              ))}
            </div>
          ) : (
            // Raw Text Format
            <pre className="whitespace-pre-wrap text-sm font-mono text-foreground leading-relaxed p-4">
              {highlightText(transcriptText, searchTerm)}
            </pre>
          )
        ) : (
          // Fallback for unstructured text
          <pre className="whitespace-pre-wrap text-sm font-mono text-foreground leading-relaxed p-4">
            {highlightText(prettifyRawText(transcriptText), searchTerm)}
          </pre>
        )}
      </ScrollArea>

      {/* Footer Info */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {isStructured 
            ? `${entries?.length} conversation turns` 
            : `${transcriptText.length.toLocaleString()} characters`
          }
        </span>
        {isStructured && (
          <span className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-primary/70" />
              Rep
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-muted-foreground/40" />
              Prospect
            </span>
          </span>
        )}
      </div>
    </div>
  );
}
