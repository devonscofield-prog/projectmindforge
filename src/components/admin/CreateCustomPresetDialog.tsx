import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  FormInput,
  FormTextarea,
  FormSwitch,
  SubmitButton,
} from '@/components/ui/form-fields';
import { ANALYSIS_MODES, getAnalysisModeById } from '@/components/admin/transcript-analysis/analysisModesConfig';
import { createCustomPreset, updateCustomPreset, type CustomPreset } from '@/api/customPresets';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import {
  Layers,
  Target,
  Zap,
  Trophy,
  AlertTriangle,
  BarChart3,
  Users,
  Swords,
  FileQuestion,
  MessageSquareWarning,
  Gauge,
  Briefcase,
  GraduationCap,
  ClipboardCheck,
  X,
} from 'lucide-react';

const AVAILABLE_ICONS = [
  { name: 'layers', icon: Layers, label: 'Layers' },
  { name: 'target', icon: Target, label: 'Target' },
  { name: 'zap', icon: Zap, label: 'Zap' },
  { name: 'trophy', icon: Trophy, label: 'Trophy' },
  { name: 'alert-triangle', icon: AlertTriangle, label: 'Alert' },
  { name: 'bar-chart', icon: BarChart3, label: 'Chart' },
  { name: 'users', icon: Users, label: 'Users' },
  { name: 'swords', icon: Swords, label: 'Swords' },
  { name: 'file-question', icon: FileQuestion, label: 'Discovery' },
  { name: 'message-warning', icon: MessageSquareWarning, label: 'Objection' },
  { name: 'gauge', icon: Gauge, label: 'Gauge' },
  { name: 'briefcase', icon: Briefcase, label: 'Briefcase' },
  { name: 'graduation-cap', icon: GraduationCap, label: 'Training' },
  { name: 'clipboard-check', icon: ClipboardCheck, label: 'Checklist' },
];

export function getIconComponent(iconName: string) {
  const found = AVAILABLE_ICONS.find(i => i.name === iconName);
  return found?.icon || Layers;
}

interface CreateCustomPresetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingPreset?: CustomPreset | null;
  onSuccess: () => void;
}

