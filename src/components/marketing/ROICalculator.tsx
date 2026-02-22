import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Calculator,
  Download,
  BarChart3
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { calculateROI, formatCurrency, type ROIInputs } from '@/lib/roiCalculations';

import { ROIInputsPanel } from './ROIInputsPanel';
import { ROIResultsCards } from './ROIResultsCards';
import { ROIBreakdownTab } from './ROIBreakdownTab';

const defaultInputs: ROIInputs = {
  teamSize: 10,
  avgDealValue: 50000,
  dealsPerMonthPerRep: 4,
  currentWinRate: 25,
  adminHoursPerWeek: 8,
  coachingHoursPerMonth: 4,
};

export function ROICalculator() {
  const [inputs, setInputs] = useState<ROIInputs>(defaultInputs);

  const results = useMemo(() => calculateROI(inputs), [inputs]);

  const updateInput = <K extends keyof ROIInputs>(key: K, value: ROIInputs[K]) => {
    setInputs(prev => ({ ...prev, [key]: value }));
  };

  const handleExportPDF = async () => {
    const element = document.getElementById('roi-results');
    if (!element) return;

    const { exportHtmlToPdf } = await import('@/lib/pdfExport');

    await exportHtmlToPdf(element.innerHTML, {
      filename: 'sales-performance-tracker-roi.pdf',
      margin: 10,
      format: 'a4',
      orientation: 'portrait',
      scale: 2,
    });
  };

  const comparisonData = [
    {
      name: 'Admin Hours/Month',
      before: inputs.adminHoursPerWeek * 4 * inputs.teamSize,
      after: inputs.adminHoursPerWeek * 4 * inputs.teamSize * 0.3,
    },
    {
      name: 'Win Rate (%)',
      before: inputs.currentWinRate,
      after: results.winRateImprovement.newWinRate,
    },
    {
      name: 'Deals Won/Month',
      before: (inputs.dealsPerMonthPerRep * inputs.teamSize * inputs.currentWinRate) / 100,
      after: (inputs.dealsPerMonthPerRep * inputs.teamSize * results.winRateImprovement.newWinRate) / 100,
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 py-8 px-4">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium">
            <Calculator className="h-4 w-4" />
            ROI Calculator
          </div>
          <h1 className="text-4xl font-bold tracking-tight">
            Calculate Your Sales Team's ROI
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Estimate the time savings, win rate improvements, and revenue impact of implementing
            our AI-powered Sales Performance Tracker.
          </p>
        </div>

        <div className="grid lg:grid-cols-12 gap-8">
          {/* Input Section */}
          <div className="lg:col-span-4 space-y-6">
            <ROIInputsPanel
              inputs={inputs}
              onUpdate={updateInput}
              onReset={() => setInputs(defaultInputs)}
            />
          </div>

          {/* Results Section */}
          <div className="lg:col-span-8 space-y-6" id="roi-results">
            <ROIResultsCards
              hoursSavedPerYear={results.timeSavings.totalMonthlyHours * 12}
              winRateBoost={results.winRateImprovement.percentageIncrease}
              annualRevenue={results.revenueImpact.annualRevenueImpact}
              roiPercentage={results.totalROI.roiPercentage}
            />

            {/* Detailed Results Tabs */}
            <Card>
              <Tabs defaultValue="projection">
                <CardHeader className="pb-0">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5 text-primary" />
                      Detailed Analysis
                    </CardTitle>
                    <TabsList>
                      <TabsTrigger value="projection">12-Month Projection</TabsTrigger>
                      <TabsTrigger value="comparison">Before vs After</TabsTrigger>
                      <TabsTrigger value="breakdown">Breakdown</TabsTrigger>
                    </TabsList>
                  </div>
                </CardHeader>
                <CardContent className="pt-6">
                  <TabsContent value="projection" className="mt-0">
                    <div className="h-[350px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={results.monthlyProjection}>
                          <defs>
                            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis
                            dataKey="month"
                            tickFormatter={(v) => `M${v}`}
                            className="text-xs"
                          />
                          <YAxis
                            tickFormatter={(v) => formatCurrency(v)}
                            className="text-xs"
                          />
                          <Tooltip
                            formatter={(value: number) => formatCurrency(value)}
                            labelFormatter={(label) => `Month ${label}`}
                            contentStyle={{
                              backgroundColor: 'hsl(var(--card))',
                              border: '1px solid hsl(var(--border))',
                              borderRadius: '8px',
                            }}
                          />
                          <Legend />
                          <Area
                            type="monotone"
                            dataKey="cumulativeValue"
                            name="Cumulative Value"
                            stroke="hsl(var(--primary))"
                            fillOpacity={1}
                            fill="url(#colorValue)"
                            strokeWidth={2}
                          />
                          <Area
                            type="monotone"
                            dataKey="timeSavingsValue"
                            name="Time Savings"
                            stroke="hsl(210, 100%, 50%)"
                            fill="hsl(210, 100%, 50%)"
                            fillOpacity={0.2}
                            strokeWidth={2}
                          />
                          <Area
                            type="monotone"
                            dataKey="revenueValue"
                            name="Revenue Impact"
                            stroke="hsl(142, 76%, 36%)"
                            fill="hsl(142, 76%, 36%)"
                            fillOpacity={0.2}
                            strokeWidth={2}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </TabsContent>

                  <TabsContent value="comparison" className="mt-0">
                    <div className="h-[350px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={comparisonData} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis type="number" className="text-xs" />
                          <YAxis type="category" dataKey="name" width={120} className="text-xs" />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: 'hsl(var(--card))',
                              border: '1px solid hsl(var(--border))',
                              borderRadius: '8px',
                            }}
                          />
                          <Legend />
                          <Bar dataKey="before" name="Before" fill="hsl(var(--muted-foreground))" radius={[0, 4, 4, 0]} />
                          <Bar dataKey="after" name="After" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </TabsContent>

                  <TabsContent value="breakdown" className="mt-0">
                    <ROIBreakdownTab results={results} />
                  </TabsContent>
                </CardContent>
              </Tabs>
            </Card>

            {/* Total ROI Summary */}
            <Card className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-primary/20">
              <CardContent className="pt-6">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
                  <div className="text-center sm:text-left">
                    <h3 className="text-lg font-semibold mb-1">Total First Year Value</h3>
                    <p className="text-4xl font-bold text-primary">{formatCurrency(results.totalROI.year1Value)}</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Payback period: <span className="font-medium">{results.totalROI.paybackPeriodMonths} months</span>
                    </p>
                  </div>
                  <Button onClick={handleExportPDF} size="lg" className="gap-2">
                    <Download className="h-4 w-4" />
                    Export ROI Report
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
