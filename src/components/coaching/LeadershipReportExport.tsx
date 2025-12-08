import { useState } from 'react';
import { format } from 'date-fns';
import { createLogger } from '@/lib/logger';
import { sanitizeHtmlForPdf } from '@/lib/sanitize';

const log = createLogger('LeadershipReportExport');
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
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import {
  Download,
  Share2,
  Copy,
  Mail,
  Loader2,
  FileText,
  Check,
  Building2,
  Globe,
  User,
} from 'lucide-react';
import { CoachingTrendAnalysis, AggregateAnalysisMetadata } from '@/api/aiCallAnalysis';

type AnalysisScope = 'organization' | 'team' | 'rep';

interface LeadershipReportExportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  analysis: CoachingTrendAnalysis;
  metadata?: AggregateAnalysisMetadata;
  dateRange: { from: Date; to: Date };
  scope: AnalysisScope;
  scopeLabel: string;
}

interface ReportSections {
  executiveSummary: boolean;
  frameworkTrends: boolean;
  patternAnalysis: boolean;
  priorities: boolean;
  metadata: boolean;
}

export function LeadershipReportExport({
  open,
  onOpenChange,
  analysis,
  metadata,
  dateRange,
  scope,
  scopeLabel,
}: LeadershipReportExportProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareEmail, setShareEmail] = useState('');
  const [sections, setSections] = useState<ReportSections>({
    executiveSummary: true,
    frameworkTrends: true,
    patternAnalysis: true,
    priorities: true,
    metadata: true,
  });

  const toggleSection = (key: keyof ReportSections) => {
    setSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const getScopeIcon = () => {
    switch (scope) {
      case 'organization': return '🏢';
      case 'team': return '👥';
      case 'rep': return '👤';
    }
  };

  const generatePdfContent = () => {
    const dateRangeStr = `${format(dateRange.from, 'MMM d, yyyy')} - ${format(dateRange.to, 'MMM d, yyyy')}`;
    
    return `
      <div style="font-family: system-ui, -apple-system, sans-serif; padding: 40px; max-width: 900px; margin: 0 auto;">
        <div style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid #0f766e; padding-bottom: 20px;">
          <h1 style="color: #0f766e; margin: 0; font-size: 28px;">Leadership Coaching Report</h1>
          <p style="color: #374151; margin: 12px 0 0 0; font-size: 16px;">
            ${getScopeIcon()} ${scopeLabel} | ${dateRangeStr}
          </p>
          ${metadata ? `
            <p style="color: #6b7280; margin: 8px 0 0 0; font-size: 14px;">
              ${metadata.totalCalls} calls analyzed${scope !== 'rep' ? ` • ${metadata.repsIncluded} reps included` : ''}
            </p>
          ` : ''}
        </div>

        ${sections.executiveSummary ? `
          <div style="background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%); border: 1px solid #bbf7d0; border-radius: 12px; padding: 24px; margin-bottom: 28px;">
            <h2 style="color: #166534; margin: 0 0 16px 0; font-size: 20px;">📋 Executive Summary</h2>
            <p style="margin: 0; line-height: 1.7; font-size: 15px; color: #1f2937;">${analysis.summary}</p>
          </div>
        ` : ''}

        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 28px;">
          <div style="background: #f8fafc; border-radius: 12px; padding: 20px; text-align: center; border: 1px solid #e2e8f0;">
            <div style="font-size: 32px; font-weight: bold; color: #0f172a;">${analysis.periodAnalysis.totalCalls}</div>
            <div style="color: #6b7280; font-size: 14px; margin-top: 4px;">Calls Analyzed</div>
          </div>
          <div style="background: #f8fafc; border-radius: 12px; padding: 20px; text-align: center; border: 1px solid #e2e8f0;">
            <div style="font-size: 32px; font-weight: bold; color: #f97316;">${analysis.periodAnalysis.averageHeatScore?.toFixed(1) || 'N/A'}/10</div>
            <div style="color: #6b7280; font-size: 14px; margin-top: 4px;">Avg Heat Score</div>
          </div>
          <div style="background: #f8fafc; border-radius: 12px; padding: 20px; text-align: center; border: 1px solid #e2e8f0;">
            <div style="font-size: 24px; font-weight: bold; color: ${analysis.periodAnalysis.heatScoreTrend === 'improving' ? '#16a34a' : analysis.periodAnalysis.heatScoreTrend === 'declining' ? '#dc2626' : '#6b7280'};">
              ${analysis.periodAnalysis.heatScoreTrend === 'improving' ? '↑ Improving' : analysis.periodAnalysis.heatScoreTrend === 'declining' ? '↓ Declining' : '→ Stable'}
            </div>
            <div style="color: #6b7280; font-size: 14px; margin-top: 4px;">Heat Trend</div>
          </div>
        </div>

        ${sections.frameworkTrends ? `
          <h2 style="color: #0f172a; font-size: 20px; margin: 28px 0 16px 0;">📊 Framework Performance</h2>
          <div style="display: grid; gap: 16px;">
            ${(['meddpicc', 'gapSelling', 'activeListening'] as const).map(key => {
              const framework = analysis.trendAnalysis[key];
              if (!framework) return '';
              const label = key === 'meddpicc' ? 'MEDDPICC Qualification' : key === 'gapSelling' ? 'Gap Selling' : 'Active Listening';
              const emoji = key === 'meddpicc' ? '🎯' : key === 'gapSelling' ? '💬' : '👂';
              return `
                <div style="background: #f8fafc; border-radius: 12px; padding: 20px; border: 1px solid #e2e8f0;">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                    <h3 style="margin: 0; font-size: 16px;">${emoji} ${label}</h3>
                    <span style="background: ${framework.trend === 'improving' ? '#dcfce7' : framework.trend === 'declining' ? '#fee2e2' : '#f3f4f6'}; color: ${framework.trend === 'improving' ? '#16a34a' : framework.trend === 'declining' ? '#dc2626' : '#6b7280'}; padding: 4px 12px; border-radius: 9999px; font-size: 13px; font-weight: 500;">
                      ${framework.trend === 'improving' ? '↑ Improving' : framework.trend === 'declining' ? '↓ Declining' : '→ Stable'}
                    </span>
                  </div>
                  <p style="margin: 0 0 12px 0; color: #374151; font-size: 14px; line-height: 1.6;">${framework.keyInsight}</p>
                  <div style="display: flex; gap: 24px; padding-top: 12px; border-top: 1px solid #e2e8f0;">
                    <div>
                      <span style="color: #6b7280; font-size: 13px;">Start:</span>
                      <span style="font-weight: 600; margin-left: 4px;">${framework.startingAvg?.toFixed(1) || 'N/A'}/10</span>
                    </div>
                    <div>
                      <span style="color: #6b7280; font-size: 13px;">End:</span>
                      <span style="font-weight: 600; margin-left: 4px;">${framework.endingAvg?.toFixed(1) || 'N/A'}/10</span>
                    </div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        ` : ''}

        ${sections.patternAnalysis ? `
          <h2 style="color: #0f172a; font-size: 20px; margin: 28px 0 16px 0;">🔍 Pattern Analysis</h2>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
            <div style="background: #fef3c7; border-radius: 12px; padding: 20px; border: 1px solid #fcd34d;">
              <h3 style="margin: 0 0 12px 0; font-size: 16px; color: #92400e;">⚠️ Persistent Gaps</h3>
              <ul style="margin: 0; padding-left: 20px; color: #78350f;">
                ${analysis.patternAnalysis.criticalInfoMissing.persistentGaps.length > 0 
                  ? analysis.patternAnalysis.criticalInfoMissing.persistentGaps.map(gap => `<li style="margin-bottom: 6px;">${gap}</li>`).join('')
                  : '<li style="color: #6b7280;">No persistent gaps identified</li>'}
              </ul>
            </div>
            <div style="background: #dbeafe; border-radius: 12px; padding: 20px; border: 1px solid #93c5fd;">
              <h3 style="margin: 0 0 12px 0; font-size: 16px; color: #1e40af;">📈 Follow-up Quality</h3>
              <p style="margin: 0; color: #1e3a8a;">
                Trend: <strong>${analysis.patternAnalysis.followUpQuestions.qualityTrend === 'improving' ? '↑ Improving' : analysis.patternAnalysis.followUpQuestions.qualityTrend === 'declining' ? '↓ Declining' : '→ Stable'}</strong>
              </p>
              ${analysis.patternAnalysis.followUpQuestions.recurringThemes.length > 0 ? `
                <p style="margin: 12px 0 8px 0; font-size: 13px; color: #3b82f6;">Recurring themes:</p>
                <ul style="margin: 0; padding-left: 20px; font-size: 14px; color: #1e3a8a;">
                  ${analysis.patternAnalysis.followUpQuestions.recurringThemes.slice(0, 3).map(t => `<li>${t}</li>`).join('')}
                </ul>
              ` : ''}
            </div>
          </div>
        ` : ''}

        ${sections.priorities ? `
          <h2 style="color: #0f172a; font-size: 20px; margin: 28px 0 16px 0;">🎯 Top Priorities</h2>
          ${analysis.topPriorities.map((priority, index) => `
            <div style="background: linear-gradient(135deg, #fef3c7 0%, #fffbeb 100%); border: 1px solid #fcd34d; border-radius: 12px; padding: 20px; margin-bottom: 12px;">
              <div style="display: flex; align-items: flex-start; gap: 16px;">
                <span style="background: #f59e0b; color: white; border-radius: 50%; min-width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: bold;">${index + 1}</span>
                <div style="flex: 1;">
                  <h3 style="margin: 0 0 8px 0; font-size: 16px; color: #78350f;">${priority.area}</h3>
                  <p style="margin: 0 0 12px 0; color: #92400e; font-size: 14px; line-height: 1.6;">${priority.reason}</p>
                  <div style="background: rgba(245, 158, 11, 0.1); padding: 12px; border-radius: 8px;">
                    <strong style="color: #92400e; font-size: 13px;">Action:</strong>
                    <span style="color: #78350f; font-size: 14px;"> ${priority.actionItem}</span>
                  </div>
                </div>
              </div>
            </div>
          `).join('')}
        ` : ''}

        ${sections.metadata && metadata ? `
          <div style="margin-top: 28px; padding: 16px; background: #f1f5f9; border-radius: 8px; font-size: 13px; color: #64748b;">
            <strong>Analysis Details:</strong>
            ${metadata.tier === 'direct' ? 'Direct analysis of all calls' : 
              metadata.tier === 'sampled' ? `Smart sampling: ${metadata.samplingInfo?.sampledCount} of ${metadata.samplingInfo?.originalCount} calls` :
              `Two-stage hierarchical analysis: ${metadata.hierarchicalInfo?.chunksAnalyzed} chunks`}
          </div>
        ` : ''}

        <div style="margin-top: 40px; padding-top: 20px; border-top: 2px solid #e5e7eb; text-align: center; color: #9ca3af; font-size: 12px;">
          <p style="margin: 0;">Leadership Coaching Report • Generated on ${format(new Date(), 'MMMM d, yyyy')}</p>
          <p style="margin: 4px 0 0 0;">StormWind Sales Hub</p>
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
      const filename = `leadership-report-${scopeLabel.toLowerCase().replace(/\s+/g, '-')}-${dateRangeStr}.pdf`;

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
      toast.success('Leadership report exported');
    } catch (error) {
      log.error('PDF export error', { error });
      toast.error('Failed to export report');
    } finally {
      setIsExporting(false);
    }
  };

  const generateTextSummary = () => {
    const dateRangeStr = `${format(dateRange.from, 'MMM d, yyyy')} - ${format(dateRange.to, 'MMM d, yyyy')}`;
    
    let text = `LEADERSHIP COACHING REPORT
${scopeLabel} | ${dateRangeStr}
${metadata ? `${metadata.totalCalls} calls analyzed${scope !== 'rep' ? ` • ${metadata.repsIncluded} reps included` : ''}` : ''}

`;

    if (sections.executiveSummary) {
      text += `EXECUTIVE SUMMARY
${analysis.summary}

`;
    }

    text += `KEY METRICS
• Calls Analyzed: ${analysis.periodAnalysis.totalCalls}
• Avg Heat Score: ${analysis.periodAnalysis.averageHeatScore?.toFixed(1) || 'N/A'}/10
• Trend: ${analysis.periodAnalysis.heatScoreTrend}

`;

    if (sections.frameworkTrends) {
      const meddpicc = analysis.trendAnalysis.meddpicc;
      text += `FRAMEWORK PERFORMANCE
• MEDDPICC: ${meddpicc?.trend || 'N/A'} (${meddpicc?.startingAvg?.toFixed(1) || 'N/A'} → ${meddpicc?.endingAvg?.toFixed(1) || 'N/A'})
• Gap Selling: ${analysis.trendAnalysis.gapSelling.trend} (${analysis.trendAnalysis.gapSelling.startingAvg?.toFixed(1)} → ${analysis.trendAnalysis.gapSelling.endingAvg?.toFixed(1)})
• Active Listening: ${analysis.trendAnalysis.activeListening.trend} (${analysis.trendAnalysis.activeListening.startingAvg?.toFixed(1)} → ${analysis.trendAnalysis.activeListening.endingAvg?.toFixed(1)})

`;
    }

    if (sections.priorities) {
      text += `TOP PRIORITIES
${analysis.topPriorities.map((p, i) => `${i + 1}. ${p.area}: ${p.actionItem}`).join('\n')}
`;
    }

    return text.trim();
  };

  const handleCopyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(generateTextSummary());
      setCopied(true);
      toast.success('Report copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  const handleShareViaEmail = () => {
    const subject = encodeURIComponent(`Leadership Coaching Report - ${scopeLabel}`);
    const body = encodeURIComponent(generateTextSummary());

    const mailtoUrl = shareEmail 
      ? `mailto:${shareEmail}?subject=${subject}&body=${body}`
      : `mailto:?subject=${subject}&body=${body}`;
    
    window.open(mailtoUrl, '_blank');
    toast.success('Opening email client...');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5 text-primary" />
            Export Leadership Report
          </DialogTitle>
          <DialogDescription>
            Generate a formatted report for leadership review and sharing.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Scope indicator */}
          <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-lg text-sm">
            {scope === 'organization' && <Globe className="h-4 w-4 text-primary" />}
            {scope === 'team' && <Building2 className="h-4 w-4 text-primary" />}
            {scope === 'rep' && <User className="h-4 w-4 text-primary" />}
            <span className="font-medium">{scopeLabel}</span>
            <span className="text-muted-foreground">|</span>
            <span className="text-muted-foreground">
              {format(dateRange.from, 'MMM d')} - {format(dateRange.to, 'MMM d, yyyy')}
            </span>
          </div>

          {/* Section selection */}
          <div>
            <Label className="text-sm font-medium">Include Sections</Label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {[
                { key: 'executiveSummary' as const, label: 'Executive Summary' },
                { key: 'frameworkTrends' as const, label: 'Framework Trends' },
                { key: 'patternAnalysis' as const, label: 'Pattern Analysis' },
                { key: 'priorities' as const, label: 'Top Priorities' },
                { key: 'metadata' as const, label: 'Analysis Metadata' },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center space-x-2">
                  <Checkbox
                    id={key}
                    checked={sections[key]}
                    onCheckedChange={() => toggleSection(key)}
                  />
                  <label htmlFor={key} className="text-sm cursor-pointer">
                    {label}
                  </label>
                </div>
              ))}
            </div>
          </div>

          <Separator />

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
                placeholder="leadership@company.com (optional)"
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
              Opens your email client with a pre-filled report
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
