import { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { 
  Crown, 
  Star, 
  User,
  Mail,
  Phone,
  Calendar,
  Trash2,
  Save,
  Loader2,
} from 'lucide-react';
import { format } from 'date-fns';
import {
  updateStakeholder,
  deleteStakeholder,
  setPrimaryStakeholder,
  type Stakeholder,
  type StakeholderInfluenceLevel,
  influenceLevelLabels,
} from '@/api/stakeholders';
import { toast } from 'sonner';

interface StakeholderDetailSheetProps {
  stakeholder: Stakeholder | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
  onDeleted: () => void;
}

const influenceLevelIcons: Record<StakeholderInfluenceLevel, React.ElementType> = {
  final_dm: Crown,
  secondary_dm: Star,
  heavy_influencer: User,
  light_influencer: User,
  self_pay: User,
};

function ChampionScoreBar({ score }: { score: number | null }) {
  if (score === null) return <span className="text-muted-foreground">Not evaluated</span>;

  const percentage = (score / 10) * 100;
  let colorClass = 'bg-muted-foreground';
  let textColor = 'text-muted-foreground';
  
  if (score >= 8) {
    colorClass = 'bg-green-500';
    textColor = 'text-green-600';
  } else if (score >= 6) {
    colorClass = 'bg-yellow-500';
    textColor = 'text-yellow-600';
  } else if (score >= 4) {
    colorClass = 'bg-orange-500';
    textColor = 'text-orange-600';
  } else {
    colorClass = 'bg-red-500';
    textColor = 'text-red-600';
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Champion Score</span>
        <span className={`text-lg font-bold ${textColor}`}>{score}/10</span>
      </div>
      <div className="h-3 bg-muted rounded-full overflow-hidden">
        <div 
          className={`h-full ${colorClass} transition-all`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

export function StakeholderDetailSheet({
  stakeholder,
  open,
  onOpenChange,
  onUpdated,
  onDeleted,
}: StakeholderDetailSheetProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSettingPrimary, setIsSettingPrimary] = useState(false);
  const [editData, setEditData] = useState({
    name: '',
    job_title: '',
    email: '',
    phone: '',
    influence_level: 'light_influencer' as StakeholderInfluenceLevel,
  });

  // Reset state when stakeholder changes
  if (stakeholder && editData.name !== stakeholder.name && !isEditing) {
    setEditData({
      name: stakeholder.name,
      job_title: stakeholder.job_title || '',
      email: stakeholder.email || '',
      phone: stakeholder.phone || '',
      influence_level: stakeholder.influence_level,
    });
  }

  const handleStartEdit = () => {
    if (stakeholder) {
      setEditData({
        name: stakeholder.name,
        job_title: stakeholder.job_title || '',
        email: stakeholder.email || '',
        phone: stakeholder.phone || '',
        influence_level: stakeholder.influence_level,
      });
      setIsEditing(true);
    }
  };

  const handleSave = async () => {
    if (!stakeholder) return;
    
    setIsSaving(true);
    try {
      await updateStakeholder(stakeholder.id, {
        name: editData.name.trim(),
        job_title: editData.job_title.trim() || undefined,
        email: editData.email.trim() || undefined,
        phone: editData.phone.trim() || undefined,
        influence_level: editData.influence_level,
      });
      
      toast.success('Stakeholder updated');
      setIsEditing(false);
      onUpdated();
    } catch (error) {
      toast.error('Failed to update stakeholder');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!stakeholder) return;
    
    setIsDeleting(true);
    try {
      await deleteStakeholder(stakeholder.id);
      toast.success('Stakeholder deleted');
      onOpenChange(false);
      onDeleted();
    } catch (error) {
      toast.error('Failed to delete stakeholder');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSetPrimary = async () => {
    if (!stakeholder) return;
    
    setIsSettingPrimary(true);
    try {
      await setPrimaryStakeholder(stakeholder.prospect_id, stakeholder.id);
      toast.success('Primary contact updated');
      onUpdated();
    } catch (error) {
      toast.error('Failed to set primary contact');
    } finally {
      setIsSettingPrimary(false);
    }
  };

  if (!stakeholder) return null;

  const InfluenceIcon = influenceLevelIcons[stakeholder.influence_level];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-primary/10">
              <InfluenceIcon className="h-6 w-6 text-primary" />
            </div>
            <div>
              <SheetTitle className="flex items-center gap-2">
                {stakeholder.name}
                {stakeholder.is_primary_contact && (
                  <Badge variant="secondary" className="gap-1">
                    <Crown className="h-3 w-3" />
                    Primary
                  </Badge>
                )}
              </SheetTitle>
              <SheetDescription>
                {stakeholder.job_title || 'No job title'}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Set as Primary Button */}
          {!stakeholder.is_primary_contact && (
            <Button 
              variant="outline" 
              onClick={handleSetPrimary}
              disabled={isSettingPrimary}
              className="w-full gap-2"
            >
              {isSettingPrimary ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Crown className="h-4 w-4 text-amber-500" />
              )}
              Set as Primary Contact
            </Button>
          )}

          {/* Influence Level Badge */}
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-sm py-1">
              {influenceLevelLabels[stakeholder.influence_level]}
            </Badge>
          </div>

          {/* Champion Score */}
          <ChampionScoreBar score={stakeholder.champion_score} />
          
          {stakeholder.champion_score_reasoning && (
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm italic">"{stakeholder.champion_score_reasoning}"</p>
            </div>
          )}

          <Separator />

          {/* Contact Info / Edit Form */}
          {isEditing ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Name</Label>
                <Input
                  id="edit-name"
                  value={editData.name}
                  onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-title">Job Title</Label>
                <Input
                  id="edit-title"
                  value={editData.job_title}
                  onChange={(e) => setEditData({ ...editData, job_title: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={editData.email}
                  onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-phone">Phone</Label>
                <Input
                  id="edit-phone"
                  type="tel"
                  value={editData.phone}
                  onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-influence">Influence Level</Label>
                <Select
                  value={editData.influence_level}
                  onValueChange={(v) => setEditData({ ...editData, influence_level: v as StakeholderInfluenceLevel })}
                >
                  <SelectTrigger id="edit-influence">
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
              <div className="flex gap-2">
                <Button onClick={handleSave} disabled={isSaving} className="flex-1">
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                  Save
                </Button>
                <Button variant="outline" onClick={() => setIsEditing(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <h4 className="text-sm font-medium">Contact Information</h4>
              <div className="space-y-3">
                {stakeholder.email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <a href={`mailto:${stakeholder.email}`} className="hover:underline">
                      {stakeholder.email}
                    </a>
                  </div>
                )}
                {stakeholder.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <a href={`tel:${stakeholder.phone}`} className="hover:underline">
                      {stakeholder.phone}
                    </a>
                  </div>
                )}
                {stakeholder.last_interaction_date && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    Last interaction: {format(new Date(stakeholder.last_interaction_date), 'MMM d, yyyy')}
                  </div>
                )}
                {!stakeholder.email && !stakeholder.phone && (
                  <p className="text-sm text-muted-foreground">No contact info available</p>
                )}
              </div>
              
              <Button variant="outline" onClick={handleStartEdit} className="w-full">
                Edit Stakeholder
              </Button>
            </div>
          )}

          {/* AI Notes */}
          {stakeholder.ai_extracted_info && (
            <>
              <Separator />
              <div className="space-y-3">
                <h4 className="text-sm font-medium">AI Insights</h4>
                {stakeholder.ai_extracted_info.communication_style && (
                  <div>
                    <p className="text-xs text-muted-foreground">Communication Style</p>
                    <p className="text-sm">{stakeholder.ai_extracted_info.communication_style}</p>
                  </div>
                )}
                {stakeholder.ai_extracted_info.priorities && stakeholder.ai_extracted_info.priorities.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground">Priorities</p>
                    <ul className="text-sm list-disc pl-4">
                      {stakeholder.ai_extracted_info.priorities.map((p, i) => (
                        <li key={i}>{p}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {stakeholder.ai_extracted_info.concerns && stakeholder.ai_extracted_info.concerns.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground">Concerns</p>
                    <ul className="text-sm list-disc pl-4">
                      {stakeholder.ai_extracted_info.concerns.map((c, i) => (
                        <li key={i}>{c}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </>
          )}

          <Separator />

          {/* Delete Button */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="w-full">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Stakeholder
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Stakeholder?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete {stakeholder.name} from this account. 
                  This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} disabled={isDeleting}>
                  {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </SheetContent>
    </Sheet>
  );
}
