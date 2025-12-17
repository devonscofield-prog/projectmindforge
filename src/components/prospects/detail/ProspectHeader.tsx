import { useState } from 'react';
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
  Globe, Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/formatters';
import { statusLabels, industryOptions } from './constants';
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

  // Revenue editing state
  const [isEditingRevenue, setIsEditingRevenue] = useState(false);
  const [editedRevenue, setEditedRevenue] = useState('');
  const [isSavingRevenue, setIsSavingRevenue] = useState(false);

  // Industry editing state
  const [isEditingIndustry, setIsEditingIndustry] = useState(false);
  const [editedIndustry, setEditedIndustry] = useState('');
  const [isSavingIndustry, setIsSavingIndustry] = useState(false);

  // Website editing state
  const [isEditingWebsite, setIsEditingWebsite] = useState(false);
  const [editedWebsite, setEditedWebsite] = useState('');
  const [isSavingWebsite, setIsSavingWebsite] = useState(false);

  // Salesforce link editing state
  const [isEditingSalesforce, setIsEditingSalesforce] = useState(false);
  const [editedSalesforce, setEditedSalesforce] = useState('');
  const [isSavingSalesforce, setIsSavingSalesforce] = useState(false);

  // Opportunity link editing state
  const [isEditingOpportunity, setIsEditingOpportunity] = useState(false);
  const [editedOpportunity, setEditedOpportunity] = useState('');
  const [isSavingOpportunity, setIsSavingOpportunity] = useState(false);

  // Account name editing state
  const [isEditingAccountName, setIsEditingAccountName] = useState(false);
  const [editedAccountName, setEditedAccountName] = useState('');
  const [isSavingAccountName, setIsSavingAccountName] = useState(false);

  const aiInfo = prospect.ai_extracted_info as ProspectIntel | null;
  const latestHeat = aiInfo?.latest_heat_analysis;
  const coachingTrend = aiInfo?.coaching_trend;

  // Revenue handlers
  const handleStartEditRevenue = () => {
    setEditedRevenue(prospect.active_revenue?.toString() || '0');
    setIsEditingRevenue(true);
  };

  const handleSaveRevenue = async () => {
    if (!onUpdateProspect) return;
    const newRevenue = parseFloat(editedRevenue) || 0;
    if (newRevenue < 0) {
      toast.error('Revenue cannot be negative');
      return;
    }
    setIsSavingRevenue(true);
    try {
      const success = await onUpdateProspect({ active_revenue: newRevenue });
      if (success) {
        setIsEditingRevenue(false);
        toast.success('Opportunity updated');
      }
    } finally {
      setIsSavingRevenue(false);
    }
  };

  // Industry handlers
  const handleSaveIndustry = async () => {
    if (!onUpdateProspect) return;
    setIsSavingIndustry(true);
    try {
      const success = await onUpdateProspect({ industry: editedIndustry || null });
      if (success) {
        setIsEditingIndustry(false);
        toast.success('Industry updated');
      }
    } finally {
      setIsSavingIndustry(false);
    }
  };

  // Website handlers
  const handleSaveWebsite = async () => {
    if (!onUpdateProspect) return;
    setIsSavingWebsite(true);
    try {
      const success = await onUpdateProspect({ website: editedWebsite || null });
      if (success) {
        setIsEditingWebsite(false);
        toast.success('Website updated');
      }
    } finally {
      setIsSavingWebsite(false);
    }
  };

  // Salesforce handlers
  const handleSaveSalesforce = async () => {
    if (!onUpdateProspect) return;
    setIsSavingSalesforce(true);
    try {
      const success = await onUpdateProspect({ salesforce_link: editedSalesforce || null });
      if (success) {
        setIsEditingSalesforce(false);
        toast.success('Salesforce link updated');
      }
    } finally {
      setIsSavingSalesforce(false);
    }
  };

  // Opportunity link handlers
  const handleSaveOpportunity = async () => {
    if (!onUpdateProspect) return;
    setIsSavingOpportunity(true);
    try {
      const success = await onUpdateProspect({ opportunity_link: editedOpportunity || null });
      if (success) {
        setIsEditingOpportunity(false);
        toast.success('Opportunity link updated');
      }
    } finally {
      setIsSavingOpportunity(false);
    }
  };

  // Account name handlers
  const handleStartEditAccountName = () => {
    setEditedAccountName(prospect.account_name || prospect.prospect_name || '');
    setIsEditingAccountName(true);
  };

  const handleSaveAccountName = async () => {
    if (!onUpdateProspect) return;
    const trimmed = editedAccountName.trim();
    if (!trimmed) {
      toast.error('Account name cannot be empty');
      return;
    }
    setIsSavingAccountName(true);
    try {
      const success = await onUpdateProspect({ account_name: trimmed });
      if (success) {
        setIsEditingAccountName(false);
        toast.success('Account name updated');
      }
    } finally {
      setIsSavingAccountName(false);
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
                {isEditingAccountName ? (
                  <div className="flex items-center gap-1">
                    <Input
                      type="text"
                      value={editedAccountName}
                      onChange={(e) => setEditedAccountName(e.target.value)}
                      className="h-8 w-[200px] text-lg font-bold"
                      disabled={isSavingAccountName}
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveAccountName();
                        if (e.key === 'Escape') setIsEditingAccountName(false);
                      }}
                    />
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleSaveAccountName} disabled={isSavingAccountName}>
                      {isSavingAccountName ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setIsEditingAccountName(false)} disabled={isSavingAccountName}>
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
                        onClick={handleStartEditAccountName}
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
              {isEditingRevenue ? (
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    min="0"
                    step="1000"
                    value={editedRevenue}
                    onChange={(e) => setEditedRevenue(e.target.value)}
                    className="w-24 h-7 text-sm"
                    disabled={isSavingRevenue}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveRevenue();
                      if (e.key === 'Escape') setIsEditingRevenue(false);
                    }}
                  />
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleSaveRevenue} disabled={isSavingRevenue}>
                    <Check className="h-3 w-3" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setIsEditingRevenue(false)} disabled={isSavingRevenue}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <span className="text-lg font-bold text-green-600">{formatCurrency(prospect.active_revenue)}</span>
                  {onUpdateProspect && (
                    <Button size="icon" variant="ghost" className="h-5 w-5 opacity-0 group-hover:opacity-100" onClick={handleStartEditRevenue}>
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
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm border-t pt-3">
          {/* Created */}
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <span className="font-medium">Created:</span>
            <span>{format(new Date(prospect.created_at), 'MMM d, yyyy')}</span>
          </div>
          <span className="hidden sm:block text-muted-foreground/40">|</span>

          {/* Last Contact */}
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <span className="font-medium">Last Contact:</span>
            <span>{prospect.last_contact_date ? format(new Date(prospect.last_contact_date), 'MMM d, yyyy') : '—'}</span>
          </div>
          <span className="hidden sm:block text-muted-foreground/40">|</span>

          {/* Industry - Editable */}
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-muted-foreground">Industry:</span>
            {isEditingIndustry ? (
              <div className="flex items-center gap-1">
                <Select value={editedIndustry} onValueChange={setEditedIndustry} disabled={isSavingIndustry}>
                  <SelectTrigger className="h-7 w-[130px] text-xs">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {industryOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleSaveIndustry} disabled={isSavingIndustry}>
                  {isSavingIndustry ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                </Button>
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setIsEditingIndustry(false)} disabled={isSavingIndustry}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                {prospect.industry ? (
                  <Badge variant="secondary" className="text-xs h-6">
                    {industryOptions.find(o => o.value === prospect.industry)?.label || prospect.industry}
                  </Badge>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
                {onUpdateProspect && (
                  <Button size="icon" variant="ghost" className="h-5 w-5 opacity-60 hover:opacity-100" onClick={() => { setEditedIndustry(prospect.industry || ''); setIsEditingIndustry(true); }}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                )}
              </div>
            )}
          </div>
          <span className="hidden sm:block text-muted-foreground/40">|</span>

          {/* Website - Editable */}
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-muted-foreground">Web:</span>
            {isEditingWebsite ? (
              <div className="flex items-center gap-1">
                <Input
                  type="url"
                  placeholder="https://..."
                  value={editedWebsite}
                  onChange={(e) => setEditedWebsite(e.target.value)}
                  className="h-7 w-[140px] text-xs"
                  disabled={isSavingWebsite}
                />
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleSaveWebsite} disabled={isSavingWebsite}>
                  {isSavingWebsite ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                </Button>
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setIsEditingWebsite(false)} disabled={isSavingWebsite}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                {prospect.website ? (
                  <a href={prospect.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1 text-xs max-w-[100px] truncate">
                    <Globe className="h-3 w-3 shrink-0" />
                    <span className="truncate">{prospect.website.replace(/^https?:\/\//, '')}</span>
                  </a>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
                {onUpdateProspect && (
                  <Button size="icon" variant="ghost" className="h-5 w-5 opacity-60 hover:opacity-100" onClick={() => { setEditedWebsite(prospect.website || ''); setIsEditingWebsite(true); }}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                )}
              </div>
            )}
          </div>
          <span className="hidden sm:block text-muted-foreground/40">|</span>

          {/* Salesforce - Editable */}
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-muted-foreground">SF:</span>
            {isEditingSalesforce ? (
              <div className="flex items-center gap-1">
                <Input
                  type="url"
                  placeholder="https://..."
                  value={editedSalesforce}
                  onChange={(e) => setEditedSalesforce(e.target.value)}
                  className="h-7 w-[140px] text-xs"
                  disabled={isSavingSalesforce}
                />
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleSaveSalesforce} disabled={isSavingSalesforce}>
                  {isSavingSalesforce ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                </Button>
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setIsEditingSalesforce(false)} disabled={isSavingSalesforce}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                {prospect.salesforce_link ? (
                  <a href={prospect.salesforce_link} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1 text-xs">
                    <ExternalLink className="h-3 w-3 shrink-0" />
                    <span>View</span>
                  </a>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
                {onUpdateProspect && (
                  <Button size="icon" variant="ghost" className="h-5 w-5 opacity-60 hover:opacity-100" onClick={() => { setEditedSalesforce(prospect.salesforce_link || ''); setIsEditingSalesforce(true); }}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                )}
              </div>
            )}
          </div>
          <span className="hidden sm:block text-muted-foreground/40">|</span>

          {/* Opportunity Link - Editable */}
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-muted-foreground">Opp:</span>
            {isEditingOpportunity ? (
              <div className="flex items-center gap-1">
                <Input
                  type="url"
                  placeholder="https://..."
                  value={editedOpportunity}
                  onChange={(e) => setEditedOpportunity(e.target.value)}
                  className="h-7 w-[140px] text-xs"
                  disabled={isSavingOpportunity}
                />
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleSaveOpportunity} disabled={isSavingOpportunity}>
                  {isSavingOpportunity ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                </Button>
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setIsEditingOpportunity(false)} disabled={isSavingOpportunity}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                {prospect.opportunity_link ? (
                  <a href={prospect.opportunity_link} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1 text-xs">
                    <ExternalLink className="h-3 w-3 shrink-0" />
                    <span>View</span>
                  </a>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
                {onUpdateProspect && (
                  <Button size="icon" variant="ghost" className="h-5 w-5 opacity-60 hover:opacity-100" onClick={() => { setEditedOpportunity(prospect.opportunity_link || ''); setIsEditingOpportunity(true); }}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
