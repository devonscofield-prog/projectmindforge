import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import {
  FormSelect,
  FormTextarea,
  FormSlider,
  SubmitButton,
} from '@/components/ui/form-fields';
import { toast } from 'sonner';
import { Stakeholder } from '@/api/stakeholders';
import {
  createRelationship,
  RelationshipType,
  relationshipTypeLabels,
} from '@/api/stakeholderRelationships';
import { ArrowRight, Users, GitBranch } from 'lucide-react';

interface AddRelationshipDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stakeholders: Stakeholder[];
  prospectId: string;
  repId: string;
  onRelationshipAdded: () => void;
  preselectedSourceId?: string;
}

const relationshipTypeOptions = [
  { value: 'reports_to', label: 'Reports To (hierarchy)' },
  { value: 'influences', label: 'Influences' },
  { value: 'collaborates_with', label: 'Collaborates With' },
  { value: 'opposes', label: 'Opposes' },
];

export function AddRelationshipDialog({
  open,
  onOpenChange,
  stakeholders,
  prospectId,
  repId,
  onRelationshipAdded,
  preselectedSourceId,
}: AddRelationshipDialogProps) {
  const [sourceId, setSourceId] = useState(preselectedSourceId || '');
  const [targetId, setTargetId] = useState('');
  const [relationshipType, setRelationshipType] = useState<RelationshipType>('collaborates_with');
  const [strength, setStrength] = useState(5);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!sourceId || !targetId) {
      toast.error('Please select both stakeholders');
      return;
    }

    if (sourceId === targetId) {
      toast.error('Cannot create a relationship with the same person');
      return;
    }

    setIsSubmitting(true);
    try {
      await createRelationship({
        prospectId,
        sourceStakeholderId: sourceId,
        targetStakeholderId: targetId,
        relationshipType,
        strength,
        notes: notes || undefined,
        repId,
      });

      toast.success('Relationship added');
      onRelationshipAdded();
      resetForm();
      onOpenChange(false);
    } catch (error: unknown) {
      const pgError = error as { code?: string };
      if (pgError.code === '23505') {
        toast.error('This relationship already exists');
      } else {
        toast.error('Failed to add relationship');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setSourceId(preselectedSourceId || '');
    setTargetId('');
    setRelationshipType('collaborates_with');
    setStrength(5);
    setNotes('');
  };

  const sourceStakeholder = stakeholders.find(s => s.id === sourceId);
  const targetStakeholder = stakeholders.find(s => s.id === targetId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-primary" />
            Add Relationship
          </DialogTitle>
          <DialogDescription>
            Define how stakeholders are connected
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* Visual relationship preview */}
          {sourceId && targetId && (
            <div className="flex items-center justify-center gap-2 p-3 rounded-lg bg-muted/50 text-sm">
              <span className="font-medium truncate max-w-[120px]">
                {sourceStakeholder?.name}
              </span>
              <ArrowRight className="h-4 w-4 text-primary shrink-0" />
              <span className="text-muted-foreground">
                {relationshipTypeLabels[relationshipType].toLowerCase()}
              </span>
              <ArrowRight className="h-4 w-4 text-primary shrink-0" />
              <span className="font-medium truncate max-w-[120px]">
                {targetStakeholder?.name}
              </span>
            </div>
          )}

          {/* Source Stakeholder - Custom select with icons */}
          <div className="space-y-2">
            <Label>From (Source)</Label>
            <Select value={sourceId} onValueChange={setSourceId}>
              <SelectTrigger>
                <SelectValue placeholder="Select stakeholder..." />
              </SelectTrigger>
              <SelectContent>
                {stakeholders.map((s) => (
                  <SelectItem key={s.id} value={s.id} disabled={s.id === targetId}>
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span>{s.name}</span>
                      {s.job_title && (
                        <span className="text-muted-foreground text-xs">• {s.job_title}</span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Relationship Type */}
          <FormSelect
            label="Relationship Type"
            value={relationshipType}
            onValueChange={(v) => setRelationshipType(v as RelationshipType)}
            options={relationshipTypeOptions}
          />

          {/* Target Stakeholder - Custom select with icons */}
          <div className="space-y-2">
            <Label>To (Target)</Label>
            <Select value={targetId} onValueChange={setTargetId}>
              <SelectTrigger>
                <SelectValue placeholder="Select stakeholder..." />
              </SelectTrigger>
              <SelectContent>
                {stakeholders.map((s) => (
                  <SelectItem key={s.id} value={s.id} disabled={s.id === sourceId}>
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span>{s.name}</span>
                      {s.job_title && (
                        <span className="text-muted-foreground text-xs">• {s.job_title}</span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Strength Slider */}
          <FormSlider
            label="Relationship Strength"
            value={strength}
            onValueChange={setStrength}
            min={1}
            max={10}
            step={1}
          />

          {/* Notes */}
          <FormTextarea
            label="Notes (optional)"
            placeholder="Any context about this relationship..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
          />

          <SubmitButton
            onClick={handleSubmit}
            disabled={!sourceId || !targetId}
            isLoading={isSubmitting}
            loadingText="Adding..."
            className="w-full"
          >
            Add Relationship
          </SubmitButton>
        </div>
      </DialogContent>
    </Dialog>
  );
}
