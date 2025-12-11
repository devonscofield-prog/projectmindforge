import { useState } from 'react';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { updateProspect } from '@/api/prospects';
import type { Prospect, OpportunityDetails } from '@/api/prospects';
import { Edit, Save, X, Bot, Users, TrendingUp, AlertCircle } from 'lucide-react';
import { formatCurrency } from './constants';
import { createLogger } from '@/lib/logger';

const opportunityDetailsSchema = z.object({
  potential_revenue: z.number().min(0, 'Potential revenue cannot be negative').optional().or(z.literal(undefined)),
  it_users_count: z.number().int().min(0, 'IT users count cannot be negative').optional().or(z.literal(undefined)),
  end_users_count: z.number().int().min(0, 'End users count cannot be negative').optional().or(z.literal(undefined)),
  ai_users_count: z.number().int().min(0, 'AI users count cannot be negative').optional().or(z.literal(undefined)),
  compliance_users_count: z.number().int().min(0, 'Compliance users count cannot be negative').optional().or(z.literal(undefined)),
  security_awareness_count: z.number().int().min(0, 'Security awareness count cannot be negative').optional().or(z.literal(undefined)),
  notes: z.string().max(1000, 'Notes must be less than 1000 characters').optional().or(z.literal(undefined)),
});

interface ProspectOpportunityDetailsProps {
  prospect: Prospect;
  onUpdate: (updatedProspect: Prospect) => void;
}

const logger = createLogger('ProspectOpportunityDetails');

