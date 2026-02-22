import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ExternalLink, Pencil, Check, X, Globe, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { industryOptions } from './constants';
import type { Prospect } from '@/api/prospects';

interface EditableField {
  isEditing: boolean;
  edited: string;
  isSaving: boolean;
  setEdited: (value: string) => void;
  startEdit: () => void;
  save: () => void;
  cancel: () => void;
}

interface ProspectMetadataRowProps {
  prospect: Prospect;
  canEdit: boolean;
  industry: EditableField;
  website: EditableField;
  salesforce: EditableField;
  opportunity: EditableField;
}

export function ProspectMetadataRow({
  prospect,
  canEdit,
  industry,
  website,
  salesforce,
  opportunity,
}: ProspectMetadataRowProps) {
  return (
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
        {industry.isEditing ? (
          <div className="flex items-center gap-1">
            <Select value={industry.edited} onValueChange={industry.setEdited} disabled={industry.isSaving}>
              <SelectTrigger className="h-7 w-[130px] text-xs">
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent>
                {industryOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={industry.save} disabled={industry.isSaving}>
              {industry.isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
            </Button>
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={industry.cancel} disabled={industry.isSaving}>
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
            {canEdit && (
              <Button size="icon" variant="ghost" className="h-5 w-5 opacity-60 hover:opacity-100" onClick={industry.startEdit}>
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
        {website.isEditing ? (
          <div className="flex items-center gap-1">
            <Input
              type="url"
              placeholder="https://..."
              value={website.edited}
              onChange={(e) => website.setEdited(e.target.value)}
              className="h-7 w-[140px] text-xs"
              disabled={website.isSaving}
            />
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={website.save} disabled={website.isSaving}>
              {website.isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
            </Button>
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={website.cancel} disabled={website.isSaving}>
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
            {canEdit && (
              <Button size="icon" variant="ghost" className="h-5 w-5 opacity-60 hover:opacity-100" onClick={website.startEdit}>
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
        {salesforce.isEditing ? (
          <div className="flex items-center gap-1">
            <Input
              type="url"
              placeholder="https://..."
              value={salesforce.edited}
              onChange={(e) => salesforce.setEdited(e.target.value)}
              className="h-7 w-[140px] text-xs"
              disabled={salesforce.isSaving}
            />
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={salesforce.save} disabled={salesforce.isSaving}>
              {salesforce.isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
            </Button>
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={salesforce.cancel} disabled={salesforce.isSaving}>
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
            {canEdit && (
              <Button size="icon" variant="ghost" className="h-5 w-5 opacity-60 hover:opacity-100" onClick={salesforce.startEdit}>
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
        {opportunity.isEditing ? (
          <div className="flex items-center gap-1">
            <Input
              type="url"
              placeholder="https://..."
              value={opportunity.edited}
              onChange={(e) => opportunity.setEdited(e.target.value)}
              className="h-7 w-[140px] text-xs"
              disabled={opportunity.isSaving}
            />
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={opportunity.save} disabled={opportunity.isSaving}>
              {opportunity.isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
            </Button>
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={opportunity.cancel} disabled={opportunity.isSaving}>
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
            {canEdit && (
              <Button size="icon" variant="ghost" className="h-5 w-5 opacity-60 hover:opacity-100" onClick={opportunity.startEdit}>
                <Pencil className="h-3 w-3" />
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
