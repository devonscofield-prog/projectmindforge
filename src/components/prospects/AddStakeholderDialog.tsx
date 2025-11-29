import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2 } from 'lucide-react';
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
      console.error('Failed to add stakeholder:', error);
      toast({ title: 'Failed to add stakeholder', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Stakeholder</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              placeholder="e.g., John Smith"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="jobTitle">Job Title</Label>
            <Input
              id="jobTitle"
              placeholder="e.g., VP of Operations"
              value={formData.jobTitle}
              onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="john@acme.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="(555) 123-4567"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="influenceLevel">Influence Level</Label>
            <Select
              value={formData.influenceLevel}
              onValueChange={(v) => setFormData({ ...formData, influenceLevel: v as StakeholderInfluenceLevel })}
            >
              <SelectTrigger id="influenceLevel">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(influenceLevelLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="isPrimary"
              checked={formData.isPrimaryContact}
              onCheckedChange={(checked) => 
                setFormData({ ...formData, isPrimaryContact: checked === true })
              }
            />
            <Label htmlFor="isPrimary" className="text-sm font-normal">
              Primary contact for this account
            </Label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                'Add Stakeholder'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}