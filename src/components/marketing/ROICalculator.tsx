import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Calculator, 
  Clock, 
  TrendingUp, 
  DollarSign, 
  Users, 
  Download,
  Target,
  Zap,
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
import { calculateROI, formatCurrency, formatNumber, type ROIInputs } from '@/lib/roiCalculations';

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
    const html2pdf = (await import('html2pdf.js')).default;
    const element = document.getElementById('roi-results');
    if (!element) return;
    
    html2pdf()
      .set({
        margin: 10,
        filename: 'sales-performance-tracker-roi.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      })
      .from(element)
      .save();
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
            <Card className="sticky top-8">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-primary" />
                  Your Team Metrics
                </CardTitle>
                <CardDescription>
                  Enter your current sales team data to calculate potential ROI
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Team Size */}
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <Label htmlFor="teamSize">Team Size</Label>
                    <span className="text-sm font-medium text-primary">{inputs.teamSize} reps</span>
                  </div>
                  <Slider
                    id="teamSize"
                    min={1}
                    max={100}
                    step={1}
                    value={[inputs.teamSize]}
                    onValueChange={([v]) => updateInput('teamSize', v)}
                  />
                </div>

                {/* Average Deal Value */}
                <div className="space-y-2">
                  <Label htmlFor="avgDealValue">Average Deal Value</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="avgDealValue"
                      type="number"
                      value={inputs.avgDealValue}
                      onChange={(e) => updateInput('avgDealValue', Number(e.target.value))}
                      className="pl-9"
                    />
                  </div>
                </div>

                {/* Deals Per Month */}
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <Label htmlFor="dealsPerMonth">Deals/Month/Rep</Label>
                    <span className="text-sm font-medium text-primary">{inputs.dealsPerMonthPerRep}</span>
                  </div>
                  <Slider
                    id="dealsPerMonth"
                    min={1}
                    max={50}
                    step={1}
                    value={[inputs.dealsPerMonthPerRep]}
                    onValueChange={([v]) => updateInput('dealsPerMonthPerRep', v)}
                  />
                </div>

                {/* Current Win Rate */}
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <Label htmlFor="winRate">Current Win Rate</Label>
                    <span className="text-sm font-medium text-primary">{inputs.currentWinRate}%</span>
                  </div>
                  <Slider
                    id="winRate"
                    min={5}
                    max={80}
                    step={1}
                    value={[inputs.currentWinRate]}
                    onValueChange={([v]) => updateInput('currentWinRate', v)}
                  />
                </div>

                {/* Admin Hours */}
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <Label htmlFor="adminHours">Admin Hours/Week/Rep</Label>
                    <span className="text-sm font-medium text-primary">{inputs.adminHoursPerWeek}h</span>
                  </div>
                  <Slider
                    id="adminHours"
                    min={1}
                    max={20}
                    step={1}
                    value={[inputs.adminHoursPerWeek]}
                    onValueChange={([v]) => updateInput('adminHoursPerWeek', v)}
                  />
                </div>

                {/* Coaching Hours */}
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <Label htmlFor="coachingHours">Coaching Hours/Month/Rep</Label>
                    <span className="text-sm font-medium text-primary">{inputs.coachingHoursPerMonth}h</span>
                  </div>
                  <Slider
                    id="coachingHours"
                    min={0}
                    max={20}
                    step={1}
                    value={[inputs.coachingHoursPerMonth]}
                    onValueChange={([v]) => updateInput('coachingHoursPerMonth', v)}
                  />
                </div>

                <Button onClick={() => setInputs(defaultInputs)} variant="outline" className="w-full">
                  Reset to Defaults
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Results Section */}
          <div className="lg:col-span-8 space-y-6" id="roi-results">
            {/* Key Metrics Cards */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-500/20">
                      <Clock className="h-5 w-5 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Hours Saved/Year</p>
                      <p className="text-2xl font-bold">{formatNumber(results.timeSavings.totalMonthlyHours * 12)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-green-500/20">
                      <TrendingUp className="h-5 w-5 text-green-500" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Win Rate Boost</p>
                      <p className="text-2xl font-bold">+{results.winRateImprovement.percentageIncrease}%</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-purple-500/20">
                      <DollarSign className="h-5 w-5 text-purple-500" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Annual Revenue</p>
                      <p className="text-2xl font-bold">{formatCurrency(results.revenueImpact.annualRevenueImpact)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/20">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-amber-500/20">
                      <Zap className="h-5 w-5 text-amber-500" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">ROI</p>
                      <p className="text-2xl font-bold">{results.totalROI.roiPercentage}%</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

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
                    <div className="grid md:grid-cols-2 gap-6">
                      {/* Time Savings */}
                      <div className="space-y-4">
                        <h4 className="font-semibold flex items-center gap-2">
                          <Clock className="h-4 w-4 text-blue-500" />
                          Time Savings
                        </h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Hours saved per rep/month</span>
                            <span className="font-medium">{results.timeSavings.hoursPerRepPerMonth}h</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Total team hours/month</span>
                            <span className="font-medium">{results.timeSavings.totalMonthlyHours}h</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">FTE equivalent freed</span>
                            <span className="font-medium">{results.timeSavings.fteEquivalent}</span>
                          </div>
                          <div className="flex justify-between pt-2 border-t">
                            <span className="font-medium">Annual value</span>
                            <span className="font-bold text-blue-500">{formatCurrency(results.timeSavings.annualValueSaved)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Win Rate Improvement */}
                      <div className="space-y-4">
                        <h4 className="font-semibold flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-green-500" />
                          Win Rate Improvement
                        </h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Win rate increase</span>
                            <span className="font-medium">+{results.winRateImprovement.percentageIncrease}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">New win rate</span>
                            <span className="font-medium">{results.winRateImprovement.newWinRate}%</span>
                          </div>
                          <div className="flex justify-between pt-2 border-t">
                            <span className="font-medium">Additional deals/month</span>
                            <span className="font-bold text-green-500">{results.winRateImprovement.additionalDealsPerMonth}</span>
                          </div>
                        </div>
                      </div>

                      {/* Revenue Impact */}
                      <div className="space-y-4">
                        <h4 className="font-semibold flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-purple-500" />
                          Revenue Impact
                        </h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Additional monthly revenue</span>
                            <span className="font-medium">{formatCurrency(results.revenueImpact.additionalMonthlyRevenue)}</span>
                          </div>
                          <div className="flex justify-between pt-2 border-t">
                            <span className="font-medium">Annual revenue impact</span>
                            <span className="font-bold text-purple-500">{formatCurrency(results.revenueImpact.annualRevenueImpact)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Coaching Efficiency */}
                      <div className="space-y-4">
                        <h4 className="font-semibold flex items-center gap-2">
                          <Users className="h-4 w-4 text-amber-500" />
                          Coaching Efficiency
                        </h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Manager hours freed/month</span>
                            <span className="font-medium">{results.coachingEfficiency.managerHoursFreed}h</span>
                          </div>
                          <div className="flex justify-between pt-2 border-t">
                            <span className="font-medium">Coaching scalability</span>
                            <span className="font-bold text-amber-500">{results.coachingEfficiency.scalabilityMultiplier}x</span>
                          </div>
                        </div>
                      </div>
                    </div>
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
