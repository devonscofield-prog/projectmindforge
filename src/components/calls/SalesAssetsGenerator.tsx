import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
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
  Users,
  Monitor,
  AlertCircle,
  Eye,
  Edit3,
  AlertTriangle,
  ExternalLink
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

// Placeholders that need to be replaced before sending
const PLACEHOLDERS = [
  '{{ProspectFirstName}}',
  '{{CompanyName}}',
  '{{RepFirstName}}',
  '{{RepLastName}}',
  '{{RepTitle}}',
  '{{RepEmail}}',
  '{{TopicDiscussed}}'
];

interface SalesAssetsGeneratorProps {
  transcript: string;
  strategicContext: StrategyAudit | null;
  psychologyContext?: PsychologyProfile | null;
  callMetadata?: CallMetadata | null;
  accountName?: string | null;
  stakeholderName?: string | null;
}

export function SalesAssetsGenerator({ 
  transcript, 
  strategicContext,
  psychologyContext,
  callMetadata,
  accountName,
  stakeholderName 
}: SalesAssetsGeneratorProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [assets, setAssets] = useState<SalesAssets | null>(null);
  const [subjectLine, setSubjectLine] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedNotes, setCopiedNotes] = useState(false);
  const [copiedSubject, setCopiedSubject] = useState(false);
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);
  const [emailViewMode, setEmailViewMode] = useState<'edit' | 'preview'>('edit');

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

  // Generate checklist based on critical gaps with High impact
  const checklistItems = useMemo(() => {
    if (!strategicContext?.critical_gaps) return [];
    
    return strategicContext.critical_gaps
      .filter(gap => gap.impact === 'High' || gap.impact === 'Medium')
      .map((gap, index) => ({
        id: `gap-${index}`,
        label: gap.description,
        category: gap.category,
        impact: gap.impact,
        suggestedQuestion: gap.suggested_question,
      }));
  }, [strategicContext]);

  // User counts from metadata
  const userCounts = useMemo(() => {
    if (!callMetadata?.user_counts) return null;
    return {
      itUsers: callMetadata.user_counts.it_users ?? null,
      endUsers: callMetadata.user_counts.end_users ?? null,
    };
  }, [callMetadata]);

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
      setAssets(result);
      setSubjectLine(result.recap_email.subject_line);
      // Handle both body_markdown (new) and body_html (legacy)
      const body = (result.recap_email as { body_markdown?: string; body_html?: string }).body_markdown 
        || (result.recap_email as { body_html?: string }).body_html 
        || '';
      setEmailBody(body);
      setInternalNotes(result.internal_notes_markdown);
      setCheckedItems(new Set());
      setEmailViewMode('edit');
      
      // Show validation warnings if any
      if (result.validation_warnings && result.validation_warnings.length > 0) {
        toast.warning(`Generated with warnings: ${result.validation_warnings.join(', ')}`);
      } else {
        toast.success('Sales assets generated successfully!');
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

  const copyFullEmail = () => {
    const fullEmail = `Subject: ${subjectLine}\n\n${emailBody}`;
    copyToClipboard(fullEmail, 'email');
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

  const toggleChecked = (id: string) => {
    const newChecked = new Set(checkedItems);
    if (newChecked.has(id)) {
      newChecked.delete(id);
    } else {
      newChecked.add(id);
    }
    setCheckedItems(newChecked);
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


  if (!assets) {
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
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Left Column - The Editor (2/3 width) */}
      <div className="lg:col-span-2 space-y-6">
        {/* Email Section */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Mail className="h-4 w-4 text-primary" />
                Recap Email
              </CardTitle>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setShowRegenerateConfirm(true)}
                disabled={isLoading}
                title="Regenerate assets"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
              </Button>

              {/* Regenerate Confirmation Dialog */}
              <AlertDialog open={showRegenerateConfirm} onOpenChange={setShowRegenerateConfirm}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Regenerate assets?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will replace your edited email and notes with newly generated content. Any changes you've made will be lost.
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
                    <ReactMarkdown
                      components={{
                        a: ({ href, children }) => (
                          <a 
                            href={href} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-primary hover:underline inline-flex items-center gap-1"
                          >
                            {children}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ),
                        strong: ({ children }) => {
                          // Check if this is a placeholder warning
                          const text = String(children);
                          if (text.startsWith('⚠️ {{')) {
                            return (
                              <span className="bg-yellow-200 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 px-1 rounded font-mono text-xs">
                                {text.replace('⚠️ ', '')}
                              </span>
                            );
                          }
                          return <strong>{children}</strong>;
                        }
                      }}
                    >
                      {highlightedEmailBody}
                    </ReactMarkdown>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
            
            {/* Copy Button - Prominent */}
            <Button 
              onClick={copyFullEmail}
              className={cn(
                "w-full gap-2 transition-all",
                copiedEmail && "bg-green-500 hover:bg-green-600"
              )}
            >
              {copiedEmail ? (
                <>
                  <Check className="h-5 w-5" />
                  Copied to Clipboard!
                </>
              ) : (
                <>
                  <Copy className="h-5 w-5" />
                  Copy Email
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Notes Section */}
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
              placeholder="Internal notes..."
              className="min-h-[200px] font-mono text-sm"
            />
            
            <div className="flex gap-3">
              <Button 
                onClick={() => copyToClipboard(internalNotes, 'notes')}
                variant="outline"
                className={cn(
                  "flex-1 gap-2 transition-all",
                  copiedNotes && "border-green-500 text-green-600"
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
              
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Right Column - Context & Checklist (1/3 width) */}
      <div className="space-y-6">
        {/* Pre-Send Checklist - Based on Critical Gaps */}
        {checklistItems.length > 0 && (
          <Card className="border-yellow-500/30 bg-yellow-500/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-yellow-600" />
                Pre-Send Checklist
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Address these gaps before sending
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              {checklistItems.map((item) => (
                <div 
                  key={item.id}
                  className="flex items-start gap-3 p-2 rounded-lg hover:bg-yellow-500/10 transition-colors"
                >
                  <Checkbox
                    id={item.id}
                    checked={checkedItems.has(item.id)}
                    onCheckedChange={() => toggleChecked(item.id)}
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <label 
                      htmlFor={item.id}
                      className={cn(
                        "text-sm cursor-pointer block",
                        checkedItems.has(item.id) && "line-through text-muted-foreground"
                      )}
                    >
                      {item.label}
                    </label>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge 
                        variant="outline" 
                        className={cn(
                          "text-xs",
                          item.impact === 'High' 
                            ? "border-destructive/50 text-destructive" 
                            : "border-yellow-500/50 text-yellow-600"
                        )}
                      >
                        {item.category}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}

              <Separator className="my-3" />
              
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Completed</span>
                <Badge variant="secondary">
                  {checkedItems.size} / {checklistItems.length}
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quick Reference - User Counts */}
        {userCounts && (userCounts.itUsers || userCounts.endUsers) && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Quick Reference</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {userCounts.itUsers && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <Monitor className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">IT Users</p>
                    <p className="font-semibold">{userCounts.itUsers}</p>
                  </div>
                </div>
              )}
              {userCounts.endUsers && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <Users className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">End Users</p>
                    <p className="font-semibold">{userCounts.endUsers}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Account Info */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Account Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {accountName && (
              <div>
                <span className="text-muted-foreground">Account: </span>
                <span className="font-medium">{accountName}</span>
              </div>
            )}
            {stakeholderName && (
              <div>
                <span className="text-muted-foreground">Primary Contact: </span>
                <span className="font-medium">{stakeholderName}</span>
              </div>
            )}
            {psychologyContext?.disc_profile && (
              <div>
                <span className="text-muted-foreground">DISC Profile: </span>
                <Badge variant="outline" className="ml-1">
                  {psychologyContext.disc_profile}
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
