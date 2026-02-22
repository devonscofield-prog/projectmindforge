import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeft, Building2, ExternalLink, User, Flame, GraduationCap,
  TrendingUp, TrendingDown, Minus, Users, Phone, Pencil, Check, X,
  Loader2
} from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import { statusLabels } from './constants';
import { useProspectEditing } from './useProspectEditing';
import { ProspectMetadataRow } from './ProspectMetadataRow';
import type { Prospect, ProspectStatus, ProspectIntel } from '@/api/prospects';
import type { Stakeholder } from '@/api/stakeholders';

interface ProspectHeaderProps {
  prospect: Prospect;
  primaryStakeholder: Stakeholder | undefined;
  stakeholderCount: number;
  callCount: number;
  onStatusChange: (status: ProspectStatus) => void;
  onUpdateProspect?: (updates: Partial<Prospect>) => Promise<boolean>;
  repName?: string;
  showRepName?: boolean;
}

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

export function ProspectHeader({
  prospect,
  primaryStakeholder,
  stakeholderCount,
  callCount,
  onStatusChange,
  onUpdateProspect,
  repName,
  showRepName
}: ProspectHeaderProps) {
  const navigate = useNavigate();
  const editing = useProspectEditing(prospect, onUpdateProspect);

  const aiInfo = prospect.ai_extracted_info as ProspectIntel | null;
  const latestHeat = aiInfo?.latest_heat_analysis;
  const coachingTrend = aiInfo?.coaching_trend;

  return (
    <Card className="group">
      <CardContent className="p-4 space-y-3">
        {/* Row 1: Back + Account Name + Status + Salesforce */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <Button
              variant="ghost"
              size="sm"
              className="-ml-2 shrink-0"
              onClick={() => navigate(-1)}
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
            <div className="p-2 rounded-lg bg-primary/10 shrink-0">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                {editing.accountName.isEditing ? (
                  <div className="flex items-center gap-1">
                    <Input
                      type="text"
                      value={editing.accountName.edited}
                      onChange={(e) => editing.accountName.setEdited(e.target.value)}
                      className="h-8 w-[200px] text-lg font-bold"
                      disabled={editing.accountName.isSaving}
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') editing.accountName.save();
                        if (e.key === 'Escape') editing.accountName.cancel();
                      }}
                    />
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={editing.accountName.save} disabled={editing.accountName.isSaving}>
                      {editing.accountName.isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={editing.accountName.cancel} disabled={editing.accountName.isSaving}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 group/name">
                    <h1 className="text-xl font-bold tracking-tight truncate">
                      {prospect.account_name || prospect.prospect_name}
                    </h1>
                    {onUpdateProspect && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 opacity-0 group-hover/name:opacity-100 transition-opacity"
                        onClick={editing.accountName.startEdit}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                )}
                <Select value={prospect.status} onValueChange={(v) => onStatusChange(v as ProspectStatus)}>
                  <SelectTrigger className="w-[100px] h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(statusLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {showRepName && repName && (
                <p className="text-sm text-muted-foreground truncate mt-0.5 flex items-center gap-1">
                  <User className="h-3.5 w-3.5" />
                  <span>Owned by: {repName}</span>
                </p>
              )}
              {primaryStakeholder && (
                <p className="text-sm text-muted-foreground truncate">
                  Primary: {primaryStakeholder.name}
                  {primaryStakeholder.job_title && ` • ${primaryStakeholder.job_title}`}
                </p>
              )}
            </div>
          </div>
          {prospect.salesforce_link && (
            <Button variant="outline" size="sm" asChild className="shrink-0">
              <a href={prospect.salesforce_link} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" />
                Salesforce
              </a>
            </Button>
          )}
        </div>

        {/* Row 2: Key Stats (Heat, Grade, Revenue, Stakeholders, Calls) */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t pt-3">
          {/* Heat Score */}
          {latestHeat ? (
            <div className="flex items-center gap-2">
              <Flame className="h-4 w-4 text-orange-500" />
              <div>
                <p className="text-xs text-muted-foreground">Heat</p>
                <div className="flex items-center gap-1.5">
                  <span className="text-lg font-bold">{latestHeat.score}</span>
                  <Badge variant="secondary" className={`text-xs ${getTemperatureColor(latestHeat.temperature)}`}>
                    {latestHeat.temperature}
                  </Badge>
                  {getTrendIcon(latestHeat.trend)}
                </div>
              </div>
            </div>
          ) : prospect.heat_score !== null && (
            <div className="flex items-center gap-2">
              <Flame className="h-4 w-4 text-orange-500" />
              <div>
                <p className="text-xs text-muted-foreground">Heat</p>
                <span className="text-lg font-bold">{prospect.heat_score}</span>
              </div>
            </div>
          )}

          {/* Coach Grade */}
          {coachingTrend?.avg_grade && (
            <div className="flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Grade</p>
                <Badge variant="secondary" className={getGradeColor(coachingTrend.avg_grade)}>
                  {coachingTrend.avg_grade}
                </Badge>
              </div>
            </div>
          )}

          {/* Revenue - Editable */}
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-green-600" />
            <div>
              <p className="text-xs text-muted-foreground">Opportunity</p>
              {editing.revenue.isEditing ? (
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    min="0"
                    step="1000"
                    value={editing.revenue.edited}
                    onChange={(e) => editing.revenue.setEdited(e.target.value)}
                    className="w-24 h-7 text-sm"
                    disabled={editing.revenue.isSaving}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') editing.revenue.save();
                      if (e.key === 'Escape') editing.revenue.cancel();
                    }}
                  />
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={editing.revenue.save} disabled={editing.revenue.isSaving}>
                    <Check className="h-3 w-3" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={editing.revenue.cancel} disabled={editing.revenue.isSaving}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <span className="text-lg font-bold text-green-600">{formatCurrency(prospect.active_revenue)}</span>
                  {onUpdateProspect && (
                    <Button size="icon" variant="ghost" className="h-5 w-5 opacity-0 group-hover:opacity-100" onClick={editing.revenue.startEdit}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Stakeholders */}
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Stakeholders</p>
              <span className="text-lg font-bold">{stakeholderCount}</span>
            </div>
          </div>

          {/* Calls */}
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Calls</p>
              <span className="text-lg font-bold">{callCount}</span>
            </div>
          </div>
        </div>

        {/* Row 3: Metadata (Created, Last Contact, Industry, Website, Salesforce Link) */}
        <ProspectMetadataRow
          prospect={prospect}
          canEdit={!!onUpdateProspect}
          industry={editing.industry}
          website={editing.website}
          salesforce={editing.salesforce}
          opportunity={editing.opportunity}
        />
      </CardContent>
    </Card>
  );
}
