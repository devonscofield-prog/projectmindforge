import { useState } from 'react';
import { createLogger } from '@/lib/logger';

const log = createLogger('AddStakeholderDialog');
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  FormInput,
  FormSelect,
  FormCheckbox,
  FormFieldGroup,
  SubmitButton,
} from '@/components/ui/form-fields';
import {
  createStakeholder,
  type StakeholderInfluenceLevel,
  influenceLevelLabels,
} from '@/api/stakeholders';
import { useToast } from '@/hooks/use-toast';

interface AddStakeholderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prospectId: string;
  repId: string;
  onStakeholderAdded: () => void;
}

const influenceOptions = Object.entries(influenceLevelLabels).map(([value, label]) => ({
  value,
  label,
}));

export function AddStakeholderDialog({
  open,
  onOpenChange,
  prospectId,
  repId,
  onStakeholderAdded,
}: AddStakeholderDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    jobTitle: '',
    email: '',
    phone: '',
    influenceLevel: 'light_influencer' as StakeholderInfluenceLevel,
    isPrimaryContact: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast({ title: 'Name is required', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      await createStakeholder({
        prospectId,
        repId,
        name: formData.name.trim(),
        jobTitle: formData.jobTitle.trim() || undefined,
        email: formData.email.trim() || undefined,
        phone: formData.phone.trim() || undefined,
        influenceLevel: formData.influenceLevel,
        isPrimaryContact: formData.isPrimaryContact,
      });

      toast({ title: 'Stakeholder added' });
      onStakeholderAdded();
      onOpenChange(false);
      
      // Reset form
      setFormData({
        name: '',
        jobTitle: '',
        email: '',
        phone: '',
        influenceLevel: 'light_influencer',
        isPrimaryContact: false,
      });
    } catch (error) {
      log.error('Failed to add stakeholder', { error });
      toast({ title: 'Failed to add stakeholder', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateField = <K extends keyof typeof formData>(field: K, value: typeof formData[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Stakeholder</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormInput
            label="Name"
            required
            placeholder="e.g., John Smith"
            value={formData.name}
            onChange={(e) => updateField('name', e.target.value)}
          />

          <FormInput
            label="Job Title"
            placeholder="e.g., VP of Operations"
            value={formData.jobTitle}
            onChange={(e) => updateField('jobTitle', e.target.value)}
          />

          <FormFieldGroup columns={2}>
            <FormInput
              label="Email"
              type="email"
              placeholder="john@acme.com"
              value={formData.email}
              onChange={(e) => updateField('email', e.target.value)}
            />
            <FormInput
              label="Phone"
              type="tel"
              placeholder="(555) 123-4567"
              value={formData.phone}
              onChange={(e) => updateField('phone', e.target.value)}
            />
          </FormFieldGroup>

          <FormSelect
            label="Influence Level"
            value={formData.influenceLevel}
            onValueChange={(v) => updateField('influenceLevel', v as StakeholderInfluenceLevel)}
            options={influenceOptions}
          />

          <FormCheckbox
            label="Primary contact for this account"
            checked={formData.isPrimaryContact}
            onCheckedChange={(checked) => updateField('isPrimaryContact', checked)}
          />

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <SubmitButton isLoading={isSubmitting} loadingText="Adding...">
              Add Stakeholder
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
