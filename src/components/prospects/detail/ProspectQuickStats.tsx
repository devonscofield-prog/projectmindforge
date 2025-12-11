import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Users, Phone, Pencil, Check, X, Flame, GraduationCap, Minus } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import { HeatScoreBadge } from '@/components/ui/heat-score-badge';
import { toast } from 'sonner';
import type { Prospect, ProspectIntel } from '@/api/prospects';

interface ProspectQuickStatsProps {
  prospect: Prospect;
  stakeholderCount: number;
  callCount: number;
  onUpdateProspect?: (updates: Partial<Prospect>) => Promise<boolean>;
}

export function ProspectQuickStats({ prospect, stakeholderCount, callCount, onUpdateProspect }: ProspectQuickStatsProps) {
  const [isEditingRevenue, setIsEditingRevenue] = useState(false);
  const [editedRevenue, setEditedRevenue] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const aiInfo = prospect.ai_extracted_info as ProspectIntel | null;
  const latestHeat = aiInfo?.latest_heat_analysis;
  const coachingTrend = aiInfo?.coaching_trend;

  const handleStartEdit = () => {
    setEditedRevenue(prospect.active_revenue?.toString() || '0');
    setIsEditingRevenue(true);
  };

  const handleCancelEdit = () => {
    setIsEditingRevenue(false);
    setEditedRevenue('');
  };

  const handleSaveRevenue = async () => {
    if (!onUpdateProspect) return;

    const newRevenue = parseFloat(editedRevenue) || 0;
    
    if (newRevenue < 0) {
      toast.error('Invalid amount', {
        description: 'Revenue cannot be negative',
      });
      return;
    }

    setIsSaving(true);
    try {
      const success = await onUpdateProspect({ active_revenue: newRevenue });
      if (success) {
        setIsEditingRevenue(false);
        toast.success('Updated', {
          description: 'Current opportunity amount updated successfully',
        });
      }
    } catch (error) {
      toast.error('Failed to update', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const getGradeColor = (grade: string) => {
    if (grade.startsWith('A')) return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
    if (grade.startsWith('B')) return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
    if (grade.startsWith('C')) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
    return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
  };

  const getTrendIcon = (trend: string) => {
    if (trend === 'Heating Up') return <TrendingUp className="h-3 w-3 text-green-500" />;
    if (trend === 'Cooling Down') return <TrendingDown className="h-3 w-3 text-red-500" />;
    return <Minus className="h-3 w-3 text-muted-foreground" />;
  };

  const getTemperatureColor = (temp: string) => {
    if (temp === 'Hot') return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
    if (temp === 'Warm') return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400';
    if (temp === 'Lukewarm') return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
    return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
  };

  return (
    <Card className="group">
      <CardContent className="p-4">
        <div className="flex flex-wrap items-center gap-6">
          {/* Heat Score with V2 Deal Heat Integration */}
          <div className="flex items-center gap-2">
            {latestHeat ? (
              <div className="flex items-center gap-2">
                <Flame className="h-4 w-4 text-orange-500" />
                <div>
                  <p className="text-xs text-muted-foreground">Deal Heat</p>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold">{latestHeat.score}</span>
                    <Badge variant="secondary" className={getTemperatureColor(latestHeat.temperature)}>
                      {latestHeat.temperature}
                    </Badge>
                    {getTrendIcon(latestHeat.trend)}
                  </div>
                </div>
              </div>
            ) : (
              <HeatScoreBadge score={prospect.heat_score} />
            )}
          </div>

          {/* Coach Grade from V2 */}
          {coachingTrend?.avg_grade && (
            <div className="flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Avg Grade</p>
                <div className="flex items-center gap-1">
                  <Badge variant="secondary" className={getGradeColor(coachingTrend.avg_grade)}>
                    {coachingTrend.avg_grade}
                  </Badge>
                  {coachingTrend.recent_grades && coachingTrend.recent_grades.length > 1 && (
                    <span className="text-xs text-muted-foreground">
                      ({coachingTrend.recent_grades.length} calls)
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
          
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-green-600" />
            <div>
              <p className="text-xs text-muted-foreground">Current Opportunity</p>
              {isEditingRevenue ? (
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="0"
                    step="1000"
                    value={editedRevenue}
                    onChange={(e) => setEditedRevenue(e.target.value)}
                    className="w-32 h-7 text-sm"
                    disabled={isSaving}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveRevenue();
                      if (e.key === 'Escape') handleCancelEdit();
                    }}
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0"
                    onClick={handleSaveRevenue}
                    disabled={isSaving}
                  >
                    <Check className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0"
                    onClick={handleCancelEdit}
                    disabled={isSaving}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <p className="text-lg font-bold text-green-600">{formatCurrency(prospect.active_revenue)}</p>
                  {onUpdateProspect && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={handleStartEdit}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Stakeholders</p>
              <p className="text-lg font-bold">{stakeholderCount}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Total Calls</p>
              <p className="text-lg font-bold">{callCount}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}