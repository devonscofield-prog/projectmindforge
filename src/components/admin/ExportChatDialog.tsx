import { useState } from 'react';
import { createLogger } from '@/lib/logger';
// sanitizeHtmlForPdf is now handled internally by pdfExport utility
import { format } from 'date-fns';
import { parseDateOnly } from '@/lib/formatters';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  FormInput,
  FormCheckbox,
  SubmitButton,
} from '@/components/ui/form-fields';
import { ChatMessage } from '@/api/adminTranscriptChat';
import { Download, FileText, File } from 'lucide-react';

const log = createLogger('ExportChatDialog');

interface Transcript {
  id: string;
  call_date: string;
  account_name: string | null;
  call_type: string | null;
  rep_name?: string;
}

interface ExportChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  messages: ChatMessage[];
  selectedTranscripts: Transcript[];
  useRag: boolean;
}

export function ExportChatDialog({
  open,
  onOpenChange,
  messages,
  selectedTranscripts,
  useRag,
}: ExportChatDialogProps) {
  const [exportFormat, setExportFormat] = useState<'markdown' | 'pdf'>('markdown');
  const [includeTranscriptList, setIncludeTranscriptList] = useState(true);
  const [reportTitle, setReportTitle] = useState(
    `Transcript Analysis - ${format(new Date(), 'MMMM d, yyyy')}`
  );
  const [isExporting, setIsExporting] = useState(false);

  const generateMarkdown = (): string => {
    let md = `# ${reportTitle}\n\n`;
    md += `**Generated**: ${format(new Date(), 'MMMM d, yyyy \'at\' h:mm a')}\n`;
    md += `**Analysis Mode**: ${useRag ? 'RAG Mode (Semantic Search)' : 'Direct Analysis'}\n`;
    md += `**Transcripts Analyzed**: ${selectedTranscripts.length}\n\n`;

    if (includeTranscriptList && selectedTranscripts.length > 0) {
      md += `## Selected Transcripts\n\n`;
      selectedTranscripts.forEach((t) => {
        const date = format(parseDateOnly(t.call_date), 'MMM d, yyyy');
        md += `- **${t.account_name || 'Unknown Account'}** (${date}) - ${t.rep_name || 'Unknown Rep'}\n`;
      });
      md += '\n';
    }

    md += `## Analysis\n\n`;
    let questionNum = 0;
    messages.forEach((msg) => {
      if (msg.role === 'user') {
        questionNum++;
        md += `### Question ${questionNum}\n\n> ${msg.content}\n\n`;
      } else {
        md += `**Analysis:**\n\n${msg.content}\n\n---\n\n`;
      }
    });

    return md;
  };

  const exportAsMarkdown = () => {
    const md = generateMarkdown();
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcript-analysis-${format(new Date(), 'yyyy-MM-dd')}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const convertMarkdownToHtml = (md: string): string => {
    let html = md
      .replace(/^# (.+)$/gm, '<h1 style="color: #1a1a1a; margin-bottom: 16px;">$1</h1>')
      .replace(/^## (.+)$/gm, '<h2 style="color: #333; margin-top: 24px; margin-bottom: 12px; border-bottom: 1px solid #ddd; padding-bottom: 8px;">$1</h2>')
      .replace(/^### (.+)$/gm, '<h3 style="color: #444; margin-top: 16px; margin-bottom: 8px;">$1</h3>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/^> (.+)$/gm, '<blockquote style="border-left: 3px solid #6366f1; padding-left: 12px; margin: 12px 0; color: #555; font-style: italic;">$1</blockquote>')
      .replace(/^- (.+)$/gm, '<li style="margin-left: 20px; margin-bottom: 4px;">$1</li>')
      .replace(/^---$/gm, '<hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">')
      .replace(/\n\n/g, '</p><p style="margin-bottom: 12px; line-height: 1.6;">')
      .replace(/\n/g, '<br>');

    return `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; color: #333;">
        <p style="margin-bottom: 12px; line-height: 1.6;">${html}</p>
      </div>
    `;
  };

  const exportAsPdf = async () => {
    setIsExporting(true);
    try {
      const md = generateMarkdown();
      const html = convertMarkdownToHtml(md);
      
      // Use secure PDF export utility (replaces vulnerable html2pdf.js)
      const { exportHtmlToPdf } = await import('@/lib/pdfExport');
      
      await exportHtmlToPdf(html, {
        filename: `transcript-analysis-${format(new Date(), 'yyyy-MM-dd')}.pdf`,
        margin: [15, 15, 15, 15],
        format: 'a4',
        orientation: 'portrait',
        scale: 2,
      });
    } catch (error) {
      log.error('PDF export failed', { error });
    } finally {
      setIsExporting(false);
    }
  };

  const handleExport = async () => {
    if (exportFormat === 'markdown') {
      exportAsMarkdown();
      onOpenChange(false);
    } else {
      await exportAsPdf();
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export Analysis
          </DialogTitle>
          <DialogDescription>
            Save this conversation as a formatted report
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <FormInput
            label="Report Title"
            value={reportTitle}
            onChange={(e) => setReportTitle(e.target.value)}
            placeholder="Enter report title..."
          />

          <div className="space-y-3">
            <Label>Export Format</Label>
            <RadioGroup
              value={exportFormat}
              onValueChange={(v) => setExportFormat(v as 'markdown' | 'pdf')}
              className="grid grid-cols-2 gap-3"
            >
              <div className="flex items-center space-x-2 border rounded-lg p-3 cursor-pointer hover:bg-muted/50 transition-colors">
                <RadioGroupItem value="markdown" id="markdown" />
                <Label htmlFor="markdown" className="flex items-center gap-2 cursor-pointer">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="font-medium">Markdown</div>
                    <div className="text-xs text-muted-foreground">.md file</div>
                  </div>
                </Label>
              </div>
              <div className="flex items-center space-x-2 border rounded-lg p-3 cursor-pointer hover:bg-muted/50 transition-colors">
                <RadioGroupItem value="pdf" id="pdf" />
                <Label htmlFor="pdf" className="flex items-center gap-2 cursor-pointer">
                  <File className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="font-medium">PDF</div>
                    <div className="text-xs text-muted-foreground">.pdf file</div>
                  </div>
                </Label>
              </div>
            </RadioGroup>
          </div>

          <FormCheckbox
            label="Include list of analyzed transcripts"
            checked={includeTranscriptList}
            onCheckedChange={setIncludeTranscriptList}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <SubmitButton
            onClick={handleExport}
            disabled={messages.length === 0}
            isLoading={isExporting}
            loadingText="Exporting..."
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </SubmitButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
