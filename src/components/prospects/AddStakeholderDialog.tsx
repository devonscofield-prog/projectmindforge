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
  findStakeholderByName,
  type StakeholderInfluenceLevel,
  influenceLevelLabels,
  normalizeStakeholderName,
  validateStakeholderName,
  validateStakeholderEmail,
  validateStakeholderPhone,
  STAKEHOLDER_NAME_MIN_LENGTH,
  STAKEHOLDER_NAME_MAX_LENGTH,
} from '@/api/stakeholders';
import { useCreateStakeholder } from '@/hooks/useStakeholderMutations';

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

interface FormErrors {
  name?: string;
  email?: string;
  phone?: string;
  duplicate?: string;
}

export function AddStakeholderDialog({
  open,
  onOpenChange,
  prospectId,
  repId,
  onStakeholderAdded,
}: AddStakeholderDialogProps) {
  const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    jobTitle: '',
    email: '',
    phone: '',
    influenceLevel: 'light_influencer' as StakeholderInfluenceLevel,
    isPrimaryContact: false,
  });
  const [errors, setErrors] = useState<FormErrors>({});

  const createStakeholderMutation = useCreateStakeholder(prospectId);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    // Validate name
    const nameValidation = validateStakeholderName(formData.name);
    if (!nameValidation.valid) {
      newErrors.name = nameValidation.error;
    }

    // Validate email if provided
    const emailValidation = validateStakeholderEmail(formData.email);
    if (!emailValidation.valid) {
      newErrors.email = emailValidation.error;
    }

    // Validate phone if provided
    const phoneValidation = validateStakeholderPhone(formData.phone);
    if (!phoneValidation.valid) {
      newErrors.phone = phoneValidation.error;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Clear previous errors
    setErrors({});

    // Validate form
    if (!validateForm()) {
      return;
    }

    const normalizedName = normalizeStakeholderName(formData.name);

    // Check for duplicate
    setIsCheckingDuplicate(true);
    try {
      const existing = await findStakeholderByName(prospectId, normalizedName);
      if (existing) {
        setErrors({ duplicate: `A stakeholder named "${existing.name}" already exists on this account` });
        setIsCheckingDuplicate(false);
        return;
      }
    } catch (error) {
      log.error('Failed to check for duplicate', { error });
      // Continue with creation even if duplicate check fails
    }
    setIsCheckingDuplicate(false);

    // Create stakeholder using mutation hook
    createStakeholderMutation.mutate(
      {
        prospectId,
        repId,
        name: normalizedName,
        jobTitle: formData.jobTitle.trim() || undefined,
        email: formData.email.trim() || undefined,
        phone: formData.phone.trim() || undefined,
        influenceLevel: formData.influenceLevel,
        isPrimaryContact: formData.isPrimaryContact,
      },
      {
        onSuccess: () => {
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
          setErrors({});
        },
      }
    );
  };

  const updateField = <K extends keyof typeof formData>(field: K, value: typeof formData[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear field-specific error when user types
    if (field in errors) {
      setErrors((prev) => ({ ...prev, [field]: undefined, duplicate: undefined }));
    }
  };

  const isSubmitting = createStakeholderMutation.isPending || isCheckingDuplicate;
  const normalizedNameLength = normalizeStakeholderName(formData.name).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Stakeholder</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <FormInput
              label="Name"
              required
              placeholder="e.g., John Smith"
              value={formData.name}
              onChange={(e) => updateField('name', e.target.value)}
              maxLength={STAKEHOLDER_NAME_MAX_LENGTH}
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name}</p>
            )}
            {errors.duplicate && (
              <p className="text-sm text-destructive">{errors.duplicate}</p>
            )}
            {normalizedNameLength > 0 && normalizedNameLength < STAKEHOLDER_NAME_MIN_LENGTH && (
              <p className="text-sm text-muted-foreground">
                {STAKEHOLDER_NAME_MIN_LENGTH - normalizedNameLength} more character{STAKEHOLDER_NAME_MIN_LENGTH - normalizedNameLength !== 1 ? 's' : ''} needed
              </p>
            )}
          </div>

          <FormInput
            label="Job Title"
            placeholder="e.g., VP of Operations"
            value={formData.jobTitle}
            onChange={(e) => updateField('jobTitle', e.target.value)}
          />

          <FormFieldGroup columns={2}>
            <div className="space-y-1">
              <FormInput
                label="Email"
                type="email"
                placeholder="john@acme.com"
                value={formData.email}
                onChange={(e) => updateField('email', e.target.value)}
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email}</p>
              )}
            </div>
            <div className="space-y-1">
              <FormInput
                label="Phone"
                type="tel"
                placeholder="(555) 123-4567"
                value={formData.phone}
                onChange={(e) => updateField('phone', e.target.value)}
              />
              {errors.phone && (
                <p className="text-sm text-destructive">{errors.phone}</p>
              )}
            </div>
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
            <SubmitButton 
              isLoading={isSubmitting} 
              loadingText={isCheckingDuplicate ? "Checking..." : "Adding..."}
              disabled={normalizedNameLength < STAKEHOLDER_NAME_MIN_LENGTH}
            >
              Add Stakeholder
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
