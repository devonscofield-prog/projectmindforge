import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ExternalLink, Pencil, Check, X, Loader2, Globe } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { industryOptions } from './constants';
import type { Prospect } from '@/api/prospects';

interface ProspectQuickInfoBarProps {
  prospect: Prospect;
  onUpdateProspect: (updates: Partial<Prospect>) => Promise<boolean>;
}

export function ProspectQuickInfoBar({ prospect, onUpdateProspect }: ProspectQuickInfoBarProps) {
  // Industry editing state
  const [isEditingIndustry, setIsEditingIndustry] = useState(false);
  const [editedIndustry, setEditedIndustry] = useState('');
  const [isSavingIndustry, setIsSavingIndustry] = useState(false);

  // Website editing state
  const [isEditingWebsite, setIsEditingWebsite] = useState(false);
  const [editedWebsite, setEditedWebsite] = useState('');
  const [isSavingWebsite, setIsSavingWebsite] = useState(false);

  // Salesforce link editing state
  const [isEditingSalesforceLink, setIsEditingSalesforceLink] = useState(false);
  const [editedSalesforceLink, setEditedSalesforceLink] = useState('');
  const [isSavingSalesforceLink, setIsSavingSalesforceLink] = useState(false);

  const handleSaveIndustry = async () => {
    setIsSavingIndustry(true);
    try {
      const success = await onUpdateProspect({ industry: editedIndustry || null });
      if (success) {
        setIsEditingIndustry(false);
        toast.success('Industry updated');
      } else {
        toast.error('Failed to update industry');
      }
    } finally {
      setIsSavingIndustry(false);
    }
  };

  const handleSaveWebsite = async () => {
    setIsSavingWebsite(true);
    try {
      const success = await onUpdateProspect({ website: editedWebsite || null });
      if (success) {
        setIsEditingWebsite(false);
        toast.success('Website updated');
      } else {
        toast.error('Failed to update website');
      }
    } finally {
      setIsSavingWebsite(false);
    }
  };

  const handleSaveSalesforceLink = async () => {
    setIsSavingSalesforceLink(true);
    try {
      const success = await onUpdateProspect({ salesforce_link: editedSalesforceLink || null });
      if (success) {
        setIsEditingSalesforceLink(false);
        toast.success('Salesforce link updated');
      } else {
        toast.error('Failed to update link');
      }
    } finally {
      setIsSavingSalesforceLink(false);
    }
  };

  return (
    <Card>
      <CardContent className="py-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          {/* Created Date */}
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <span className="font-medium">Created:</span>
            <span>{format(new Date(prospect.created_at), 'MMM d, yyyy')}</span>
          </div>

          <div className="hidden sm:block text-muted-foreground/40">|</div>

          {/* Last Contact */}
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <span className="font-medium">Last Contact:</span>
            <span>
              {prospect.last_contact_date
                ? format(new Date(prospect.last_contact_date), 'MMM d, yyyy')
                : '—'}
            </span>
          </div>

          <div className="hidden sm:block text-muted-foreground/40">|</div>

          {/* Industry - Editable */}
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-muted-foreground">Industry:</span>
            {isEditingIndustry ? (
              <div className="flex items-center gap-1">
                <Select
                  value={editedIndustry}
                  onValueChange={setEditedIndustry}
                  disabled={isSavingIndustry}
                >
                  <SelectTrigger className="h-7 w-[140px] text-xs">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {industryOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={handleSaveIndustry}
                  disabled={isSavingIndustry}
                >
                  {isSavingIndustry ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Check className="h-3 w-3" />
                  )}
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={() => {
                    setIsEditingIndustry(false);
                    setEditedIndustry(prospect.industry || '');
                  }}
                  disabled={isSavingIndustry}
                >
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
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-5 w-5 opacity-60 hover:opacity-100"
                  onClick={() => {
                    setEditedIndustry(prospect.industry || '');
                    setIsEditingIndustry(true);
                  }}
                  title="Edit industry"
                >
                  <Pencil className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>

          <div className="hidden sm:block text-muted-foreground/40">|</div>

          {/* Website - Editable */}
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-muted-foreground">Website:</span>
            {isEditingWebsite ? (
              <div className="flex items-center gap-1">
                <Input
                  type="url"
                  placeholder="https://company.com"
                  value={editedWebsite ?? ''}
                  onChange={(e) => setEditedWebsite(e.target.value)}
                  className="h-7 w-[160px] text-xs"
                  disabled={isSavingWebsite}
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={handleSaveWebsite}
                  disabled={isSavingWebsite}
                >
                  {isSavingWebsite ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Check className="h-3 w-3" />
                  )}
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={() => {
                    setIsEditingWebsite(false);
                    setEditedWebsite(prospect.website || '');
                  }}
                  disabled={isSavingWebsite}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                {prospect.website ? (
                  <a
                    href={prospect.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline flex items-center gap-1 text-xs max-w-[120px] truncate"
                  >
                    <Globe className="h-3 w-3 shrink-0" />
                    <span className="truncate">{prospect.website}</span>
                  </a>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-5 w-5 opacity-60 hover:opacity-100"
                  onClick={() => {
                    setEditedWebsite(prospect.website || '');
                    setIsEditingWebsite(true);
                  }}
                  title="Edit website"
                >
                  <Pencil className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>

          <div className="hidden sm:block text-muted-foreground/40">|</div>

          {/* Salesforce - Editable */}
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-muted-foreground">Salesforce:</span>
            {isEditingSalesforceLink ? (
              <div className="flex items-center gap-1">
                <Input
                  type="url"
                  placeholder="https://..."
                  value={editedSalesforceLink}
                  onChange={(e) => setEditedSalesforceLink(e.target.value)}
                  className="h-7 w-[160px] text-xs"
                  disabled={isSavingSalesforceLink}
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={handleSaveSalesforceLink}
                  disabled={isSavingSalesforceLink}
                >
                  {isSavingSalesforceLink ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Check className="h-3 w-3" />
                  )}
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={() => {
                    setIsEditingSalesforceLink(false);
                    setEditedSalesforceLink(prospect.salesforce_link || '');
                  }}
                  disabled={isSavingSalesforceLink}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                {prospect.salesforce_link ? (
                  <a
                    href={prospect.salesforce_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline flex items-center gap-1 text-xs"
                  >
                    <ExternalLink className="h-3 w-3 shrink-0" />
                    <span>View</span>
                  </a>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-5 w-5 opacity-60 hover:opacity-100"
                  onClick={() => {
                    setEditedSalesforceLink(prospect.salesforce_link || '');
                    setIsEditingSalesforceLink(true);
                  }}
                  title="Edit Salesforce link"
                >
                  <Pencil className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
