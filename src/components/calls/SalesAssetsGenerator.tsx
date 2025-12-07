import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { 
  Loader2, 
  Sparkles, 
  Copy, 
  Check, 
  Mail, 
  FileText,
  Users,
  Monitor,
  Save,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { StrategyAudit, SalesAssets, CallMetadata } from '@/utils/analysis-schemas';
import { cn } from '@/lib/utils';

interface SalesAssetsGeneratorProps {
  transcript: string;
  strategicContext: StrategyAudit | null;
  callMetadata?: CallMetadata | null;
  accountName?: string | null;
  stakeholderName?: string | null;
}

// MEDDPICC elements that generate checklist items
const CHECKLIST_ELEMENTS = [
  { key: 'metrics', label: 'Verify Metrics/ROI expectations' },
  { key: 'economic_buyer', label: 'Confirm Economic Buyer identity' },
  { key: 'decision_criteria', label: 'Clarify Decision Criteria' },
  { key: 'decision_process', label: 'Verify Decision Process' },
  { key: 'paper_process', label: 'Understand Paper Process/Procurement' },
  { key: 'implicate_pain', label: 'Quantify Pain Impact' },
  { key: 'champion', label: 'Identify/Develop Champion' },
  { key: 'competition', label: 'Understand Competitive Landscape' },
] as const;

type MEDDPICCKey = typeof CHECKLIST_ELEMENTS[number]['key'];

export function SalesAssetsGenerator({ 
  transcript, 
  strategicContext,
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
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());

  // Generate checklist based on MEDDPICC gaps
  const checklistItems = useMemo(() => {
    if (!strategicContext?.meddpicc?.breakdown) return [];
    
    return CHECKLIST_ELEMENTS.filter(element => {
      const score = strategicContext.meddpicc.breakdown[element.key]?.score ?? 0;
      return score < 60; // Show items that need attention
    }).map(element => ({
      id: element.key,
      label: element.label,
      score: strategicContext.meddpicc.breakdown[element.key]?.score ?? 0,
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
      setEmailBody(result.recap_email.body_html);
      setInternalNotes(result.internal_notes_markdown);
      setCheckedItems(new Set());
      
      toast.success('Sales assets generated successfully!');
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
    const fullEmail = `Subject: ${subjectLine}\n\n${emailBody.replace(/<[^>]*>/g, '')}`;
    copyToClipboard(fullEmail, 'email');
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

  const handleSaveToCRM = () => {
    toast.info('CRM integration coming soon!', {
      description: 'This will save your notes directly to Salesforce.'
    });
  };

  if (!assets) {
    return (
      <Card className="border-dashed">
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
                onClick={handleGenerate}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="subject">Subject Line</Label>
              <Input
                id="subject"
                value={subjectLine}
                onChange={(e) => setSubjectLine(e.target.value)}
                placeholder="Email subject..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="body">Email Body</Label>
              <Textarea
                id="body"
                value={emailBody.replace(/<[^>]*>/g, '')}
                onChange={(e) => setEmailBody(e.target.value)}
                placeholder="Email body..."
                className="min-h-[250px] font-mono text-sm"
              />
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
              
              <Button 
                onClick={handleSaveToCRM}
                variant="secondary"
                className="flex-1 gap-2"
              >
                <Save className="h-4 w-4" />
                Save to CRM
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Right Column - Context & Checklist (1/3 width) */}
      <div className="space-y-6">
        {/* Pre-Send Checklist */}
        {checklistItems.length > 0 && (
          <Card className="border-yellow-500/30 bg-yellow-500/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-yellow-600" />
                Pre-Send Checklist
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Verify these gaps before sending
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
                        "text-sm cursor-pointer",
                        checkedItems.has(item.id) && "line-through text-muted-foreground"
                      )}
                    >
                      {item.label}
                    </label>
                    <Badge 
                      variant="outline" 
                      className={cn(
                        "text-xs mt-1",
                        item.score < 30 
                          ? "border-destructive/50 text-destructive" 
                          : "border-yellow-500/50 text-yellow-600"
                      )}
                    >
                      Score: {item.score}%
                    </Badge>
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
                <span className="text-muted-foreground">Contact: </span>
                <span className="font-medium">{stakeholderName}</span>
              </div>
            )}
            {strategicContext && (
              <div className="pt-2">
                <Badge variant="outline" className="text-xs">
                  MEDDPICC: {strategicContext.meddpicc.overall_score}%
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
