import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Loader2, Plus, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { PersonaFull } from '@/types/persona';

interface PersonaFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  persona: PersonaFull | null;
}

const VALID_VOICES = ['alloy', 'ash', 'ballad', 'coral', 'echo', 'sage', 'shimmer', 'verse', 'marin', 'cedar'];

const DISC_PROFILES = [
  { value: 'D', label: 'D - Dominant (Direct, Decisive)' },
  { value: 'I', label: 'I - Influential (Enthusiastic, Optimistic)' },
  { value: 'S', label: 'S - Steady (Patient, Reliable)' },
  { value: 'C', label: 'C - Conscientious (Analytical, Precise)' },
];

const DIFFICULTY_LEVELS = ['easy', 'medium', 'hard'];

const PERSONA_TYPES = [
  'it_director',
  'cfo',
  'cto',
  'vp_sales',
  'hr_director',
  'procurement_manager',
  'end_user',
  'technical_buyer',
  'economic_buyer',
  'champion',
  'skeptic',
];

export function PersonaFormDialog({ open, onClose, onSuccess, persona }: PersonaFormDialogProps) {
  const isEditing = !!persona;
  
  // Basic info
  const [name, setName] = useState('');
  const [personaType, setPersonaType] = useState('it_director');
  const [discProfile, setDiscProfile] = useState('S');
  const [difficulty, setDifficulty] = useState('medium');
  const [industry, setIndustry] = useState('');
  const [voice, setVoice] = useState('sage');
  const [backstory, setBackstory] = useState('');
  
  // Pain points (simple list)
  const [painPoints, setPainPoints] = useState<string[]>([]);
  const [newPainPoint, setNewPainPoint] = useState('');
  
  // Objections (simple list)
  const [objections, setObjections] = useState<string[]>([]);
  const [newObjection, setNewObjection] = useState('');
  
  // Dos and Don'ts
  const [dos, setDos] = useState<string[]>([]);
  const [donts, setDonts] = useState<string[]>([]);
  const [newDo, setNewDo] = useState('');
  const [newDont, setNewDont] = useState('');

  // Reset form when persona changes
  useEffect(() => {
    if (persona) {
      setName(persona.name);
      setPersonaType(persona.persona_type);
      setDiscProfile(persona.disc_profile || 'S');
      setDifficulty(persona.difficulty_level);
      setIndustry(persona.industry || '');
      setVoice(persona.voice);
      setBackstory(persona.backstory || '');
      
      // Parse pain points
      const pp = persona.pain_points as Array<{ pain: string }> | null;
      setPainPoints(pp?.map(p => p.pain) || []);
      
      // Parse objections
      const obj = persona.common_objections as Array<{ objection: string }> | null;
      setObjections(obj?.map(o => o.objection) || []);
      
      // Parse dos and donts
      const dd = persona.dos_and_donts as { dos?: string[]; donts?: string[] } | null;
      setDos(dd?.dos || []);
      setDonts(dd?.donts || []);
    } else {
      // Reset to defaults
      setName('');
      setPersonaType('it_director');
      setDiscProfile('S');
      setDifficulty('medium');
      setIndustry('');
      setVoice('sage');
      setBackstory('');
      setPainPoints([]);
      setObjections([]);
      setDos([]);
      setDonts([]);
    }
  }, [persona, open]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const data = {
        name,
        persona_type: personaType,
        disc_profile: discProfile,
        difficulty_level: difficulty,
        industry: industry || null,
        voice,
        backstory: backstory || null,
        is_active: true,
        pain_points: painPoints.map(pain => ({ pain, severity: 'medium', visible: true })),
        common_objections: objections.map(objection => ({ objection, category: 'general', severity: 'medium' })),
        dos_and_donts: { dos, donts },
        communication_style: {
          tone: discProfile === 'D' ? 'direct' : discProfile === 'I' ? 'enthusiastic' : discProfile === 'C' ? 'analytical' : 'steady',
          default_response_length: discProfile === 'D' ? 'short' : 'medium',
        },
      };

      if (isEditing) {
        const { error } = await supabase
          .from('roleplay_personas')
          .update(data)
          .eq('id', persona.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('roleplay_personas')
          .insert(data);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(isEditing ? 'Persona updated' : 'Persona created');
      onSuccess();
    },
    onError: (error) => {
      toast.error('Failed to save persona');
      console.error(error);
    },
  });

  const addPainPoint = () => {
    if (newPainPoint.trim()) {
      setPainPoints([...painPoints, newPainPoint.trim()]);
      setNewPainPoint('');
    }
  };

  const addObjection = () => {
    if (newObjection.trim()) {
      setObjections([...objections, newObjection.trim()]);
      setNewObjection('');
    }
  };

  const addDo = () => {
    if (newDo.trim()) {
      setDos([...dos, newDo.trim()]);
      setNewDo('');
    }
  };

  const addDont = () => {
    if (newDont.trim()) {
      setDonts([...donts, newDont.trim()]);
      setNewDont('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Persona' : 'Create New Persona'}</DialogTitle>
          <DialogDescription>
            Configure the AI persona's personality, behavior, and grading criteria
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="basic" className="mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="basic">Basic Info</TabsTrigger>
            <TabsTrigger value="behavior">Behavior</TabsTrigger>
            <TabsTrigger value="challenges">Challenges</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Sarah Mitchell"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="industry">Industry</Label>
                <Input
                  id="industry"
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  placeholder="e.g., Financial Services"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Persona Type *</Label>
                <Select value={personaType} onValueChange={setPersonaType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PERSONA_TYPES.map(type => (
                      <SelectItem key={type} value={type} className="capitalize">
                        {type.replace(/_/g, ' ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>DISC Profile *</Label>
                <Select value={discProfile} onValueChange={setDiscProfile}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DISC_PROFILES.map(profile => (
                      <SelectItem key={profile.value} value={profile.value}>
                        {profile.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Difficulty Level *</Label>
                <Select value={difficulty} onValueChange={setDifficulty}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DIFFICULTY_LEVELS.map(level => (
                      <SelectItem key={level} value={level} className="capitalize">
                        {level}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Voice *</Label>
                <Select value={voice} onValueChange={setVoice}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VALID_VOICES.map(v => (
                      <SelectItem key={v} value={v} className="capitalize">
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="backstory">Backstory</Label>
              <Textarea
                id="backstory"
                value={backstory}
                onChange={(e) => setBackstory(e.target.value)}
                placeholder="Describe the persona's background, role, and context..."
                rows={4}
              />
            </div>
          </TabsContent>

          <TabsContent value="behavior" className="space-y-6 mt-4">
            {/* Dos */}
            <div className="space-y-2">
              <Label>What Works With This Persona</Label>
              <div className="flex gap-2">
                <Input
                  value={newDo}
                  onChange={(e) => setNewDo(e.target.value)}
                  placeholder="e.g., Be direct and get to the point"
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addDo())}
                />
                <Button type="button" variant="outline" size="icon" onClick={addDo}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {dos.map((item, idx) => (
                  <Badge key={idx} variant="secondary" className="gap-1">
                    {item}
                    <button onClick={() => setDos(dos.filter((_, i) => i !== idx))}>
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>

            {/* Don'ts */}
            <div className="space-y-2">
              <Label>What Irritates This Persona</Label>
              <div className="flex gap-2">
                <Input
                  value={newDont}
                  onChange={(e) => setNewDont(e.target.value)}
                  placeholder="e.g., Wasting time with small talk"
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addDont())}
                />
                <Button type="button" variant="outline" size="icon" onClick={addDont}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {donts.map((item, idx) => (
                  <Badge key={idx} variant="destructive" className="gap-1">
                    {item}
                    <button onClick={() => setDonts(donts.filter((_, i) => i !== idx))}>
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="challenges" className="space-y-6 mt-4">
            {/* Pain Points */}
            <div className="space-y-2">
              <Label>Pain Points</Label>
              <p className="text-sm text-muted-foreground">
                Challenges this persona faces that the rep should uncover
              </p>
              <div className="flex gap-2">
                <Input
                  value={newPainPoint}
                  onChange={(e) => setNewPainPoint(e.target.value)}
                  placeholder="e.g., Single point of failure for Azure expertise"
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addPainPoint())}
                />
                <Button type="button" variant="outline" size="icon" onClick={addPainPoint}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-2 mt-2">
                {painPoints.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-2 bg-secondary/50 rounded">
                    <span className="flex-1 text-sm">{item}</span>
                    <button 
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => setPainPoints(painPoints.filter((_, i) => i !== idx))}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Objections */}
            <div className="space-y-2">
              <Label>Common Objections</Label>
              <p className="text-sm text-muted-foreground">
                Objections this persona will raise during the call
              </p>
              <div className="flex gap-2">
                <Input
                  value={newObjection}
                  onChange={(e) => setNewObjection(e.target.value)}
                  placeholder="e.g., We tried online training before and nobody used it"
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addObjection())}
                />
                <Button type="button" variant="outline" size="icon" onClick={addObjection}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-2 mt-2">
                {objections.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-2 bg-amber-500/10 rounded">
                    <span className="flex-1 text-sm">"{item}"</span>
                    <button 
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => setObjections(objections.filter((_, i) => i !== idx))}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={() => saveMutation.mutate()} 
            disabled={!name.trim() || saveMutation.isPending}
          >
            {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isEditing ? 'Save Changes' : 'Create Persona'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
