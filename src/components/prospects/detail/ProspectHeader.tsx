import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Building2, ExternalLink, User } from 'lucide-react';
import { statusLabels, industryOptions } from './constants';
import type { Prospect, ProspectStatus } from '@/api/prospects';
import type { Stakeholder } from '@/api/stakeholders';

interface ProspectHeaderProps {
  prospect: Prospect;
  primaryStakeholder: Stakeholder | undefined;
  onStatusChange: (status: ProspectStatus) => void;
  repName?: string;
  showRepName?: boolean;
}

export function ProspectHeader({ prospect, primaryStakeholder, onStatusChange, repName, showRepName }: ProspectHeaderProps) {
  const navigate = useNavigate();

  return (
    <div className="space-y-3">
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2"
        onClick={() => navigate('/rep/prospects')}
      >
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back
      </Button>
      
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="p-2 rounded-lg bg-primary/10 shrink-0">
            <Building2 className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight truncate">
                {prospect.account_name || prospect.prospect_name}
              </h1>
              {prospect.industry && (
                <Badge variant="secondary" className="text-xs shrink-0">
                  {industryOptions.find(i => i.value === prospect.industry)?.label ?? prospect.industry}
                </Badge>
              )}
              <Select value={prospect.status} onValueChange={(v) => onStatusChange(v as ProspectStatus)}>
                <SelectTrigger className="w-[110px] h-7 text-xs">
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
              <p className="text-sm text-muted-foreground truncate mt-1 flex items-center gap-1">
                <User className="h-3.5 w-3.5" />
                <span>Owned by: {repName}</span>
              </p>
            )}
            {primaryStakeholder && (
              <p className="text-sm text-muted-foreground truncate mt-1">
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
    </div>
  );
}