export function CreateCustomPresetDialog({
  open,
  onOpenChange,
  editingPreset,
  onSuccess,
}: CreateCustomPresetDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedModes, setSelectedModes] = useState<string[]>([]);
  const [starterPrompt, setStarterPrompt] = useState('');
  const [iconName, setIconName] = useState('layers');
  const [isShared, setIsShared] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user } = useAuth();

  const isEditing = !!editingPreset;

  useEffect(() => {
    if (open) {
      if (editingPreset) {
        setName(editingPreset.name);
        setDescription(editingPreset.description || '');
        setSelectedModes(editingPreset.mode_ids);
        setStarterPrompt(editingPreset.starter_prompt);
        setIconName(editingPreset.icon_name || 'layers');
        setIsShared(editingPreset.is_shared);
      } else {
        setName('');
        setDescription('');
        setSelectedModes([]);
        setStarterPrompt('');
        setIconName('layers');
        setIsShared(false);
      }
    }
  }, [open, editingPreset]);

  const toggleMode = (modeId: string) => {
    setSelectedModes(prev => 
      prev.includes(modeId)
        ? prev.filter(id => id !== modeId)
        : [...prev, modeId]
    );
  };

  const generatePromptTemplate = () => {
    if (selectedModes.length === 0) return;
    
    const parts = selectedModes.map((modeId, index) => {
      const mode = getAnalysisModeById(modeId);
      if (!mode) return '';
      return `**PART ${index + 1}: ${mode.label.toUpperCase()}**\n[Analysis instructions for ${mode.label}]\n`;
    }).filter(Boolean);

    const template = `Perform a comprehensive analysis combining these areas:\n\n${parts.join('\n')}\n**SUMMARY**\n[Key findings and recommended actions]`;
    setStarterPrompt(template);
  };

  const handleSubmit = async () => {
    if (!name.trim() || selectedModes.length === 0 || !starterPrompt.trim()) {
      toast({
        title: 'Missing fields',
        description: 'Please fill in all required fields.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      if (isEditing && editingPreset) {
        await updateCustomPreset({
          id: editingPreset.id,
          name: name.trim(),
          description: description.trim() || undefined,
          mode_ids: selectedModes,
          starter_prompt: starterPrompt.trim(),
          icon_name: iconName,
          is_shared: isShared,
        });
        toast({
          title: 'Preset updated',
          description: 'Your custom preset has been updated.',
        });
      } else {
        if (!user) {
          throw new Error('You must be logged in to create presets');
        }
        await createCustomPreset(user.id, {
          name: name.trim(),
          description: description.trim() || undefined,
          mode_ids: selectedModes,
          starter_prompt: starterPrompt.trim(),
          icon_name: iconName,
          is_shared: isShared,
        });
        toast({
          title: 'Preset created',
          description: 'Your custom preset is now available.',
        });
      }
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save preset',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const SelectedIcon = getIconComponent(iconName);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SelectedIcon className="h-5 w-5 text-primary" />
            {isEditing ? 'Edit Custom Preset' : 'Create Custom Preset'}
          </DialogTitle>
          <DialogDescription>
            Build a reusable analysis preset by combining multiple analysis modes.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6 py-4">
            {/* Name and Icon */}
            <div className="grid grid-cols-[1fr,auto] gap-4">
              <FormInput
                label="Preset Name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Quarterly Business Review"
              />
              <div className="space-y-2">
                <Label>Icon</Label>
                <Select value={iconName} onValueChange={setIconName}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AVAILABLE_ICONS.map((item) => {
                      const Icon = item.icon;
                      return (
                        <SelectItem key={item.name} value={item.name}>
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4" />
                            <span>{item.label}</span>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Description */}
            <FormInput
              label="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of what this preset analyzes"
            />

            {/* Mode Selection */}
            <div className="space-y-2">
              <Label>Analysis Modes <span className="text-destructive">*</span></Label>
              <p className="text-xs text-muted-foreground mb-2">
                Select the modes to combine in this preset
              </p>
              <div className="grid grid-cols-2 gap-2">
                {ANALYSIS_MODES.filter(m => m.id !== 'general').map((mode) => {
                  const Icon = mode.icon;
                  const isSelected = selectedModes.includes(mode.id);
                  return (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => toggleMode(mode.id)}
                      className={`flex items-center gap-2 p-2 text-left text-sm rounded-lg border transition-colors ${
                        isSelected 
                          ? 'border-primary bg-primary/10 text-primary' 
                          : 'hover:bg-muted/50'
                      }`}
                    >
                      <Checkbox checked={isSelected} />
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{mode.label}</span>
                    </button>
                  );
                })}
              </div>
              {selectedModes.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {selectedModes.map(id => {
                    const mode = getAnalysisModeById(id);
                    if (!mode) return null;
                    const MIcon = mode.icon;
                    return (
                      <Badge key={id} variant="secondary" className="gap-1">
                        <MIcon className="h-3 w-3" />
                        {mode.label}
                        <button
                          type="button"
                          onClick={() => toggleMode(id)}
                          className="ml-1 hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Starter Prompt */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Starter Prompt <span className="text-destructive">*</span></Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={generatePromptTemplate}
                  disabled={selectedModes.length === 0}
                  className="h-7 text-xs"
                >
                  <Zap className="h-3 w-3 mr-1" />
                  Generate Template
                </Button>
              </div>
              <FormTextarea
                label=""
                value={starterPrompt}
                onChange={(e) => setStarterPrompt(e.target.value)}
                placeholder="Write the comprehensive prompt that will be sent when this preset is selected..."
                className="min-h-[200px] font-mono text-sm"
                description="This prompt will be sent automatically when the preset is selected."
              />
            </div>

            {/* Share Toggle */}
            <FormSwitch
              label="Share with team"
              description="Allow other admins to use this preset"
              checked={isShared}
              onCheckedChange={setIsShared}
              variant="card"
            />
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <SubmitButton
            onClick={handleSubmit}
            isLoading={isSubmitting}
            loadingText={isEditing ? 'Saving...' : 'Creating...'}
          >
            {isEditing ? 'Save Changes' : 'Create Preset'}
          </SubmitButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
