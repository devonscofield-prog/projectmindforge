import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { updateProspect } from '@/api/prospects';
import type { Prospect, OpportunityDetails } from '@/api/prospects';
import { Edit, Save, X, Bot, Users, TrendingUp } from 'lucide-react';
import { formatCurrency } from './constants';

interface ProspectOpportunityDetailsProps {
  prospect: Prospect;
  onUpdate: (updatedProspect: Prospect) => void;
}

export function ProspectOpportunityDetails({ prospect, onUpdate }: ProspectOpportunityDetailsProps) {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const opportunityDetails = prospect.opportunity_details || {};
  
  const [formData, setFormData] = useState<OpportunityDetails>({
    it_users_count: opportunityDetails.it_users_count,
    end_users_count: opportunityDetails.end_users_count,
    ai_users_count: opportunityDetails.ai_users_count,
    compliance_users_count: opportunityDetails.compliance_users_count,
    security_awareness_count: opportunityDetails.security_awareness_count,
    notes: opportunityDetails.notes,
  });

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updated = await updateProspect(prospect.id, {
        opportunity_details: formData,
      });
      onUpdate(updated);
      setIsEditing(false);
      toast({
        title: 'Opportunity details updated',
        description: 'Changes saved successfully',
      });
    } catch (error) {
      console.error('Failed to update opportunity details', error);
      toast({
        title: 'Failed to save',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      it_users_count: opportunityDetails.it_users_count,
      end_users_count: opportunityDetails.end_users_count,
      ai_users_count: opportunityDetails.ai_users_count,
      compliance_users_count: opportunityDetails.compliance_users_count,
      security_awareness_count: opportunityDetails.security_awareness_count,
      notes: opportunityDetails.notes,
    });
    setIsEditing(false);
  };

  // Calculate potential revenue based on user counts
  const calculatePotentialRevenue = () => {
    const {
      it_users_count = 0,
      end_users_count = 0,
      ai_users_count = 0,
      compliance_users_count = 0,
      security_awareness_count = 0,
    } = isEditing ? formData : opportunityDetails;

    // Rough estimates per product type
    const itRevenue = it_users_count * 350; // Enterprise IT avg $350/user
    const endUserRevenue = end_users_count * 150; // Desktop Apps avg $150/user
    const aiRevenue = ai_users_count * 500; // AI Bundle avg $500/user
    const complianceRevenue = compliance_users_count * 120; // Compliance avg $120/user
    const securityRevenue = security_awareness_count * 100; // Security avg $100/user

    return itRevenue + endUserRevenue + aiRevenue + complianceRevenue + securityRevenue;
  };

  const potentialRevenue = calculatePotentialRevenue();

  const hasUserCounts = opportunityDetails.it_users_count || 
                        opportunityDetails.end_users_count || 
                        opportunityDetails.ai_users_count ||
                        opportunityDetails.compliance_users_count ||
                        opportunityDetails.security_awareness_count;

  const isAutoPopulated = opportunityDetails.auto_populated_from?.source;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          <CardTitle>Opportunity Details</CardTitle>
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
                <Input
                  id="it_users"
                  type="number"
                  min="0"
                  value={formData.it_users_count || ''}
                  onChange={(e) => setFormData({ ...formData, it_users_count: parseInt(e.target.value) || undefined })}
                />
              ) : (
                <p className="text-2xl font-bold">{opportunityDetails.it_users_count || '-'}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="end_users">End Users</Label>
              {isEditing ? (
                <Input
                  id="end_users"
                  type="number"
                  min="0"
                  value={formData.end_users_count || ''}
                  onChange={(e) => setFormData({ ...formData, end_users_count: parseInt(e.target.value) || undefined })}
                />
              ) : (
                <p className="text-2xl font-bold">{opportunityDetails.end_users_count || '-'}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="ai_users">AI Users</Label>
              {isEditing ? (
                <Input
                  id="ai_users"
                  type="number"
                  min="0"
                  value={formData.ai_users_count || ''}
                  onChange={(e) => setFormData({ ...formData, ai_users_count: parseInt(e.target.value) || undefined })}
                />
              ) : (
                <p className="text-2xl font-bold">{opportunityDetails.ai_users_count || '-'}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="compliance_users">Compliance Users</Label>
              {isEditing ? (
                <Input
                  id="compliance_users"
                  type="number"
                  min="0"
                  value={formData.compliance_users_count || ''}
                  onChange={(e) => setFormData({ ...formData, compliance_users_count: parseInt(e.target.value) || undefined })}
                />
              ) : (
                <p className="text-2xl font-bold">{opportunityDetails.compliance_users_count || '-'}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="security_users">Security Awareness</Label>
              {isEditing ? (
                <Input
                  id="security_users"
                  type="number"
                  min="0"
                  value={formData.security_awareness_count || ''}
                  onChange={(e) => setFormData({ ...formData, security_awareness_count: parseInt(e.target.value) || undefined })}
                />
              ) : (
                <p className="text-2xl font-bold">{opportunityDetails.security_awareness_count || '-'}</p>
              )}
            </div>
          </div>
        </div>

        {/* Potential Revenue Display */}
        {hasUserCounts && (
          <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Estimated Potential Revenue</p>
                <p className="text-3xl font-bold text-primary">{formatCurrency(potentialRevenue)}</p>
                <p className="text-xs text-muted-foreground mt-1">Based on user counts and average pricing</p>
              </div>
            </div>
          </div>
        )}

        {/* Notes */}
        <div className="space-y-2">
          <Label htmlFor="notes">Additional Notes</Label>
          {isEditing ? (
            <Textarea
              id="notes"
              value={formData.notes || ''}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Add context about promotions, budget timing, multi-year deals, etc."
              rows={3}
            />
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
