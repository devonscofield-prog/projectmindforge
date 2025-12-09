import { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
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
  Mail, 
  FileText,
  AlertCircle,
  Eye,
  Edit3,
  AlertTriangle,
  ExternalLink,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { StrategyAudit, SalesAssets, CallMetadata, PsychologyProfile } from '@/utils/analysis-schemas';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';

// Required links that should be in every email
const REQUIRED_LINKS = [
  { url: 'https://info.stormwind.com/', label: 'StormWind Website' },
  { url: 'https://info.stormwind.com/training-samples', label: 'Training Samples' }
];

// Placeholders that need to be replaced before sending (prospect-facing only)
const PLACEHOLDERS = [
  '{{ProspectFirstName}}',
  '{{CompanyName}}',
  '{{TopicDiscussed}}'
];

// Convert markdown to Outlook-friendly HTML with inline styles
const formatForOutlook = (markdown: string): string => {
  // Step 1: Convert markdown syntax to HTML tags
  let html = markdown
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") // Escape HTML entities
    .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>') // Bold
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" style="color:#0563C1; text-decoration:underline">$1</a>'); // Links with Outlook blue

  // Step 2: Process blocks separated by double newlines
  html = html.split('\n\n').map(block => {
    const trimmedBlock = block.trim();
    const lines = trimmedBlock.split('\n');
    
    const firstLine = lines[0]?.trim() || '';
    const isHeaderLine = /^<b>[^<]+<\/b>$/.test(firstLine);
    const remainingLines = lines.slice(1);
    const hasListItems = remainingLines.some(l => l.trim().startsWith('* '));
    const hasNonListContent = remainingLines.some(l => l.trim() && !l.trim().startsWith('* '));
    
    // Pattern 1: Header followed by list items only
    if (isHeaderLine && hasListItems && !hasNonListContent) {
      const header = `<p style="margin: 16px 0 6px 0; line-height: 1.5;">${firstLine}</p>`;
      const listItems = remainingLines.filter(l => l.trim().startsWith('* '));
      const list = `<ul style="margin: 0 0 12px 24px; padding-left: 0; line-height: 1.6;">${listItems.map(i => 
        `<li style="margin-bottom: 6px;">${i.trim().replace(/^\* /, '')}</li>`
      ).join('')}</ul>`;
      return header + list;
    }
    
    // Pattern 2: Header followed by paragraph text (like "How We Help:")
    if (isHeaderLine && remainingLines.length > 0 && hasNonListContent) {
      const header = `<p style="margin: 16px 0 6px 0; line-height: 1.5;">${firstLine}</p>`;
      const paragraphText = remainingLines.join(' ').trim();
      const paragraph = `<p style="margin: 0 0 12px 0; line-height: 1.6;">${paragraphText}</p>`;
      return header + paragraph;
    }
    
    // Pattern 3: Pure list block (all lines are list items)
    if (trimmedBlock.startsWith('* ')) {
      const items = lines.filter(l => l.trim().startsWith('* '));
      return `<ul style="margin: 0 0 12px 24px; padding-left: 0; line-height: 1.6;">${items.map(i => 
        `<li style="margin-bottom: 6px;">${i.trim().replace(/^\* /, '')}</li>`
      ).join('')}</ul>`;
    }
    
    // Pattern 4: Section header only (single bold line)
    if (isHeaderLine && lines.length === 1) {
      return `<p style="margin: 16px 0 6px 0; line-height: 1.5;">${firstLine}</p>`;
    }
    
    // Pattern 5: Regular paragraph
    return `<p style="margin: 0 0 12px 0; line-height: 1.6;">${block.replace(/\n/g, '<br>')}</p>`;
  }).join('');

  // Wrap in Outlook default font
  return `<div style="font-family: Calibri, Arial, sans-serif; font-size: 11pt; color: #000000;">${html}</div>`;
};

const REP_PLACEHOLDERS = [
  '{{RepFirstName}}',
  '{{RepLastName}}',
  '{{RepTitle}}',
  '{{RepEmail}}'
];

interface SalesAssetsGeneratorProps {
  callId: string;
  transcript: string;
  strategicContext: StrategyAudit | null;
  psychologyContext?: PsychologyProfile | null;
  callMetadata?: CallMetadata | null;
  accountName?: string | null;
  stakeholderName?: string | null;
  existingAssets?: SalesAssets | null;
}

export function SalesAssetsGenerator({ 
  callId,
  transcript, 
  strategicContext,
  psychologyContext,
  callMetadata,
  accountName,
  stakeholderName,
  existingAssets
}: SalesAssetsGeneratorProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [subjectLine, setSubjectLine] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedNotes, setCopiedNotes] = useState(false);
  const [copiedSubject, setCopiedSubject] = useState(false);
  
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);
  const [emailViewMode, setEmailViewMode] = useState<'edit' | 'preview'>('edit');

  // Load existing assets on mount
  useEffect(() => {
    if (existingAssets) {
      const processedSubject = existingAssets.recap_email?.subject_line || '';
      const processedBody = (existingAssets.recap_email as { body_markdown?: string; body_html?: string })?.body_markdown 
        || (existingAssets.recap_email as { body_html?: string })?.body_html 
        || '';
      
      setSubjectLine(processedSubject);
      setEmailBody(processedBody);
      setInternalNotes(existingAssets.internal_notes_markdown || '');
      setHasGenerated(true);
    }
  }, [existingAssets]);

  // Calculate word/character counts for email body
  const emailStats = useMemo(() => {
    const words = emailBody.split(/\s+/).filter(Boolean).length;
    const chars = emailBody.length;
    return { words, chars };
  }, [emailBody]);

  // Check for missing required links
  const missingLinks = useMemo(() => {
    return REQUIRED_LINKS.filter(link => !emailBody.includes(link.url));
  }, [emailBody]);

  // Check for unreplaced placeholders
  const unreplacedPlaceholders = useMemo(() => {
    return PLACEHOLDERS.filter(p => emailBody.includes(p) || subjectLine.includes(p));
  }, [emailBody, subjectLine]);


  const handleGenerate = async () => {
    if (!transcript) {
      toast.error('No transcript available');
      return;
    }

    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Please sign in to generate assets');
        return;
      }

      const response = await supabase.functions.invoke('generate-sales-assets', {
        body: {
          call_id: callId, // Pass call_id to save to DB
          transcript,
          strategic_context: strategicContext,
          psychology_context: psychologyContext,
          account_name: accountName,
          stakeholder_name: stakeholderName,
        }
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to generate assets');
      }

      const result = response.data as SalesAssets;
      
      // Get raw email content
      let processedSubject = result.recap_email.subject_line;
      let processedBody = (result.recap_email as { body_markdown?: string; body_html?: string }).body_markdown 
        || (result.recap_email as { body_html?: string }).body_html 
        || '';

      // Auto-replace prospect placeholders if we have the data
      if (stakeholderName) {
        const firstName = stakeholderName.split(' ')[0];
        processedSubject = processedSubject.replace(/\{\{ProspectFirstName\}\}/g, firstName);
        processedBody = processedBody.replace(/\{\{ProspectFirstName\}\}/g, firstName);
      }

      if (accountName) {
        processedSubject = processedSubject.replace(/\{\{CompanyName\}\}/g, accountName);
        processedBody = processedBody.replace(/\{\{CompanyName\}\}/g, accountName);
      }

      // Remove Rep placeholders entirely (user will add signature in email client)
      REP_PLACEHOLDERS.forEach(placeholder => {
        processedBody = processedBody.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), '');
      });

      setSubjectLine(processedSubject);
      setEmailBody(processedBody);
      setInternalNotes(result.internal_notes_markdown);
      
      setEmailViewMode('edit');
      setHasGenerated(true);
      
      // Show validation warnings if any
      if (result.validation_warnings && result.validation_warnings.length > 0) {
        toast.warning(`Generated with warnings: ${result.validation_warnings.join(', ')}`);
      } else {
        toast.success('Sales assets generated and saved!');
      }
    } catch (error) {
      console.error('Error generating sales assets:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to generate assets');
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = async (text: string, type: 'email' | 'notes') => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'email') {
        setCopiedEmail(true);
        setTimeout(() => setCopiedEmail(false), 2000);
      } else {
        setCopiedNotes(true);
        setTimeout(() => setCopiedNotes(false), 2000);
      }
      toast.success(`${type === 'email' ? 'Email' : 'Notes'} copied to clipboard`);
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  };

  const copyEmailBody = async () => {
    try {
      const plainText = emailBody;
      const htmlContent = formatForOutlook(emailBody);
      
      // Use ClipboardItem to write both formats for rich text pasting
      const clipboardItem = new ClipboardItem({
        'text/plain': new Blob([plainText], { type: 'text/plain' }),
        'text/html': new Blob([htmlContent], { type: 'text/html' }),
      });
      
      await navigator.clipboard.write([clipboardItem]);
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2000);
      toast.success('Email body copied with formatting!');
    } catch {
      // Fallback to plain text if ClipboardItem not supported
      try {
        await navigator.clipboard.writeText(emailBody);
        setCopiedEmail(true);
        setTimeout(() => setCopiedEmail(false), 2000);
        toast.success('Email body copied (plain text)');
      } catch {
        toast.error('Failed to copy to clipboard');
      }
    }
  };

  const copySubject = async () => {
    try {
      await navigator.clipboard.writeText(subjectLine);
      setCopiedSubject(true);
      setTimeout(() => setCopiedSubject(false), 2000);
      toast.success('Subject line copied');
    } catch {
      toast.error('Failed to copy');
    }
  };


  // Highlight placeholders in preview
  const highlightedEmailBody = useMemo(() => {
    let highlighted = emailBody;
    PLACEHOLDERS.forEach(p => {
      highlighted = highlighted.replace(
        new RegExp(p.replace(/[{}]/g, '\\$&'), 'g'),
        `**⚠️ ${p}**`
      );
    });
    return highlighted;
  }, [emailBody]);


  if (!hasGenerated) {
    return (
      <Card className="border-dashed border-2 border-muted-foreground/25 hover:border-primary/50 transition-colors">
        <CardContent className="flex flex-col items-center justify-center py-12 space-y-4">
          <div className="p-4 rounded-full bg-gradient-to-br from-primary/20 to-primary/5">
            <Sparkles className="h-8 w-8 text-primary" />
          </div>
          <div className="text-center space-y-2">
            <h3 className="font-semibold text-xl">Generate Follow-Up Assets</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              AI will create a personalized recap email and CRM notes using the strategic context from your call analysis
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
                Generate Recap Email & Notes
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
    <div className="space-y-6">
      {/* Main Content */}
      <div className="space-y-6">
        {/* Email Section */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Mail className="h-4 w-4 text-primary" />
                Recap Email
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
                    <AlertDialogTitle>Regenerate assets?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will replace your current email and notes with newly generated content. Any edits you've made will be lost.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={() => {
                        setShowRegenerateConfirm(false);
                        toast.info('Regenerating assets...');
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
            {/* Validation Warnings */}
            {(missingLinks.length > 0 || unreplacedPlaceholders.length > 0) && (
              <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 space-y-2">
                {missingLinks.length > 0 && (
                  <div className="flex items-start gap-2 text-sm text-yellow-600">
                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>Missing required links: {missingLinks.map(l => l.label).join(', ')}</span>
                  </div>
                )}
                {unreplacedPlaceholders.length > 0 && (
                  <div className="flex items-start gap-2 text-sm text-yellow-600">
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>Replace before sending: {unreplacedPlaceholders.join(', ')}</span>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="subject">Subject Line</Label>
              <div className="flex gap-2">
                <Input
                  id="subject"
                  value={subjectLine}
                  onChange={(e) => setSubjectLine(e.target.value)}
                  placeholder="Email subject..."
                  className="flex-1"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={copySubject}
                  className={cn(
                    "shrink-0",
                    copiedSubject && "text-green-600"
                  )}
                  title="Copy subject line"
                >
                  {copiedSubject ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {/* Email Body with Edit/Preview Tabs */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Email Body</Label>
                <span className="text-xs text-muted-foreground">
                  {emailStats.words} words · {emailStats.chars.toLocaleString()} characters
                </span>
              </div>
              
              <Tabs value={emailViewMode} onValueChange={(v) => setEmailViewMode(v as 'edit' | 'preview')}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="edit" className="gap-2">
                    <Edit3 className="h-3.5 w-3.5" />
                    Edit
                  </TabsTrigger>
                  <TabsTrigger value="preview" className="gap-2">
                    <Eye className="h-3.5 w-3.5" />
                    Preview
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="edit" className="mt-2">
                  <Textarea
                    value={emailBody}
                    onChange={(e) => setEmailBody(e.target.value)}
                    placeholder="Email body (Markdown format)..."
                    className="min-h-[300px] font-mono text-sm"
                  />
                </TabsContent>
                
                <TabsContent value="preview" className="mt-2">
                  <div className="min-h-[300px] max-h-[500px] overflow-y-auto p-4 rounded-md border bg-card prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown>{highlightedEmailBody}</ReactMarkdown>
                  </div>
                </TabsContent>
              </Tabs>
            </div>

            {/* Copy Email Body Button */}
            <Button
              onClick={copyEmailBody}
              variant="default"
              className={cn(
                "w-full gap-2",
                copiedEmail && "bg-green-600 hover:bg-green-700"
              )}
            >
              {copiedEmail ? (
                <>
                  <Check className="h-4 w-4" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Copy Email Body
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Internal Notes Section */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              Internal CRM Notes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.target.value)}
              placeholder="Internal notes (Markdown format)..."
              className="min-h-[200px] font-mono text-sm"
            />
            <Button
              onClick={() => copyToClipboard(internalNotes, 'notes')}
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
                  Copy Notes
                </>
              )}
            </Button>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}