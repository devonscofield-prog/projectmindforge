import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { Search, Copy, Check } from 'lucide-react';

interface TranscriptViewerProps {
  transcriptText: string;
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
      <mark key={i} className="bg-yellow-400/80 dark:bg-yellow-600/80 text-foreground rounded px-0.5">
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

  // Count search matches
  const matchCount = useMemo(() => {
    if (!searchTerm.trim()) return 0;
    const regex = new RegExp(searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    return (transcriptText.match(regex) || []).length;
  }, [transcriptText, searchTerm]);

  // Calculate word count
  const wordCount = useMemo(() => {
    return transcriptText.split(/\s+/).filter(Boolean).length;
  }, [transcriptText]);

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
              Copy
            </>
          )}
        </Button>
      </div>

      {/* Raw Transcript Content */}
      <ScrollArea className="max-h-[50vh] min-h-[200px] rounded-lg border bg-muted/20 p-4">
        <pre className="whitespace-pre-wrap text-sm font-mono text-foreground leading-relaxed">
          {highlightText(transcriptText, searchTerm)}
        </pre>
      </ScrollArea>

      {/* Footer */}
      <p className="text-xs text-muted-foreground text-center">
        {wordCount.toLocaleString()} words · {transcriptText.length.toLocaleString()} characters
      </p>
    </div>
  );
}
