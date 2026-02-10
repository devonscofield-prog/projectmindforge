import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useSDRCoachingPrompts, useSDRTeams, useUpdateCoachingPrompt, useCreateCoachingPrompt } from '@/hooks/useSDR';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, Plus, Save } from 'lucide-react';
import { toast } from 'sonner';

function SDRManagerCoaching() {
  const { user } = useAuth();
  const { data: teams = [] } = useSDRTeams();
  const myTeam = teams.find(t => t.manager_id === user?.id);
  const { data: prompts = [], isLoading } = useSDRCoachingPrompts(myTeam?.id);
  const updateMutation = useUpdateCoachingPrompt();
  const createMutation = useCreateCoachingPrompt();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newPrompt, setNewPrompt] = useState({ agent_key: 'grader' as const, prompt_name: '', system_prompt: '' });

  const handleEdit = (prompt: any) => {
    setEditingId(prompt.id);
    setEditText(prompt.system_prompt);
  };

  const handleSave = (id: string) => {
    updateMutation.mutate({ id, system_prompt: editText }, { onSuccess: () => setEditingId(null) });
  };

  const handleCreate = () => {
    if (!myTeam || !newPrompt.prompt_name || !newPrompt.system_prompt) {
      toast.error('Please fill in all fields');
      return;
    }
    createMutation.mutate({
      ...newPrompt,
      team_id: myTeam.id,
      created_by: user!.id,
      is_active: true,
      scoring_weights: null,
    }, { onSuccess: () => { setShowCreate(false); setNewPrompt({ agent_key: 'grader', prompt_name: '', system_prompt: '' }); }});
  };

  if (isLoading) {
    return <AppLayout><div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Coaching Prompts</h1>
            <p className="text-muted-foreground">Customize how your team's calls are graded</p>
          </div>
          <Button onClick={() => setShowCreate(!showCreate)}>
            <Plus className="h-4 w-4 mr-2" />
            New Prompt
          </Button>
        </div>

        {showCreate && (
          <Card>
            <CardHeader><CardTitle>Create Coaching Prompt</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Agent</Label>
                  <Select value={newPrompt.agent_key} onValueChange={(v: any) => setNewPrompt({ ...newPrompt, agent_key: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="grader">Grader</SelectItem>
                      <SelectItem value="filter">Filter</SelectItem>
                      <SelectItem value="splitter">Splitter</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Prompt Name</Label>
                  <Input value={newPrompt.prompt_name} onChange={(e) => setNewPrompt({ ...newPrompt, prompt_name: e.target.value })} placeholder="e.g. Custom Grader v1" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>System Prompt</Label>
                <Textarea value={newPrompt.system_prompt} onChange={(e) => setNewPrompt({ ...newPrompt, system_prompt: e.target.value })} rows={10} className="font-mono text-sm" />
              </div>
              <Button onClick={handleCreate} disabled={createMutation.isPending}>
                {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create
              </Button>
            </CardContent>
          </Card>
        )}

        {prompts.length === 0 && !showCreate ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">No custom prompts yet. The system uses default prompts.</p>
              <p className="text-sm text-muted-foreground mt-1">Create a custom prompt to override the defaults for your team.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {prompts.map((p) => (
              <Card key={p.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>{p.prompt_name}</CardTitle>
                      <CardDescription>Agent: {p.agent_key} • {p.is_active ? 'Active' : 'Inactive'}</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={p.is_active} onCheckedChange={(checked) => updateMutation.mutate({ id: p.id, is_active: checked })} />
                      {editingId === p.id ? (
                        <Button size="sm" onClick={() => handleSave(p.id)}>
                          <Save className="h-4 w-4 mr-1" /> Save
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => handleEdit(p)}>Edit</Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {editingId === p.id ? (
                    <Textarea value={editText} onChange={(e) => setEditText(e.target.value)} rows={10} className="font-mono text-sm" />
                  ) : (
                    <pre className="whitespace-pre-wrap text-sm font-mono bg-muted/50 p-4 rounded-lg max-h-48 overflow-y-auto">{p.system_prompt}</pre>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

export default SDRManagerCoaching;
