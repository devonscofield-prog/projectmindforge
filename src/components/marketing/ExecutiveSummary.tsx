import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Download, Printer, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { calculateROI, formatCurrency, ROIInputs } from '@/lib/roiCalculations';

const capabilities = [
  { name: 'AI Call Analysis', description: 'Auto-transcription, scoring & insights' },
  { name: 'Real-Time Sales Coach', description: 'On-demand AI coaching for deal strategy' },
  { name: 'Trend Intelligence', description: 'Track skill development over time' },
  { name: 'Automated Follow-ups', description: 'AI-generated action items & emails' },
  { name: 'Heat Scoring', description: 'Real-time deal health indicators' },
  { name: 'Role-Based Dashboards', description: 'Tailored views for all levels' },
];

const problemSolutions = [
  { challenge: 'Reps spend 30%+ time on admin', impact: 'Lost selling capacity', solution: 'AI auto-generates notes, summaries, emails' },
  { challenge: 'Inconsistent methodology execution', impact: 'Lower win rates', solution: 'Multi-framework scoring on every call' },
  { challenge: '1:8 manager-to-rep coaching ratio', impact: 'Underdeveloped reps', solution: 'AI provides 24/7 personalized coaching' },
  { challenge: 'Deals lost to missed follow-ups', impact: 'Revenue leakage', solution: 'Automated action item generation' },
  { challenge: 'No visibility into call quality', impact: 'Blind spots in pipeline', solution: 'Heat scoring and trend analysis' },
];

const implementationPhases = [
  { phase: 'Week 1-2', activity: 'Platform setup & integration with existing tools' },
  { phase: 'Week 3-4', activity: 'Team onboarding & methodology configuration' },
  { phase: 'Month 2', activity: 'First insights delivered, coaching begins' },
  { phase: 'Month 3+', activity: 'Full ROI realization, continuous improvement' },
];

