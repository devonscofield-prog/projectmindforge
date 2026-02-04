import { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { 
  Loader2, 
  Sparkles, 
  Copy, 
  Check, 
  FileText,
  Eye,
  Edit3,
  RefreshCw,
  Save
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { StrategyAudit, SalesAssets } from '@/utils/analysis-schemas';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';

// Convert markdown to Outlook-friendly HTML using <br> tags for reliable spacing
const formatForOutlook = (markdown: string): string => {
  // Step 1: Convert markdown syntax to HTML tags
  let html = markdown
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" style="color:#0563C1; text-decoration:underline">$1</a>');

  // Step 2: Process blocks separated by double newlines
  const blocks = html.split('\n\n').map(block => {
    const trimmedBlock = block.trim();
    if (!trimmedBlock) return '';
    
    const lines = trimmedBlock.split('\n');
    const firstLine = lines[0]?.trim() || '';
    const isHeaderLine = /^<b>[^<]+<\/b>$/.test(firstLine);
    const remainingLines = lines.slice(1);
    const listItems = remainingLines.filter(l => l.trim().startsWith('* '));
    const nonListLines = remainingLines.filter(l => l.trim() && !l.trim().startsWith('* '));
    
    // Pattern 1: Header followed by list items only
    if (isHeaderLine && listItems.length > 0 && nonListLines.length === 0) {
      const items = listItems.map(i => 
        `&nbsp;&nbsp;&nbsp;• ${i.trim().replace(/^\* /, '')}`
      ).join('<br>');
      return `${firstLine}<br>${items}`;
    }
    
    // Pattern 2: Header followed by paragraph text
    if (isHeaderLine && remainingLines.length > 0 && nonListLines.length > 0) {
      const paragraphContent = remainingLines.map(l => l.trim()).join('<br>');
      return `${firstLine}<br>${paragraphContent}`;
    }
    
    // Pattern 3: Pure list block (all lines are list items)
    if (trimmedBlock.startsWith('* ')) {
      const items = lines.filter(l => l.trim().startsWith('* '));
      return items.map(i => `&nbsp;&nbsp;&nbsp;• ${i.trim().replace(/^\* /, '')}`).join('<br>');
    }
    
    // Pattern 4: Section header only (single bold line)
    if (isHeaderLine && lines.length === 1) {
      return firstLine;
    }
    
    // Pattern 5: Regular paragraph - preserve internal line breaks
    return lines.map(l => l.trim()).join('<br>');
  }).filter(Boolean);

  // Join blocks with double line breaks for section spacing
  const content = blocks.join('<br><br>');

  // Wrap in Outlook-compatible container
  return `<div style="font-family: Calibri, Arial, sans-serif; font-size: 11pt; color: #000000; line-height: 1.5;">${content}</div>`;
};

interface SalesAssetsGeneratorProps {
  callId: string;
  transcript: string;
  strategicContext: StrategyAudit | null;
  accountName?: string | null;
  stakeholderName?: string | null;
  existingAssets?: SalesAssets | null;
}

export function SalesAssetsGenerator({ 
  callId,
  transcript, 
  strategicContext,
  accountName,
  stakeholderName,
  existingAssets
}: SalesAssetsGeneratorProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [internalNotes, setInternalNotes] = useState('');
  const [copiedNotes, setCopiedNotes] = useState(false);
  
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);
  const [notesViewMode, setNotesViewMode] = useState<'edit' | 'preview'>('edit');
  
  // Track initial values for detecting changes
  const [initialNotes, setInitialNotes] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  // Load existing assets on mount
  useEffect(() => {
    if (existingAssets?.internal_notes_markdown) {
      const processedNotes = existingAssets.internal_notes_markdown;
      setInternalNotes(processedNotes);
      setHasGenerated(true);
      setInitialNotes(processedNotes);
    }
  }, [existingAssets]);

  // Detect if there are unsaved changes
  const hasUnsavedChanges = useMemo(() => {
    if (!initialNotes) return false;
    return internalNotes !== initialNotes;
  }, [internalNotes, initialNotes]);

  // Save function to persist changes
  const handleSaveChanges = async () => {
    if (!callId || !hasUnsavedChanges) return;
    
    setIsSaving(true);
    try {
      const updatedAssets = {
        internal_notes_markdown: internalNotes,
      };

      const { error } = await supabase
        .from('ai_call_analysis')
        .update({
          sales_assets: updatedAssets,
          sales_assets_generated_at: new Date().toISOString()
        })
        .eq('call_id', callId);

      if (error) throw error;

      setInitialNotes(internalNotes);
      toast.success('Changes saved!');
    } catch (error) {
      console.error('Error saving notes:', error);
      toast.error('Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerate = async () => {
    if (!transcript) {
      toast.error('No transcript available');
      return;
    }

    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Please sign in to generate notes');
        return;
      }

      const response = await supabase.functions.invoke('generate-sales-assets', {
        body: {
          call_id: callId,
          transcript,
          strategic_context: strategicContext,
          account_name: accountName,
          stakeholder_name: stakeholderName,
        }
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to generate notes');
      }

      const result = response.data as { internal_notes_markdown: string };
      
      setInternalNotes(result.internal_notes_markdown);
      setInitialNotes(result.internal_notes_markdown);
      setNotesViewMode('edit');
      setHasGenerated(true);
      
      toast.success('Call notes generated and saved!');
    } catch (error) {
      console.error('Error generating call notes:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to generate notes');
    } finally {
      setIsLoading(false);
    }
  };

  // Copy notes with rich text formatting
  const copyNotesRichText = async () => {
    try {
      const plainText = internalNotes;
      const htmlContent = formatForOutlook(internalNotes);
      
      const clipboardItem = new ClipboardItem({
        'text/plain': new Blob([plainText], { type: 'text/plain' }),
        'text/html': new Blob([htmlContent], { type: 'text/html' }),
      });
      
      await navigator.clipboard.write([clipboardItem]);
      setCopiedNotes(true);
      setTimeout(() => setCopiedNotes(false), 2000);
      toast.success('Notes copied with formatting!');
    } catch {
      // Fallback to plain text
      try {
        await navigator.clipboard.writeText(internalNotes);
        setCopiedNotes(true);
        setTimeout(() => setCopiedNotes(false), 2000);
        toast.success('Notes copied (plain text)');
      } catch {
        toast.error('Failed to copy to clipboard');
      }
    }
  };

  if (!hasGenerated) {
    return (
      <Card className="border-dashed border-2 border-muted-foreground/25 hover:border-primary/50 transition-colors">
        <CardContent className="flex flex-col items-center justify-center py-12 space-y-4">
          <div className="p-4 rounded-full bg-gradient-to-br from-primary/20 to-primary/5">
            <Sparkles className="h-8 w-8 text-primary" />
          </div>
          <div className="text-center space-y-2">
            <h3 className="font-semibold text-xl">Generate Call Notes</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              AI will create CRM-ready notes using the strategic context from your call analysis
            </p>
          </div>
          <Button 
            onClick={handleGenerate} 
            disabled={isLoading || !transcript}
            size="lg"
            className="gap-2 mt-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="h-5 w-5" />
                Generate Call Notes
              </>
            )}
          </Button>
          {!isLoading && (
            <p className="text-xs text-muted-foreground">Takes about 5-10 seconds</p>
          )}
          {strategicContext && (
            <Badge variant="secondary" className="mt-2">
              Using strategic context for personalization
            </Badge>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Internal Notes Section */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              Internal CRM Notes
            </CardTitle>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setShowRegenerateConfirm(true)}
              disabled={isLoading}
              className="gap-2"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Re-generate
            </Button>

            {/* Regenerate Confirmation Dialog */}
            <AlertDialog open={showRegenerateConfirm} onOpenChange={setShowRegenerateConfirm}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Regenerate notes?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will replace your current notes with newly generated content. Any edits you've made will be lost.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={() => {
                      setShowRegenerateConfirm(false);
                      toast.info('Regenerating notes...');
                      handleGenerate();
                    }}
                  >
                    Regenerate
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs value={notesViewMode} onValueChange={(v) => setNotesViewMode(v as 'edit' | 'preview')} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="edit" className="gap-1.5">
                <Edit3 className="h-3.5 w-3.5" />
                Edit
              </TabsTrigger>
              <TabsTrigger value="preview" className="gap-1.5">
                <Eye className="h-3.5 w-3.5" />
                Preview
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="edit" className="mt-2">
              <Textarea
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
                placeholder="Internal notes (Markdown format)..."
                className="min-h-[300px] font-mono text-sm"
              />
            </TabsContent>
            
            <TabsContent value="preview" className="mt-2">
              <div className="min-h-[300px] max-h-[500px] overflow-y-auto p-4 rounded-md border bg-card prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown>{internalNotes}</ReactMarkdown>
              </div>
            </TabsContent>
          </Tabs>

          <Button
            onClick={copyNotesRichText}
            variant="outline"
            className={cn(
              "w-full gap-2",
              copiedNotes && "text-green-600 border-green-600"
            )}
          >
            {copiedNotes ? (
              <>
                <Check className="h-4 w-4" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Copy Notes (Rich Text)
              </>
            )}
          </Button>

          {/* Save Changes Button */}
          {hasUnsavedChanges && (
            <Button
              onClick={handleSaveChanges}
              disabled={isSaving}
              className="w-full gap-2"
              variant="default"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save Changes
                </>
              )}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