export function ProspectOpportunityDetails({ prospect, onUpdate }: ProspectOpportunityDetailsProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const opportunityDetails = prospect.opportunity_details || {};
  
  const [formData, setFormData] = useState<OpportunityDetails>({
    potential_revenue: opportunityDetails.potential_revenue,
    it_users_count: opportunityDetails.it_users_count,
    end_users_count: opportunityDetails.end_users_count,
    ai_users_count: opportunityDetails.ai_users_count,
    compliance_users_count: opportunityDetails.compliance_users_count,
    security_awareness_count: opportunityDetails.security_awareness_count,
    notes: opportunityDetails.notes,
  });

  const handleSave = async () => {
    // Validate form data
    const validation = opportunityDetailsSchema.safeParse(formData);
    
    if (!validation.success) {
      const errors: Record<string, string> = {};
      validation.error.errors.forEach((err) => {
        if (err.path[0]) {
          errors[err.path[0].toString()] = err.message;
        }
      });
      setValidationErrors(errors);
      toast.error('Validation failed', { description: 'Please fix the errors before saving' });
      return;
    }

    setValidationErrors({});
    setIsSaving(true);
    try {
      const updated = await updateProspect(prospect.id, {
        opportunity_details: formData,
      });
      onUpdate(updated);
      setIsEditing(false);
      toast.success('Potential opportunity updated', { description: 'Changes saved successfully' });
    } catch (error) {
      logger.error('Failed to update opportunity details', { error, prospectId: prospect.id });
      toast.error('Failed to save', { description: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      potential_revenue: opportunityDetails.potential_revenue,
      it_users_count: opportunityDetails.it_users_count,
      end_users_count: opportunityDetails.end_users_count,
      ai_users_count: opportunityDetails.ai_users_count,
      compliance_users_count: opportunityDetails.compliance_users_count,
      security_awareness_count: opportunityDetails.security_awareness_count,
      notes: opportunityDetails.notes,
    });
    setValidationErrors({});
    setIsEditing(false);
  };

  const isAutoPopulated = opportunityDetails.auto_populated_from?.source;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          <CardTitle>Potential Opportunity</CardTitle>
          {isAutoPopulated && (
            <Badge variant="outline" className="text-xs">
              <Bot className="h-3 w-3 mr-1" />
              AI Suggested
            </Badge>
          )}
        </div>
        {!isEditing ? (
          <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
            <Edit className="h-4 w-4 mr-1" />
            Edit
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleCancel} disabled={isSaving}>
              <X className="h-4 w-4 mr-1" />
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={isSaving}>
              <Save className="h-4 w-4 mr-1" />
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Potential Revenue Input */}
        <div className="space-y-2">
          <Label htmlFor="potential_revenue" className="text-base font-semibold">Potential Revenue</Label>
          {isEditing ? (
            <>
              <Input
                id="potential_revenue"
                type="number"
                min="0"
                step="1000"
                value={formData.potential_revenue || ''}
                onChange={(e) => setFormData({ ...formData, potential_revenue: parseFloat(e.target.value) || undefined })}
                placeholder="Enter potential revenue"
                className={`text-lg ${validationErrors.potential_revenue ? 'border-destructive' : ''}`}
              />
              {validationErrors.potential_revenue && (
                <div className="flex items-center gap-1 text-xs text-destructive">
                  <AlertCircle className="h-3 w-3" />
                  <span>{validationErrors.potential_revenue}</span>
                </div>
              )}
            </>
          ) : (
            <p className="text-3xl font-bold text-primary">
              {opportunityDetails.potential_revenue ? formatCurrency(opportunityDetails.potential_revenue) : '-'}
            </p>
          )}
        </div>

        {/* User Counts Grid */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Users className="h-4 w-4 text-muted-foreground" />
            <h4 className="text-sm font-medium">User Counts</h4>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="it_users">IT Users</Label>
              {isEditing ? (
                <>
                  <Input
                    id="it_users"
                    type="number"
                    min="0"
                    value={formData.it_users_count || ''}
                    onChange={(e) => setFormData({ ...formData, it_users_count: parseInt(e.target.value) || undefined })}
                    className={validationErrors.it_users_count ? 'border-destructive' : ''}
                  />
                  {validationErrors.it_users_count && (
                    <div className="flex items-center gap-1 text-xs text-destructive">
                      <AlertCircle className="h-3 w-3" />
                      <span>{validationErrors.it_users_count}</span>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-2xl font-bold">{opportunityDetails.it_users_count || '-'}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="end_users">End Users</Label>
              {isEditing ? (
                <>
                  <Input
                    id="end_users"
                    type="number"
                    min="0"
                    value={formData.end_users_count || ''}
                    onChange={(e) => setFormData({ ...formData, end_users_count: parseInt(e.target.value) || undefined })}
                    className={validationErrors.end_users_count ? 'border-destructive' : ''}
                  />
                  {validationErrors.end_users_count && (
                    <div className="flex items-center gap-1 text-xs text-destructive">
                      <AlertCircle className="h-3 w-3" />
                      <span>{validationErrors.end_users_count}</span>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-2xl font-bold">{opportunityDetails.end_users_count || '-'}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="ai_users">AI Users</Label>
              {isEditing ? (
                <>
                  <Input
                    id="ai_users"
                    type="number"
                    min="0"
                    value={formData.ai_users_count || ''}
                    onChange={(e) => setFormData({ ...formData, ai_users_count: parseInt(e.target.value) || undefined })}
                    className={validationErrors.ai_users_count ? 'border-destructive' : ''}
                  />
                  {validationErrors.ai_users_count && (
                    <div className="flex items-center gap-1 text-xs text-destructive">
                      <AlertCircle className="h-3 w-3" />
                      <span>{validationErrors.ai_users_count}</span>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-2xl font-bold">{opportunityDetails.ai_users_count || '-'}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="compliance_users">Compliance Users</Label>
              {isEditing ? (
                <>
                  <Input
                    id="compliance_users"
                    type="number"
                    min="0"
                    value={formData.compliance_users_count || ''}
                    onChange={(e) => setFormData({ ...formData, compliance_users_count: parseInt(e.target.value) || undefined })}
                    className={validationErrors.compliance_users_count ? 'border-destructive' : ''}
                  />
                  {validationErrors.compliance_users_count && (
                    <div className="flex items-center gap-1 text-xs text-destructive">
                      <AlertCircle className="h-3 w-3" />
                      <span>{validationErrors.compliance_users_count}</span>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-2xl font-bold">{opportunityDetails.compliance_users_count || '-'}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="security_users">Security Awareness</Label>
              {isEditing ? (
                <>
                  <Input
                    id="security_users"
                    type="number"
                    min="0"
                    value={formData.security_awareness_count || ''}
                    onChange={(e) => setFormData({ ...formData, security_awareness_count: parseInt(e.target.value) || undefined })}
                    className={validationErrors.security_awareness_count ? 'border-destructive' : ''}
                  />
                  {validationErrors.security_awareness_count && (
                    <div className="flex items-center gap-1 text-xs text-destructive">
                      <AlertCircle className="h-3 w-3" />
                      <span>{validationErrors.security_awareness_count}</span>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-2xl font-bold">{opportunityDetails.security_awareness_count || '-'}</p>
              )}
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <Label htmlFor="notes">Additional Notes</Label>
          {isEditing ? (
            <>
              <Textarea
                id="notes"
                value={formData.notes || ''}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Add context about promotions, budget timing, multi-year deals, etc."
                rows={3}
                maxLength={1000}
                className={validationErrors.notes ? 'border-destructive' : ''}
              />
              {validationErrors.notes && (
                <div className="flex items-center gap-1 text-xs text-destructive">
                  <AlertCircle className="h-3 w-3" />
                  <span>{validationErrors.notes}</span>
                </div>
              )}
              {formData.notes && (
                <p className="text-xs text-muted-foreground text-right">
                  {formData.notes.length}/1000 characters
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              {opportunityDetails.notes || 'No additional notes'}
            </p>
          )}
        </div>

        {/* Auto-population source */}
        {isAutoPopulated && !isEditing && (
          <div className="text-xs text-muted-foreground">
            <Bot className="h-3 w-3 inline mr-1" />
            Auto-populated from {opportunityDetails.auto_populated_from?.source} on{' '}
            {opportunityDetails.auto_populated_from?.extracted_at 
              ? new Date(opportunityDetails.auto_populated_from.extracted_at).toLocaleDateString()
              : 'unknown date'}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
