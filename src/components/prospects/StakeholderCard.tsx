import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  User, 
  Crown, 
  Star, 
  ChevronRight,
  Calendar,
  Loader2,
} from 'lucide-react';
import { format } from 'date-fns';
import {
  type Stakeholder,
  type StakeholderInfluenceLevel,
  influenceLevelLabels,
  setPrimaryStakeholder,
} from '@/api/stakeholders';
import { toast } from 'sonner';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface StakeholderCardProps {
  stakeholder: Stakeholder;
  onClick?: () => void;
  onPrimaryChanged?: () => void;
  compact?: boolean;
}

const influenceLevelStyles: Record<StakeholderInfluenceLevel, { bg: string; text: string; icon: React.ElementType }> = {
  final_dm: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-300', icon: Crown },
  secondary_dm: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300', icon: Star },
  heavy_influencer: { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-300', icon: User },
  light_influencer: { bg: 'bg-muted', text: 'text-muted-foreground', icon: User },
  self_pay: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-300', icon: User },
};

function ChampionScoreGauge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-xs text-muted-foreground">—</span>;

  const percentage = (score / 10) * 100;
  let colorClass = 'bg-muted-foreground';
  if (score >= 8) colorClass = 'bg-green-500';
  else if (score >= 6) colorClass = 'bg-yellow-500';
  else if (score >= 4) colorClass = 'bg-orange-500';
  else colorClass = 'bg-red-500';

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden max-w-[80px]">
        <div 
          className={`h-full ${colorClass} transition-all`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="text-sm font-medium">{score}/10</span>
    </div>
  );
}

export function StakeholderCard({ stakeholder, onClick, onPrimaryChanged, compact = false }: StakeholderCardProps) {
  const [isSettingPrimary, setIsSettingPrimary] = useState(false);
  const style = influenceLevelStyles[stakeholder.influence_level];
  const InfluenceIcon = style.icon;

  const handleSetPrimary = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (stakeholder.is_primary_contact) return;
    
    setIsSettingPrimary(true);
    try {
      await setPrimaryStakeholder(stakeholder.prospect_id, stakeholder.id);
      toast.success('Primary contact updated');
      onPrimaryChanged?.();
    } catch (error) {
      toast.error('Failed to set primary contact');
    } finally {
      setIsSettingPrimary(false);
    }
  };

  if (compact) {
    return (
      <button
        onClick={onClick}
        className="flex items-center gap-3 p-2 rounded-lg border hover:bg-muted/50 transition-colors w-full text-left"
      >
        <div className={`p-1.5 rounded-full ${style.bg}`}>
          <InfluenceIcon className={`h-3.5 w-3.5 ${style.text}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{stakeholder.name}</p>
          {stakeholder.job_title && (
            <p className="text-xs text-muted-foreground truncate">{stakeholder.job_title}</p>
          )}
        </div>
        {stakeholder.is_primary_contact ? (
          <Badge variant="outline" className="text-xs shrink-0 gap-1">
            <Crown className="h-3 w-3 text-amber-500" />
            Primary
          </Badge>
        ) : (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={handleSetPrimary}
                  disabled={isSettingPrimary}
                >
                  {isSettingPrimary ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Crown className="h-3.5 w-3.5 text-muted-foreground hover:text-amber-500" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Set as primary contact</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
      </button>
    );
  }

  return (
    <Card 
      className="cursor-pointer hover:shadow-md transition-shadow"
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-full ${style.bg}`}>
              <InfluenceIcon className={`h-5 w-5 ${style.text}`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-semibold">{stakeholder.name}</h4>
                {stakeholder.is_primary_contact ? (
                  <Badge variant="secondary" className="text-xs gap-1">
                    <Crown className="h-3 w-3 text-amber-500" />
                    Primary
                  </Badge>
                ) : (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={handleSetPrimary}
                          disabled={isSettingPrimary}
                        >
                          {isSettingPrimary ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Crown className="h-3.5 w-3.5 text-muted-foreground hover:text-amber-500" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Set as primary contact</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
              {stakeholder.job_title && (
                <p className="text-sm text-muted-foreground">{stakeholder.job_title}</p>
              )}
            </div>
          </div>
          <Badge className={`${style.bg} ${style.text} border-0`}>
            {influenceLevelLabels[stakeholder.influence_level]}
          </Badge>
        </div>

        <div className="space-y-3">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Champion Score</p>
            <ChampionScoreGauge score={stakeholder.champion_score} />
          </div>

          {stakeholder.champion_score_reasoning && (
            <p className="text-sm text-muted-foreground italic line-clamp-2">
              "{stakeholder.champion_score_reasoning}"
            </p>
          )}

          {stakeholder.last_interaction_date && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              Last: {format(new Date(stakeholder.last_interaction_date), 'MMM d, yyyy')}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
