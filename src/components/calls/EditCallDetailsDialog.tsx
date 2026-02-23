import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CallTranscript, UpdateCallTranscriptParams } from '@/api/aiCallAnalysis';
import { callTypeOptions, type CallType as _CallType } from '@/constants/callTypes';
import { OpportunityLabel, opportunityLabelOptions } from '@/constants/opportunityLabels';
// format import removed - unused
import { AlertTriangle, Loader2, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface EditCallDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transcript: CallTranscript;
  onSave: (updates: UpdateCallTranscriptParams) => void;
  isSaving: boolean;
}

export function EditCallDetailsDialog({
  open,
  onOpenChange,
  transcript,
  onSave,
  isSaving,
}: EditCallDetailsDialogProps) {
  const [callDate, setCallDate] = useState('');
  const [callType, setCallType] = useState('');
  const [callTypeOther, setCallTypeOther] = useState('');
  const [stakeholderName, setStakeholderName] = useState('');
  const [accountName, setAccountName] = useState('');
  const [salesforceLink, setSalesforceLink] = useState('');
  const [potentialRevenue, setPotentialRevenue] = useState('');
  const [notes, setNotes] = useState('');
  const [managerOnCall, setManagerOnCall] = useState(false);
  const [managerId, setManagerId] = useState<string | null>(null);
  const [isUnqualified, setIsUnqualified] = useState(false);
  const [estimatedOpportunitySize, setEstimatedOpportunitySize] = useState('');
  const [targetCloseDate, setTargetCloseDate] = useState('');
  const [opportunityLabel, setOpportunityLabel] = useState<OpportunityLabel | ''>('');

  const originalAccountName = transcript.account_name || '';

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setCallDate(transcript.call_date);
      setCallType(transcript.call_type || 'first_demo');
      setCallTypeOther(transcript.call_type_other || '');
      setStakeholderName(transcript.primary_stakeholder_name || '');
      setAccountName(transcript.account_name || '');
      setSalesforceLink(transcript.salesforce_demo_link || '');
      setPotentialRevenue(transcript.potential_revenue?.toString() || '');
      setNotes(transcript.notes || '');
      setManagerOnCall(!!transcript.manager_id);
      setManagerId(transcript.manager_id);
      setIsUnqualified(transcript.is_unqualified ?? false);
      setEstimatedOpportunitySize(transcript.estimated_opportunity_size?.toString() || '');
      setTargetCloseDate(transcript.target_close_date || '');
      setOpportunityLabel((transcript.opportunity_label as OpportunityLabel) || '');
    }
  }, [open, transcript]);

  // Lookup manager when checkbox is toggled on
  useEffect(() => {
    async function lookupManager() {
      if (managerOnCall && !managerId) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('team_id')
          .eq('id', transcript.rep_id)
          .maybeSingle();
        
        if (profile?.team_id) {
          const { data: team } = await supabase
            .from('teams')
            .select('manager_id')
            .eq('id', profile.team_id)
            .maybeSingle();
          
          setManagerId(team?.manager_id || null);
        }
      } else if (!managerOnCall) {
        setManagerId(null);
      }
    }
    lookupManager();
  }, [managerOnCall, managerId, transcript.rep_id]);

  const accountNameChanged = accountName.trim() !== originalAccountName.trim();

  const handleSubmit = () => {
    const updates: UpdateCallTranscriptParams = {
      call_date: callDate,
      call_type: callType,
      call_type_other: callType === 'other' ? callTypeOther : null,
      primary_stakeholder_name: stakeholderName.trim() || null,
      account_name: accountName.trim() || null,
      salesforce_demo_link: salesforceLink.trim() || null,
      potential_revenue: potentialRevenue ? parseFloat(potentialRevenue) : null,
      notes: notes.trim() || null,
      manager_id: managerOnCall ? managerId : null,
      is_unqualified: isUnqualified,
      estimated_opportunity_size: estimatedOpportunitySize ? parseFloat(estimatedOpportunitySize) : null,
      target_close_date: targetCloseDate || null,
      opportunity_label: opportunityLabel || null,
    };

    onSave(updates);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Call Details</DialogTitle>
          <DialogDescription>
            Update the details for this call. Changes will not affect the AI analysis.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Account Name Change Warning */}
          {accountNameChanged && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Changing the account name may affect how this call is linked to prospects.
              </AlertDescription>
            </Alert>
          )}

          {/* Call Date */}
          <div className="space-y-2">
            <Label htmlFor="call_date">Call Date</Label>
            <Input
              id="call_date"
              type="date"
              value={callDate}
              onChange={(e) => setCallDate(e.target.value)}
              required
            />
          </div>

          {/* Call Type */}
          <div className="space-y-2">
            <Label htmlFor="call_type">Call Type</Label>
            <Select value={callType} onValueChange={setCallType}>
              <SelectTrigger>
                <SelectValue placeholder="Select call type" />
              </SelectTrigger>
              <SelectContent>
                {callTypeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Call Type Other */}
          {callType === 'other' && (
            <div className="space-y-2">
              <Label htmlFor="call_type_other">Specify Call Type</Label>
              <Input
                id="call_type_other"
                value={callTypeOther}
                onChange={(e) => setCallTypeOther(e.target.value)}
                placeholder="Enter call type"
              />
            </div>
          )}

          {/* Manager on Call Checkbox */}
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="managerOnCall" 
              checked={managerOnCall} 
              onCheckedChange={(checked) => setManagerOnCall(checked === true)}
            />
            <Label htmlFor="managerOnCall" className="text-sm font-normal flex items-center gap-1.5 cursor-pointer">
              <Users className="h-4 w-4 text-muted-foreground" />
              Manager was on this call
            </Label>
          </div>

          {/* Unqualified Checkbox */}
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="isUnqualified" 
              checked={isUnqualified} 
              onCheckedChange={(checked) => setIsUnqualified(checked === true)}
            />
            <Label htmlFor="isUnqualified" className="text-sm font-normal flex items-center gap-1.5 cursor-pointer">
              🚫 Mark as Unqualified
            </Label>
          </div>

          {/* Primary Stakeholder */}
          <div className="space-y-2">
            <Label htmlFor="stakeholder_name">Primary Stakeholder</Label>
            <Input
              id="stakeholder_name"
              value={stakeholderName}
              onChange={(e) => setStakeholderName(e.target.value)}
              placeholder="Contact name"
            />
          </div>

          {/* Account Name */}
          <div className="space-y-2">
            <Label htmlFor="account_name">Account Name</Label>
            <Input
              id="account_name"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              placeholder="Company or account name"
            />
          </div>

          {/* Salesforce Link */}
          <div className="space-y-2">
            <Label htmlFor="salesforce_link">Salesforce Link</Label>
            <Input
              id="salesforce_link"
              type="url"
              value={salesforceLink}
              onChange={(e) => setSalesforceLink(e.target.value)}
              placeholder="https://..."
            />
          </div>

          {/* Potential Revenue */}
          <div className="space-y-2">
            <Label htmlFor="potential_revenue">Potential Revenue</Label>
            <Input
              id="potential_revenue"
              type="number"
              min="0"
              step="0.01"
              value={potentialRevenue}
              onChange={(e) => setPotentialRevenue(e.target.value)}
              placeholder="0.00"
            />
          </div>

          {/* Estimated Opportunity Size */}
          <div className="space-y-2">
            <Label htmlFor="edit_estimated_opportunity_size">Est. Opportunity Size</Label>
            <Input
              id="edit_estimated_opportunity_size"
              type="number"
              min="0"
              step="0.01"
              value={estimatedOpportunitySize}
              onChange={(e) => setEstimatedOpportunitySize(e.target.value)}
              placeholder="0.00"
            />
          </div>

          {/* Target Close Date */}
          <div className="space-y-2">
            <Label htmlFor="edit_target_close_date">Target Close Date</Label>
            <Input
              id="edit_target_close_date"
              type="date"
              value={targetCloseDate}
              onChange={(e) => setTargetCloseDate(e.target.value)}
            />
          </div>

          {/* Opportunity Label */}
          <div className="space-y-2">
            <Label htmlFor="edit_opportunity_label">Opportunity Label</Label>
            <Select value={opportunityLabel || 'none'} onValueChange={v => setOpportunityLabel(v === 'none' ? '' : v as OpportunityLabel)}>
              <SelectTrigger>
                <SelectValue placeholder="Select label" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {opportunityLabelOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes about this call..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSaving || !callDate}>
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
