import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { DollarSign, Target } from 'lucide-react';
import type { ROIInputs } from '@/lib/roiCalculations';

interface ROIInputsPanelProps {
  inputs: ROIInputs;
  onUpdate: <K extends keyof ROIInputs>(key: K, value: ROIInputs[K]) => void;
  onReset: () => void;
}

export function ROIInputsPanel({ inputs, onUpdate, onReset }: ROIInputsPanelProps) {
  return (
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
            onValueChange={([v]) => onUpdate('teamSize', v)}
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
              onChange={(e) => onUpdate('avgDealValue', Number(e.target.value))}
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
            onValueChange={([v]) => onUpdate('dealsPerMonthPerRep', v)}
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
            onValueChange={([v]) => onUpdate('currentWinRate', v)}
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
            onValueChange={([v]) => onUpdate('adminHoursPerWeek', v)}
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
            onValueChange={([v]) => onUpdate('coachingHoursPerMonth', v)}
          />
        </div>

        <Button onClick={onReset} variant="outline" className="w-full">
          Reset to Defaults
        </Button>
      </CardContent>
    </Card>
  );
}
