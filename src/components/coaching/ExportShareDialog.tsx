import { useState } from 'react';
import { format } from 'date-fns';
import { createLogger } from '@/lib/logger';
import { sanitizeHtmlForPdf } from '@/lib/sanitize';

const log = createLogger('ExportShareDialog');
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  Download,
  Share2,
  Copy,
  Mail,
  Loader2,
  FileText,
  Check,
} from 'lucide-react';
import { CoachingTrendAnalysis, getPrimaryFrameworkTrend, getPrimaryFrameworkLabel } from '@/api/aiCallAnalysis';

interface ExportShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  analysis: CoachingTrendAnalysis;
  dateRange: { from: Date; to: Date };
  repName?: string;
}

export function ExportShareDialog({
  open,
  onOpenChange,
  analysis,
  dateRange,
  repName = 'Rep',
}: ExportShareDialogProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareEmail, setShareEmail] = useState('');

  const generatePdfContent = () => {
    const dateRangeStr = `${format(dateRange.from, 'MMM d, yyyy')} - ${format(dateRange.to, 'MMM d, yyyy')}`;
    
    return `
      <div style="font-family: system-ui, -apple-system, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #0f766e; margin: 0;">Coaching Trends Analysis</h1>
          <p style="color: #6b7280; margin: 8px 0 0 0;">${repName} | ${dateRangeStr}</p>
        </div>

        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
          <h2 style="color: #166534; margin: 0 0 12px 0; font-size: 18px;">Executive Summary</h2>
          <p style="margin: 0; line-height: 1.6;">${analysis.summary}</p>
        </div>

        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 24px;">
          <div style="background: #f8fafc; border-radius: 8px; padding: 16px; text-align: center;">
            <div style="font-size: 24px; font-weight: bold; color: #0f172a;">${analysis.periodAnalysis.totalCalls}</div>
            <div style="color: #6b7280; font-size: 14px;">Calls Analyzed</div>
          </div>
          <div style="background: #f8fafc; border-radius: 8px; padding: 16px; text-align: center;">
            <div style="font-size: 24px; font-weight: bold; color: #f97316;">${analysis.periodAnalysis.averageHeatScore?.toFixed(1) || 'N/A'}/10</div>
            <div style="color: #6b7280; font-size: 14px;">Avg Heat Score</div>
          </div>
          <div style="background: #f8fafc; border-radius: 8px; padding: 16px; text-align: center;">
            <div style="font-size: 24px; font-weight: bold; color: ${analysis.periodAnalysis.heatScoreTrend === 'improving' ? '#16a34a' : analysis.periodAnalysis.heatScoreTrend === 'declining' ? '#dc2626' : '#6b7280'};">
              ${analysis.periodAnalysis.heatScoreTrend === 'improving' ? '↑ Improving' : analysis.periodAnalysis.heatScoreTrend === 'declining' ? '↓ Declining' : '→ Stable'}
            </div>
            <div style="color: #6b7280; font-size: 14px;">Heat Trend</div>
          </div>
        </div>

        <h2 style="color: #0f172a; font-size: 18px; margin: 24px 0 16px 0;">Framework Trends</h2>
        
        ${(() => {
          const primaryLabel = getPrimaryFrameworkLabel(analysis.trendAnalysis);
          const frameworks = [
            { key: 'primary', label: primaryLabel, data: getPrimaryFrameworkTrend(analysis.trendAnalysis) },
            { key: 'gapSelling', label: 'Gap Selling', data: analysis.trendAnalysis.gapSelling },
            { key: 'activeListening', label: 'Active Listening', data: analysis.trendAnalysis.activeListening }
          ];
          return frameworks.map(({ label, data: framework }) => `
            <div style="background: #f8fafc; border-radius: 8px; padding: 16px; margin-bottom: 12px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <h3 style="margin: 0; font-size: 16px;">${label}</h3>
                <span style="color: ${framework.trend === 'improving' ? '#16a34a' : framework.trend === 'declining' ? '#dc2626' : '#6b7280'}; font-weight: 500;">
                  ${framework.trend === 'improving' ? '↑ Improving' : framework.trend === 'declining' ? '↓ Declining' : '→ Stable'}
                </span>
              </div>
              <p style="margin: 0 0 8px 0; color: #374151;">${framework.keyInsight}</p>
              <p style="margin: 0; font-size: 14px; color: #6b7280;">
                Score: ${framework.startingAvg?.toFixed(1) || 'N/A'} → ${framework.endingAvg?.toFixed(1) || 'N/A'}
              </p>
            </div>
          `).join('');
        })()}

        <h2 style="color: #0f172a; font-size: 18px; margin: 24px 0 16px 0;">Top Priorities</h2>
        ${analysis.topPriorities.map((priority, index) => `
          <div style="background: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; padding: 16px; margin-bottom: 12px;">
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
              <span style="background: #f59e0b; color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: bold;">${index + 1}</span>
              <h3 style="margin: 0; font-size: 16px;">${priority.area}</h3>
            </div>
            <p style="margin: 0 0 8px 0; color: #374151;">${priority.reason}</p>
            <p style="margin: 0; font-size: 14px; color: #92400e;"><strong>Action:</strong> ${priority.actionItem}</p>
          </div>
        `).join('')}

        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #9ca3af; font-size: 12px;">
          Generated on ${format(new Date(), 'MMMM d, yyyy')} | StormWind Sales Hub
        </div>
      </div>
    `;
  };

  const handleExportPdf = async () => {
    setIsExporting(true);
    try {
      const html2pdf = (await import('html2pdf.js')).default;
      
      const content = generatePdfContent();
      const container = document.createElement('div');
      // Sanitize HTML for defense-in-depth against XSS
      container.innerHTML = sanitizeHtmlForPdf(content);
      document.body.appendChild(container);

      const dateRangeStr = `${format(dateRange.from, 'MMM-d')}-${format(dateRange.to, 'MMM-d-yyyy')}`;
      const filename = `coaching-trends-${repName.toLowerCase().replace(/\s+/g, '-')}-${dateRangeStr}.pdf`;

      await html2pdf()
        .set({
          margin: 0,
          filename,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' },
        })
        .from(container)
        .save();

      document.body.removeChild(container);
      toast.success('PDF exported successfully');
    } catch (error) {
      log.error('PDF export error', { error });
      toast.error('Failed to export PDF');
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopyToClipboard = async () => {
    const summaryText = `
Coaching Trends Analysis
${repName} | ${format(dateRange.from, 'MMM d, yyyy')} - ${format(dateRange.to, 'MMM d, yyyy')}

EXECUTIVE SUMMARY
${analysis.summary}

KEY METRICS
• Calls Analyzed: ${analysis.periodAnalysis.totalCalls}
• Avg Heat Score: ${analysis.periodAnalysis.averageHeatScore?.toFixed(1) || 'N/A'}/10
• Trend: ${analysis.periodAnalysis.heatScoreTrend}

TOP PRIORITIES
${analysis.topPriorities.map((p, i) => `${i + 1}. ${p.area}: ${p.actionItem}`).join('\n')}
    `.trim();

    try {
      await navigator.clipboard.writeText(summaryText);
      setCopied(true);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  const handleShareViaEmail = () => {
    const subject = encodeURIComponent(`Coaching Trends Analysis - ${repName}`);
    const body = encodeURIComponent(`
Hi,

Here's the coaching trends analysis for ${repName} (${format(dateRange.from, 'MMM d, yyyy')} - ${format(dateRange.to, 'MMM d, yyyy')}):

EXECUTIVE SUMMARY
${analysis.summary}

KEY METRICS
• Calls Analyzed: ${analysis.periodAnalysis.totalCalls}
• Avg Heat Score: ${analysis.periodAnalysis.averageHeatScore?.toFixed(1) || 'N/A'}/10

TOP PRIORITIES
${analysis.topPriorities.map((p, i) => `${i + 1}. ${p.area}: ${p.actionItem}`).join('\n')}

Best regards
    `.trim());

    const mailtoUrl = shareEmail 
      ? `mailto:${shareEmail}?subject=${subject}&body=${body}`
      : `mailto:?subject=${subject}&body=${body}`;
    
    window.open(mailtoUrl, '_blank');
    toast.success('Opening email client...');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5 text-primary" />
            Export & Share
          </DialogTitle>
          <DialogDescription>
            Export your coaching trends analysis or share it with team members.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Export Section */}
          <div>
            <Label className="text-sm font-medium">Export</Label>
            <div className="flex gap-2 mt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleExportPdf}
                disabled={isExporting}
              >
                {isExporting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <FileText className="h-4 w-4 mr-2" />
                )}
                Export PDF
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleCopyToClipboard}
              >
                {copied ? (
                  <Check className="h-4 w-4 mr-2 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4 mr-2" />
                )}
                Copy Text
              </Button>
            </div>
          </div>

          <Separator />

          {/* Share Section */}
          <div>
            <Label className="text-sm font-medium">Share via Email</Label>
            <div className="flex gap-2 mt-2">
              <Input
                type="email"
                placeholder="colleague@company.com (optional)"
                value={shareEmail}
                onChange={(e) => setShareEmail(e.target.value)}
                className="flex-1"
              />
              <Button onClick={handleShareViaEmail}>
                <Mail className="h-4 w-4 mr-2" />
                Send
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Opens your email client with a pre-filled message
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
