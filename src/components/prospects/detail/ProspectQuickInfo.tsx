import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { ExternalLink, Plus, Pencil, Check, X, Loader2, Globe } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { industryOptions } from './constants';
import type { Prospect } from '@/api/prospects';

interface ProspectQuickInfoProps {
  prospect: Prospect;
  onUpdateProspect: (updates: Partial<Prospect>) => Promise<boolean>;
}

export function ProspectQuickInfo({ prospect, onUpdateProspect }: ProspectQuickInfoProps) {
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
      const success = await onUpdateProspect({ website: editedWebsite || null } as any);
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
      <CardHeader>
        <CardTitle className="text-base">Quick Info</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Created</span>
          <span>{format(new Date(prospect.created_at), 'MMM d, yyyy')}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Last Contact</span>
          <span>
            {prospect.last_contact_date
              ? format(new Date(prospect.last_contact_date), 'MMM d, yyyy')
              : '—'}
          </span>
        </div>

        {/* Industry with Edit */}
        <div className="pt-2 space-y-2">
          <span className="text-muted-foreground text-xs">Industry</span>
          {isEditingIndustry ? (
            <div className="space-y-2">
              <Select
                value={editedIndustry}
                onValueChange={setEditedIndustry}
                disabled={isSavingIndustry}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Select industry..." />
                </SelectTrigger>
                <SelectContent>
                  {industryOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="default"
                  className="h-7 text-xs"
                  onClick={handleSaveIndustry}
                  disabled={isSavingIndustry}
                >
                  {isSavingIndustry ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <>
                      <Check className="h-3 w-3 mr-1" />
                      Save
                    </>
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => {
                    setIsEditingIndustry(false);
                    setEditedIndustry(prospect.industry || '');
                  }}
                  disabled={isSavingIndustry}
                >
                  <X className="h-3 w-3 mr-1" />
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {prospect.industry ? (
                <>
                  <Badge variant="secondary" className="text-xs">
                    {industryOptions.find(o => o.value === prospect.industry)?.label || prospect.industry}
                  </Badge>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 shrink-0"
                    onClick={() => {
                      setEditedIndustry(prospect.industry || '');
                      setIsEditingIndustry(true);
                    }}
                    title="Edit industry"
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                </>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => {
                    setEditedIndustry('');
                    setIsEditingIndustry(true);
                  }}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add Industry
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Website with Edit */}
        <div className="pt-2 space-y-2">
          <span className="text-muted-foreground text-xs">Website</span>
          {isEditingWebsite ? (
            <div className="space-y-2">
              <Input
                type="url"
                placeholder="https://company.com"
                value={editedWebsite}
                onChange={(e) => setEditedWebsite(e.target.value)}
                className="h-8 text-sm"
                disabled={isSavingWebsite}
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="default"
                  className="h-7 text-xs"
                  onClick={handleSaveWebsite}
                  disabled={isSavingWebsite}
                >
                  {isSavingWebsite ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <>
                      <Check className="h-3 w-3 mr-1" />
                      Save
                    </>
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => {
                    setIsEditingWebsite(false);
                    setEditedWebsite((prospect as any).website || '');
                  }}
                  disabled={isSavingWebsite}
                >
                  <X className="h-3 w-3 mr-1" />
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {(prospect as any).website ? (
                <>
                  <a
                    href={(prospect as any).website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline flex items-center gap-1 flex-1 truncate"
                  >
                    <Globe className="h-3 w-3 shrink-0" />
                    <span className="truncate">{(prospect as any).website}</span>
                  </a>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 shrink-0"
                    onClick={() => {
                      setEditedWebsite((prospect as any).website || '');
                      setIsEditingWebsite(true);
                    }}
                    title="Edit website"
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                </>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => {
                    setEditedWebsite('');
                    setIsEditingWebsite(true);
                  }}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add Website
                </Button>
              )}
            </div>
          )}
        </div>
        
        {/* Salesforce Link with Edit */}
        <div className="pt-2 space-y-2">
          <span className="text-muted-foreground text-xs">Salesforce Link</span>
          {isEditingSalesforceLink ? (
            <div className="space-y-2">
              <Input
                type="url"
                placeholder="https://..."
                value={editedSalesforceLink}
                onChange={(e) => setEditedSalesforceLink(e.target.value)}
                className="h-8 text-sm"
                disabled={isSavingSalesforceLink}
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="default"
                  className="h-7 text-xs"
                  onClick={handleSaveSalesforceLink}
                  disabled={isSavingSalesforceLink}
                >
                  {isSavingSalesforceLink ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <>
                      <Check className="h-3 w-3 mr-1" />
                      Save
                    </>
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => {
                    setIsEditingSalesforceLink(false);
                    setEditedSalesforceLink(prospect.salesforce_link || '');
                  }}
                  disabled={isSavingSalesforceLink}
                >
                  <X className="h-3 w-3 mr-1" />
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {prospect.salesforce_link ? (
                <>
                  <a
                    href={prospect.salesforce_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline flex items-center gap-1 flex-1 truncate"
                  >
                    <ExternalLink className="h-3 w-3 shrink-0" />
                    <span className="truncate">View in Salesforce</span>
                  </a>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 shrink-0"
                    onClick={() => {
                      setEditedSalesforceLink(prospect.salesforce_link || '');
                      setIsEditingSalesforceLink(true);
                    }}
                    title="Edit Salesforce link"
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                </>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => {
                    setEditedSalesforceLink('');
                    setIsEditingSalesforceLink(true);
                  }}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add Salesforce Link
                </Button>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
