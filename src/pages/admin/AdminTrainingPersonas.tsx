import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import {
  Bot,
  Plus,
  Search,
  Edit,
  Trash2,
  Volume2,
  Target,
  Users,
  AlertCircle,
} from 'lucide-react';
import { PersonaFormDialog } from '@/components/admin/PersonaFormDialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { PersonaFull } from '@/types/persona';

const difficultyColors: Record<string, string> = {
  easy: 'bg-green-500/10 text-green-600 border-green-500/30',
  medium: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
  hard: 'bg-red-500/10 text-red-600 border-red-500/30',
};

const discColors: Record<string, string> = {
  D: 'bg-red-500/10 text-red-600 border-red-500/30',
  I: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30',
  S: 'bg-green-500/10 text-green-600 border-green-500/30',
  C: 'bg-blue-500/10 text-blue-600 border-blue-500/30',
};

export default function AdminTrainingPersonas() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPersona, setSelectedPersona] = useState<PersonaFull | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [deletePersonaId, setDeletePersonaId] = useState<string | null>(null);

  // Fetch all personas
  const { data: personas, isLoading } = useQuery({
    queryKey: ['admin-personas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('roleplay_personas')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as PersonaFull[];
    },
  });

  // Toggle active status
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from('roleplay_personas')
        .update({ is_active: isActive })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-personas'] });
      toast.success('Persona status updated');
    },
    onError: (error) => {
      toast.error('Failed to update persona');
      console.error(error);
    },
  });

  // Delete persona
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      // First, unlink any sessions from this persona
      await supabase
        .from('roleplay_sessions')
        .update({ persona_id: null as any })
        .eq('persona_id', id);
      
      // Then delete the persona
      const { error } = await supabase
        .from('roleplay_personas')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-personas'] });
      toast.success('Persona deleted');
      setDeletePersonaId(null);
    },
    onError: (error) => {
      toast.error('Failed to delete persona');
      console.error(error);
    },
  });

  const filteredPersonas = personas?.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.persona_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.industry?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateNew = () => {
    setSelectedPersona(null);
    setIsFormOpen(true);
  };

  const handleEdit = (persona: PersonaFull) => {
    setSelectedPersona(persona);
    setIsFormOpen(true);
  };

  const handleFormClose = () => {
    setIsFormOpen(false);
    setSelectedPersona(null);
  };

  const handleFormSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-personas'] });
    handleFormClose();
  };

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Bot className="h-8 w-8 text-primary" />
              Training Personas
            </h1>
            <p className="text-muted-foreground mt-1">
              Create and manage AI personas for roleplay practice
            </p>
          </div>
          <Button onClick={handleCreateNew} className="gap-2">
            <Plus className="h-4 w-4" />
            Create Persona
          </Button>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search personas..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Stats */}
        {personas && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-2xl font-bold">{personas.length}</span>
                </div>
                <p className="text-sm text-muted-foreground">Total Personas</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-green-500" />
                  <span className="text-2xl font-bold">
                    {personas.filter(p => p.is_active).length}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">Active</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <Volume2 className="h-4 w-4 text-amber-500" />
                  <span className="text-2xl font-bold">
                    {personas.filter(p => p.difficulty_level === 'hard').length}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">Hard Difficulty</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <Bot className="h-4 w-4 text-blue-500" />
                  <span className="text-2xl font-bold">
                    {new Set(personas.map(p => p.persona_type)).size}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">Types</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Personas List */}
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        ) : filteredPersonas?.length === 0 ? (
          <Card className="p-12 text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Personas Found</h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery ? 'Try a different search term' : 'Create your first training persona'}
            </p>
            {!searchQuery && (
              <Button onClick={handleCreateNew}>
                <Plus className="h-4 w-4 mr-2" />
                Create Persona
              </Button>
            )}
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredPersonas?.map((persona) => (
              <Card key={persona.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Bot className="h-6 w-6 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-lg font-semibold">{persona.name}</h3>
                          {persona.disc_profile && (
                            <Badge variant="outline" className={discColors[persona.disc_profile] || ''}>
                              {persona.disc_profile}
                            </Badge>
                          )}
                          <Badge variant="outline" className={difficultyColors[persona.difficulty_level] || ''}>
                            {persona.difficulty_level}
                          </Badge>
                          {!persona.is_active && (
                            <Badge variant="secondary">Inactive</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1 capitalize">
                          {persona.persona_type.replace(/_/g, ' ')} • {persona.industry || 'General Industry'}
                        </p>
                        {persona.backstory && (
                          <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                            {persona.backstory}
                          </p>
                        )}
                        <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Volume2 className="h-3 w-3" />
                            Voice: {persona.voice}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Active</span>
                        <Switch
                          checked={persona.is_active}
                          onCheckedChange={(checked) => 
                            toggleActiveMutation.mutate({ id: persona.id, isActive: checked })
                          }
                        />
                      </div>
                      <Button variant="outline" size="icon" onClick={() => handleEdit(persona)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeletePersonaId(persona.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Form Dialog */}
        <PersonaFormDialog
          open={isFormOpen}
          onClose={handleFormClose}
          onSuccess={handleFormSuccess}
          persona={selectedPersona}
        />

        {/* Delete Confirmation */}
        <AlertDialog open={!!deletePersonaId} onOpenChange={() => setDeletePersonaId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Persona?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete this persona. Any existing sessions will be unlinked but preserved.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => deletePersonaId && deleteMutation.mutate(deletePersonaId)}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}