export function ExecutiveSummary() {
  const [companyName, setCompanyName] = useState('');
  const [_isEditingCompany, _setIsEditingCompany] = useState(false);
  const [roiInputs, setRoiInputs] = useState<ROIInputs>({
    teamSize: 10,
    avgDealValue: 50000,
    dealsPerMonthPerRep: 2,
    currentWinRate: 25,
    adminHoursPerWeek: 8,
    coachingHoursPerMonth: 4,
  });

  const roiResults = calculateROI(roiInputs);
  const currentDate = new Date().toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  const handlePrint = () => {
    window.print();
  };

  const handleExportPDF = async () => {
    const element = document.getElementById('executive-summary-content');
    if (!element) return;

    // Use secure PDF export utility (replaces vulnerable html2pdf.js)
    const { exportHtmlToPdf } = await import('@/lib/pdfExport');
    
    await exportHtmlToPdf(element.innerHTML, {
      filename: `executive-summary${companyName ? `-${companyName.toLowerCase().replace(/\s+/g, '-')}` : ''}.pdf`,
      margin: [8, 8, 8, 8],
      format: 'a4',
      orientation: 'portrait',
      scale: 2,
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header - Hidden when printing */}
      <div className="print:hidden border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/marketing/pitch-deck">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Pitch Deck
              </Button>
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handlePrint} className="gap-2">
              <Printer className="h-4 w-4" />
              Print
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportPDF} className="gap-2">
              <Download className="h-4 w-4" />
              Export PDF
            </Button>
          </div>
        </div>
      </div>

      {/* Customization Panel - Hidden when printing */}
      <div className="print:hidden max-w-4xl mx-auto px-4 py-4 border-b bg-muted/30">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label className="text-xs">Company/Recipient Name</Label>
            <Input
              placeholder="Enter company name"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="h-8 text-sm"
            />
          </div>
          <div>
            <Label className="text-xs">Team Size</Label>
            <Input
              type="number"
              value={roiInputs.teamSize}
              onChange={(e) => setRoiInputs({ ...roiInputs, teamSize: parseInt(e.target.value) || 1 })}
              className="h-8 text-sm"
              min={1}
            />
          </div>
          <div>
            <Label className="text-xs">Avg Deal Value ($)</Label>
            <Input
              type="number"
              value={roiInputs.avgDealValue}
              onChange={(e) => setRoiInputs({ ...roiInputs, avgDealValue: parseInt(e.target.value) || 1000 })}
              className="h-8 text-sm"
              min={1000}
              step={1000}
            />
          </div>
        </div>
      </div>

      {/* Executive Summary Content */}
      <div id="executive-summary-content" className="max-w-4xl mx-auto p-6 print:p-4 print:max-w-none print:text-black">
        {/* Header */}
        <div className="text-center mb-6 print:mb-4 border-b pb-4 print:border-gray-300">
          <h1 className="text-2xl font-bold print:text-xl">Sales Performance Tracker</h1>
          <p className="text-lg font-medium text-primary print:text-gray-700 mt-1">Executive Summary</p>
          <div className="flex items-center justify-center gap-2 mt-2 text-sm text-muted-foreground print:text-gray-500">
            <span>{currentDate}</span>
            {companyName && (
              <>
                <span>•</span>
                <span>Prepared for {companyName}</span>
              </>
            )}
          </div>
        </div>

        {/* Overview */}
        <div className="mb-5 print:mb-4">
          <h2 className="text-sm font-bold uppercase tracking-wide text-primary print:text-gray-700 mb-2 flex items-center gap-2">
            <span className="print:hidden">📋</span> Overview
          </h2>
          <p className="text-sm leading-relaxed print:text-gray-800">
            The Sales Performance Tracker is an AI-powered sales enablement platform that transforms how teams 
            document, learn from, and improve their sales conversations. By automating call analysis, providing 
            real-time coaching, and surfacing actionable insights, the platform helps sales teams reduce administrative 
            burden, improve win rates, and scale coaching effectiveness—resulting in measurable revenue impact.
          </p>
        </div>

        {/* Two Column: Capabilities & Metrics */}
        <div className="grid grid-cols-2 gap-4 mb-5 print:mb-4">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wide text-primary print:text-gray-700 mb-2 flex items-center gap-2">
              <span className="print:hidden">🎯</span> Core Capabilities
            </h2>
            <ul className="space-y-1.5 text-xs">
              {capabilities.map((cap) => (
                <li key={cap.name} className="flex items-start gap-2">
                  <span className="text-primary print:text-gray-700 mt-0.5">•</span>
                  <div>
                    <span className="font-medium">{cap.name}</span>
                    <span className="text-muted-foreground print:text-gray-500"> — {cap.description}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wide text-primary print:text-gray-700 mb-2 flex items-center gap-2">
              <span className="print:hidden">📊</span> Key Metrics
            </h2>
            <div className="space-y-2">
              <Card className="print:border-gray-300">
                <CardContent className="p-3">
                  <div className="text-2xl font-bold text-primary print:text-gray-800">70%</div>
                  <div className="text-xs text-muted-foreground print:text-gray-500">Admin time reduction</div>
                </CardContent>
              </Card>
              <Card className="print:border-gray-300">
                <CardContent className="p-3">
                  <div className="text-2xl font-bold text-primary print:text-gray-800">5-15%</div>
                  <div className="text-xs text-muted-foreground print:text-gray-500">Win rate improvement</div>
                </CardContent>
              </Card>
              <Card className="print:border-gray-300">
                <CardContent className="p-3">
                  <div className="text-2xl font-bold text-primary print:text-gray-800">4x</div>
                  <div className="text-xs text-muted-foreground print:text-gray-500">Coaching scalability</div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        {/* Problems & Solutions Table */}
        <div className="mb-5 print:mb-4">
          <h2 className="text-sm font-bold uppercase tracking-wide text-primary print:text-gray-700 mb-2 flex items-center gap-2">
            <span className="print:hidden">💡</span> Problems Addressed
          </h2>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-muted print:bg-gray-100">
                <th className="text-left p-2 border print:border-gray-300 font-semibold">Challenge</th>
                <th className="text-left p-2 border print:border-gray-300 font-semibold">Impact</th>
                <th className="text-left p-2 border print:border-gray-300 font-semibold">Solution</th>
              </tr>
            </thead>
            <tbody>
              {problemSolutions.map((row, index) => (
                <tr key={index}>
                  <td className="p-2 border print:border-gray-300">{row.challenge}</td>
                  <td className="p-2 border print:border-gray-300 text-muted-foreground print:text-gray-500">{row.impact}</td>
                  <td className="p-2 border print:border-gray-300">{row.solution}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ROI Potential */}
        <div className="mb-5 print:mb-4 p-4 bg-primary/5 rounded-lg print:bg-gray-50 print:border print:border-gray-300">
          <h2 className="text-sm font-bold uppercase tracking-wide text-primary print:text-gray-700 mb-3 flex items-center gap-2">
            <span className="print:hidden">💰</span> ROI Potential
            <span className="text-xs font-normal text-muted-foreground print:text-gray-500">
              (Based on {roiInputs.teamSize} reps, {formatCurrency(roiInputs.avgDealValue)} avg deal)
            </span>
          </h2>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-xl font-bold text-primary print:text-gray-800">
                {formatCurrency(roiResults.timeSavings.annualValueSaved)}
              </div>
              <div className="text-xs text-muted-foreground print:text-gray-500">Annual Time Savings</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-primary print:text-gray-800">
                {formatCurrency(roiResults.revenueImpact.annualRevenueImpact)}
              </div>
              <div className="text-xs text-muted-foreground print:text-gray-500">Additional Revenue/Year</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-primary print:text-gray-800">
                {roiResults.totalROI.paybackPeriodMonths} months
              </div>
              <div className="text-xs text-muted-foreground print:text-gray-500">Payback Period</div>
            </div>
          </div>
          <p className="text-xs text-center text-muted-foreground print:text-gray-500 mt-3">
            Use our detailed ROI Calculator for projections with your specific numbers
          </p>
        </div>

        {/* Implementation Approach */}
        <div className="mb-5 print:mb-4">
          <h2 className="text-sm font-bold uppercase tracking-wide text-primary print:text-gray-700 mb-2 flex items-center gap-2">
            <span className="print:hidden">🚀</span> Implementation Approach
          </h2>
          <div className="grid grid-cols-4 gap-2">
            {implementationPhases.map((phase, index) => (
              <div key={index} className="text-center p-2 border rounded-lg print:border-gray-300">
                <div className="font-semibold text-xs text-primary print:text-gray-700">{phase.phase}</div>
                <div className="text-xs text-muted-foreground print:text-gray-500 mt-1">{phase.activity}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Recommended Next Steps */}
        <div className="border-2 border-primary/30 rounded-lg p-4 print:border-gray-400">
          <h2 className="text-sm font-bold uppercase tracking-wide text-primary print:text-gray-700 mb-3 flex items-center gap-2">
            <span className="print:hidden">✅</span> Recommended Next Steps
          </h2>
          <ol className="space-y-2 text-sm">
            <li className="flex items-start gap-2">
              <span className="font-bold text-primary print:text-gray-700">1.</span>
              <span>Review the detailed <strong>ROI Calculator</strong> with your team's specific numbers</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-primary print:text-gray-700">2.</span>
              <span>Schedule a <strong>demo session</strong> with key stakeholders (sales leadership, ops, IT)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-primary print:text-gray-700">3.</span>
              <span>Define a <strong>pilot team</strong> or use case to measure impact before full rollout</span>
            </li>
          </ol>
        </div>

        {/* Footer */}
        <div className="mt-4 pt-3 border-t print:border-gray-300 text-center text-xs text-muted-foreground print:text-gray-500">
          <p>Questions? Contact the project team for a personalized walkthrough.</p>
        </div>
      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
          @page {
            size: A4;
            margin: 0.5cm;
          }
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .print\\:hidden {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
