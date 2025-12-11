import { useState, useMemo, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Search, Copy, Check, ChevronUp, ChevronDown, Pencil, X, Save } from 'lucide-react';
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

interface TranscriptViewerProps {
  transcriptText: string;
  canEdit?: boolean;
  onSave?: (newText: string) => void;
  isSaving?: boolean;
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

export function TranscriptViewer({ transcriptText, canEdit = false, onSave, isSaving = false }: TranscriptViewerProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [copied, setCopied] = useState(false);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState(transcriptText);
  const [showSaveWarning, setShowSaveWarning] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Sync editedText when transcriptText changes (e.g., after save)
  useEffect(() => {
    setEditedText(transcriptText);
  }, [transcriptText]);

  // Count search matches
  const matchCount = useMemo(() => {
    if (!searchTerm.trim()) return 0;
    const regex = new RegExp(searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    return (transcriptText.match(regex) || []).length;
  }, [transcriptText, searchTerm]);

  // Reset match index when search term changes
  useEffect(() => {
    setCurrentMatchIndex(0);
  }, [searchTerm]);

  // Scroll to current match when index changes
  useEffect(() => {
    if (!searchTerm.trim() || matchCount === 0) return;
    
    const marks = scrollAreaRef.current?.querySelectorAll('mark');
    if (marks && marks[currentMatchIndex]) {
      marks[currentMatchIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Add visual highlight to current match
      marks.forEach((mark, i) => {
        if (i === currentMatchIndex) {
          mark.classList.add('ring-2', 'ring-primary');
        } else {
          mark.classList.remove('ring-2', 'ring-primary');
        }
      });
    }
  }, [currentMatchIndex, searchTerm, matchCount]);

  const goToNextMatch = () => {
    if (matchCount > 0) {
      setCurrentMatchIndex((prev) => (prev + 1) % matchCount);
    }
  };

  const goToPrevMatch = () => {
    if (matchCount > 0) {
      setCurrentMatchIndex((prev) => (prev - 1 + matchCount) % matchCount);
    }
  };

  // Calculate word count for display text
  const displayText = isEditing ? editedText : transcriptText;
  const wordCount = useMemo(() => {
    return displayText.split(/\s+/).filter(Boolean).length;
  }, [displayText]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(transcriptText);
      setCopied(true);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  const handleStartEdit = () => {
    setEditedText(transcriptText);
    setIsEditing(true);
    setSearchTerm(''); // Clear search when editing
  };

  const handleCancelEdit = () => {
    setEditedText(transcriptText);
    setIsEditing(false);
  };

  const handleSaveClick = () => {
    // Check if text actually changed
    if (editedText.trim() === transcriptText.trim()) {
      setIsEditing(false);
      return;
    }
    setShowSaveWarning(true);
  };

  const handleConfirmSave = () => {
    setShowSaveWarning(false);
    if (onSave) {
      onSave(editedText);
    }
    setIsEditing(false);
  };

  return (
    <div className="space-y-4">
      {/* Search and Controls */}
      <div className="flex flex-col sm:flex-row gap-3">
        {!isEditing ? (
          <>
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search transcript..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-24"
              />
              {searchTerm && matchCount > 0 && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  <span className="text-xs text-muted-foreground">
                    {currentMatchIndex + 1}/{matchCount}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={goToPrevMatch}
                    aria-label="Previous match"
                  >
                    <ChevronUp className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={goToNextMatch}
                    aria-label="Next match"
                  >
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
            <div className="flex gap-2 shrink-0">
              <Button variant="outline" onClick={handleCopy}>
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
              {canEdit && onSave && (
                <Button variant="outline" onClick={handleStartEdit}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              )}
            </div>
          </>
        ) : (
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" onClick={handleCancelEdit} disabled={isSaving}>
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button onClick={handleSaveClick} disabled={isSaving}>
              {isSaving ? (
                <>
                  <span className="animate-spin mr-2">⏳</span>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        )}
      </div>

      {/* Transcript Content */}
      {isEditing ? (
        <Textarea
          value={editedText}
          onChange={(e) => setEditedText(e.target.value)}
          className="min-h-[400px] max-h-[60vh] font-mono text-sm leading-relaxed resize-y"
          placeholder="Enter transcript text..."
          disabled={isSaving}
        />
      ) : (
        <div 
          ref={scrollAreaRef}
          className="max-h-[60vh] md:max-h-[50vh] min-h-[200px] overflow-y-auto rounded-lg border bg-muted/20 p-4"
        >
          <pre className="whitespace-pre-wrap text-sm font-mono text-foreground leading-relaxed">
            {highlightText(transcriptText, searchTerm)}
          </pre>
        </div>
      )}

      {/* Footer */}
      <p className="text-xs text-muted-foreground text-center">
        {wordCount.toLocaleString()} words · {displayText.length.toLocaleString()} characters
      </p>

      {/* Save Warning Dialog */}
      <AlertDialog open={showSaveWarning} onOpenChange={setShowSaveWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Save Transcript Changes?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Editing the transcript will <strong>not</strong> automatically re-run the AI analysis. 
                The existing analysis results will remain based on the original transcript.
              </p>
              <p>
                If you need updated analysis, you can manually re-run it using the "Re-run Analysis" button 
                in the Call Details header after saving.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmSave}>Save Anyway</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
