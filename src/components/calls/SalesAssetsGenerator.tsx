import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Sparkles, Copy, Check, Mail, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { StrategyAudit, SalesAssets } from '@/utils/analysis-schemas';

interface SalesAssetsGeneratorProps {
  transcript: string;
  strategicContext: StrategyAudit | null;
  accountName?: string | null;
  stakeholderName?: string | null;
}

export function SalesAssetsGenerator({ 
  transcript, 
  strategicContext,
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

  if (!assets) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-8 space-y-4">
          <div className="p-3 rounded-full bg-primary/10">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <div className="text-center space-y-2">
            <h3 className="font-semibold text-lg">Generate Follow-Up Assets</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              AI will create a personalized recap email and CRM notes based on the call analysis
            </p>
          </div>
          <Button 
            onClick={handleGenerate} 
            disabled={isLoading || !transcript}
            size="lg"
            className="gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
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
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Generated Sales Assets
          </CardTitle>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleGenerate}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              'Regenerate'
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="email" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="email" className="gap-2">
              <Mail className="h-4 w-4" />
              Recap Email
            </TabsTrigger>
            <TabsTrigger value="notes" className="gap-2">
              <FileText className="h-4 w-4" />
              Internal Notes
            </TabsTrigger>
          </TabsList>

          <TabsContent value="email" className="space-y-4 mt-4">
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
                className="min-h-[300px] font-mono text-sm"
              />
            </div>
            <Button 
              onClick={copyFullEmail}
              variant="outline"
              className="w-full gap-2"
            >
              {copiedEmail ? (
                <>
                  <Check className="h-4 w-4 text-green-500" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Copy Email to Clipboard
                </>
              )}
            </Button>
          </TabsContent>

          <TabsContent value="notes" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="notes">CRM Notes (Markdown)</Label>
              <Textarea
                id="notes"
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
                placeholder="Internal notes..."
                className="min-h-[350px] font-mono text-sm"
              />
            </div>
            <Button 
              onClick={() => copyToClipboard(internalNotes, 'notes')}
              variant="outline"
              className="w-full gap-2"
            >
              {copiedNotes ? (
                <>
                  <Check className="h-4 w-4 text-green-500" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Copy Notes to Clipboard
                </>
              )}
            </Button>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
