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
import { ArrowLeft, Building2, ExternalLink } from 'lucide-react';
import { statusLabels, industryOptions } from './constants';
import type { Prospect, ProspectStatus } from '@/api/prospects';
import type { Stakeholder } from '@/api/stakeholders';

interface ProspectHeaderProps {
  prospect: Prospect;
  primaryStakeholder: Stakeholder | undefined;
  onStatusChange: (status: ProspectStatus) => void;
}

export function ProspectHeader({ prospect, primaryStakeholder, onStatusChange }: ProspectHeaderProps) {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
      <div>
        <Button
          variant="ghost"
          size="sm"
          className="mb-2 -ml-2"
          onClick={() => navigate('/rep/prospects')}
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10 shrink-0">
            <Building2 className="h-5 w-5 md:h-6 md:w-6 text-primary" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl md:text-3xl font-bold tracking-tight truncate">
                {prospect.account_name || prospect.prospect_name}
              </h1>
              {prospect.industry && (
                <Badge variant="secondary" className="text-xs md:text-sm shrink-0">
                  {industryOptions.find(i => i.value === prospect.industry)?.label ?? prospect.industry}
                </Badge>
              )}
            </div>
            {primaryStakeholder && (
              <p className="text-sm text-muted-foreground truncate">
                Primary: {primaryStakeholder.name}
                {primaryStakeholder.job_title && ` • ${primaryStakeholder.job_title}`}
              </p>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <Select value={prospect.status} onValueChange={(v) => onStatusChange(v as ProspectStatus)}>
          <SelectTrigger className="w-[120px] sm:w-[140px]">
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
        {prospect.salesforce_link && (
          <Button variant="outline" size="sm" asChild className="hidden sm:flex">
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
