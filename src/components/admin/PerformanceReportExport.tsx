import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { FileDown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  getSystemHealth,
  getPerformanceSummary,
  getMetricsTimeline,
} from '@/api/performanceMetrics';
import { getAlertHistory } from '@/api/performanceAlerts';
import { useAuth } from '@/contexts/AuthContext';
import { createLogger } from '@/lib/logger';
// sanitizeHtmlForPdf is now handled internally by pdfExport utility

interface PerformanceReportExportProps {
  className?: string;
}

const logger = createLogger('PerformanceReportExport');

export function PerformanceReportExport({ className }: PerformanceReportExportProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [timeRange, setTimeRange] = useState('24');
  const [isGenerating, setIsGenerating] = useState(false);

  const { data: systemHealth } = useQuery({
    queryKey: ['system-health-report'],
    queryFn: getSystemHealth,
    enabled: open,
  });

  const { data: performanceSummary } = useQuery({
    queryKey: ['performance-summary-report', timeRange],
    queryFn: () => getPerformanceSummary(parseInt(timeRange)),
    enabled: open,
  });

  const { data: metricsTimeline } = useQuery({
    queryKey: ['metrics-timeline-report', timeRange],
    queryFn: () => getMetricsTimeline(parseInt(timeRange)),
    enabled: open,
  });

  const { data: alertHistory } = useQuery({
    queryKey: ['alert-history-report', user?.id],
    queryFn: () => {
      if (!user?.id) return [];
      return getAlertHistory(user.id, 10);
    },
    enabled: open && !!user?.id,
  });

  const generatePDF = async () => {
    setIsGenerating(true);
    
    try {
      const reportContent = generateReportHTML();
      
      // Use secure PDF export utility (replaces vulnerable html2pdf.js)
      const { exportHtmlToPdf } = await import('@/lib/pdfExport');
      
      await exportHtmlToPdf(reportContent, {
        filename: `performance-report-${format(new Date(), 'yyyy-MM-dd')}.pdf`,
        margin: 10,
        format: 'a4',
        orientation: 'portrait',
        scale: 2,
        imageQuality: 0.98,
      });
      
      toast.success('Report exported successfully');
      setOpen(false);
    } catch (error) {
      logger.error('Error generating PDF', { error });
      toast.error('Failed to generate report');
    } finally {
      setIsGenerating(false);
    }
  };

  const generateReportHTML = () => {
    const now = new Date();
    const healthStatus = systemHealth?.overallHealth || 'unknown';
    const healthColor = healthStatus === 'healthy' ? '#10b981' : healthStatus === 'warning' ? '#f59e0b' : '#ef4444';
    
    const timeRangeLabel = {
      '1': 'Last Hour',
      '6': 'Last 6 Hours',
      '24': 'Last 24 Hours',
      '72': 'Last 3 Days',
    }[timeRange] || 'Last 24 Hours';

    return `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto;">
        <!-- Header -->
        <div style="text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #e5e7eb;">
          <h1 style="margin: 0; color: #111827; font-size: 28px;">Performance Report</h1>
          <p style="margin: 8px 0 0; color: #6b7280;">Generated on ${format(now, 'MMMM d, yyyy \'at\' h:mm a')}</p>
          <p style="margin: 4px 0 0; color: #6b7280; font-size: 14px;">Time Range: ${timeRangeLabel}</p>
        </div>

        <!-- Executive Summary -->
        <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin-bottom: 24px;">
          <h2 style="margin: 0 0 16px; color: #111827; font-size: 18px;">Executive Summary</h2>
          <div style="display: flex; gap: 20px; flex-wrap: wrap;">
            <div style="flex: 1; min-width: 150px;">
              <p style="margin: 0; color: #6b7280; font-size: 12px; text-transform: uppercase;">Overall Health</p>
              <p style="margin: 4px 0 0; font-size: 24px; font-weight: bold; color: ${healthColor};">${healthStatus.toUpperCase()}</p>
            </div>
            <div style="flex: 1; min-width: 150px;">
              <p style="margin: 0; color: #6b7280; font-size: 12px; text-transform: uppercase;">Avg Query Time</p>
              <p style="margin: 4px 0 0; font-size: 24px; font-weight: bold; color: #111827;">${systemHealth?.queryHealth?.value?.toFixed(0) || 0}ms</p>
            </div>
            <div style="flex: 1; min-width: 150px;">
              <p style="margin: 0; color: #6b7280; font-size: 12px; text-transform: uppercase;">Avg Edge Function</p>
              <p style="margin: 4px 0 0; font-size: 24px; font-weight: bold; color: #111827;">${systemHealth?.edgeFunctionHealth?.value?.toFixed(0) || 0}ms</p>
            </div>
            <div style="flex: 1; min-width: 150px;">
              <p style="margin: 0; color: #6b7280; font-size: 12px; text-transform: uppercase;">Error Rate</p>
              <p style="margin: 4px 0 0; font-size: 24px; font-weight: bold; color: #111827;">${systemHealth?.errorRateHealth?.value?.toFixed(2) || 0}%</p>
            </div>
          </div>
        </div>

        <!-- Recommendations -->
        ${systemHealth?.recommendation ? `
          <div style="background: ${healthStatus === 'critical' ? '#fef2f2' : '#fffbeb'}; padding: 16px; border-radius: 8px; margin-bottom: 24px; border-left: 4px solid ${healthColor};">
            <h3 style="margin: 0 0 8px; color: #111827; font-size: 14px;">Recommendation</h3>
            <p style="margin: 0; color: #374151;">${systemHealth.recommendation}</p>
          </div>
        ` : ''}

        <!-- Performance Breakdown -->
        <div style="margin-bottom: 24px;">
          <h2 style="margin: 0 0 16px; color: #111827; font-size: 18px;">Performance Breakdown</h2>
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <thead>
              <tr style="background: #f3f4f6;">
                <th style="padding: 12px; text-align: left; border-bottom: 1px solid #e5e7eb;">Metric</th>
                <th style="padding: 12px; text-align: right; border-bottom: 1px solid #e5e7eb;">Avg (ms)</th>
                <th style="padding: 12px; text-align: right; border-bottom: 1px solid #e5e7eb;">P50 (ms)</th>
                <th style="padding: 12px; text-align: right; border-bottom: 1px solid #e5e7eb;">P90 (ms)</th>
                <th style="padding: 12px; text-align: right; border-bottom: 1px solid #e5e7eb;">Count</th>
                <th style="padding: 12px; text-align: right; border-bottom: 1px solid #e5e7eb;">Error %</th>
              </tr>
            </thead>
            <tbody>
              ${(performanceSummary || []).slice(0, 15).map(row => `
                <tr>
                  <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb;">
                    <span style="font-weight: 500;">${row.metric_name}</span>
                    <span style="color: #9ca3af; font-size: 12px; margin-left: 8px;">${row.metric_type}</span>
                  </td>
                  <td style="padding: 10px 12px; text-align: right; border-bottom: 1px solid #e5e7eb;">${row.avg_duration_ms.toFixed(0)}</td>
                  <td style="padding: 10px 12px; text-align: right; border-bottom: 1px solid #e5e7eb;">${row.p50_duration_ms?.toFixed(0) || '-'}</td>
                  <td style="padding: 10px 12px; text-align: right; border-bottom: 1px solid #e5e7eb;">${row.p90_duration_ms?.toFixed(0) || '-'}</td>
                  <td style="padding: 10px 12px; text-align: right; border-bottom: 1px solid #e5e7eb;">${row.total_count}</td>
                  <td style="padding: 10px 12px; text-align: right; border-bottom: 1px solid #e5e7eb; color: ${row.error_rate > 5 ? '#ef4444' : '#111827'};">${row.error_rate.toFixed(1)}%</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <!-- Timeline Summary -->
        ${metricsTimeline && metricsTimeline.length > 0 ? `
          <div style="margin-bottom: 24px;">
            <h2 style="margin: 0 0 16px; color: #111827; font-size: 18px;">Hourly Trends</h2>
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <thead>
                <tr style="background: #f3f4f6;">
                  <th style="padding: 10px 12px; text-align: left; border-bottom: 1px solid #e5e7eb;">Hour</th>
                  <th style="padding: 10px 12px; text-align: right; border-bottom: 1px solid #e5e7eb;">Avg Duration</th>
                  <th style="padding: 10px 12px; text-align: right; border-bottom: 1px solid #e5e7eb;">Requests</th>
                  <th style="padding: 10px 12px; text-align: right; border-bottom: 1px solid #e5e7eb;">Error Rate</th>
                </tr>
              </thead>
              <tbody>
                ${metricsTimeline.slice(-12).map(row => `
                  <tr>
                    <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb;">${format(new Date(row.hour), 'MMM d, h:mm a')}</td>
                    <td style="padding: 8px 12px; text-align: right; border-bottom: 1px solid #e5e7eb;">${row.avg_duration.toFixed(0)}ms</td>
                    <td style="padding: 8px 12px; text-align: right; border-bottom: 1px solid #e5e7eb;">${row.count}</td>
                    <td style="padding: 8px 12px; text-align: right; border-bottom: 1px solid #e5e7eb;">${(row.error_rate * 100).toFixed(1)}%</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : ''}

        <!-- Recent Alerts -->
        ${alertHistory && alertHistory.length > 0 ? `
          <div style="margin-bottom: 24px;">
            <h2 style="margin: 0 0 16px; color: #111827; font-size: 18px;">Recent Alerts</h2>
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <thead>
                <tr style="background: #f3f4f6;">
                  <th style="padding: 10px 12px; text-align: left; border-bottom: 1px solid #e5e7eb;">Time</th>
                  <th style="padding: 10px 12px; text-align: left; border-bottom: 1px solid #e5e7eb;">Type</th>
                  <th style="padding: 10px 12px; text-align: left; border-bottom: 1px solid #e5e7eb;">Metric</th>
                  <th style="padding: 10px 12px; text-align: right; border-bottom: 1px solid #e5e7eb;">Value</th>
                </tr>
              </thead>
              <tbody>
                ${alertHistory.map(alert => `
                  <tr>
                    <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb;">${format(new Date(alert.sent_at), 'MMM d, h:mm a')}</td>
                    <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb;">
                      <span style="background: ${alert.alert_type === 'critical' ? '#fef2f2' : '#fffbeb'}; color: ${alert.alert_type === 'critical' ? '#dc2626' : '#d97706'}; padding: 2px 8px; border-radius: 4px; font-size: 12px; text-transform: uppercase;">${alert.alert_type}</span>
                    </td>
                    <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb;">${alert.metric_type}</td>
                    <td style="padding: 8px 12px; text-align: right; border-bottom: 1px solid #e5e7eb;">${alert.metric_value?.toFixed(1)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : ''}

        <!-- Footer -->
        <div style="text-align: center; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 12px;">
          <p style="margin: 0;">Mindforge • Performance Monitoring Report</p>
          <p style="margin: 4px 0 0;">This report was automatically generated. For real-time data, visit the Performance Monitor dashboard.</p>
        </div>
      </div>
    `;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className={className}>
          <FileDown className="mr-2 h-4 w-4" />
          Export Report
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export Performance Report</DialogTitle>
          <DialogDescription>
            Generate a PDF report for stakeholder reviews with performance metrics and trends.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Time Range</Label>
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Last Hour</SelectItem>
                <SelectItem value="6">Last 6 Hours</SelectItem>
                <SelectItem value="24">Last 24 Hours</SelectItem>
                <SelectItem value="72">Last 3 Days</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-lg border p-4 space-y-2 bg-muted/50">
            <h4 className="font-medium text-sm">Report will include:</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Executive summary with overall health status</li>
              <li>• Performance breakdown by metric type</li>
              <li>• Hourly trends and patterns</li>
              <li>• Recent alert history</li>
              <li>• Recommendations for optimization</li>
            </ul>
          </div>

          <Button onClick={generatePDF} disabled={isGenerating} className="w-full">
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <FileDown className="mr-2 h-4 w-4" />
                Download PDF Report
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
