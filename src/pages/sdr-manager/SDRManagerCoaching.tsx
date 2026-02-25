import { useState, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useSDRCoachingPrompts, useSDRTeams, useSDRTeamMembers, useUpdateCoachingPrompt, useCreateCoachingPrompt, type SDRCoachingPrompt } from '@/hooks/useSDR';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Plus, Save, ChevronDown, ChevronRight, Pencil, CheckCircle2, ThumbsUp, ThumbsDown, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

// ── Default prompt definitions (mirroring edge functions) ──────────────

const DEFAULT_PROMPTS: Array<{
  agent_key: 'splitter' | 'filter' | 'grader';
  friendly_name: string;
  description: string;
  system_prompt: string;
}> = [
  {
    agent_key: 'grader',
    friendly_name: 'Call Grading Criteria',
    description: 'Controls how each call is scored across 5 dimensions (opener, engagement, objection handling, appointment setting, professionalism) and assigns an overall letter grade.',
    system_prompt: `You are an expert SDR cold call coach. You grade individual cold calls on specific skills.

You will receive the transcript of a single SDR cold call. Grade it on these 5 dimensions (each scored 1-10):

## Scoring Dimensions:

### 1. Opener Score (opener_score)
- Did the SDR introduce themselves clearly?
- Did they reference a prior connection or reason for calling?
- Did they create enough curiosity to keep the prospect on the line?
- Were they warm and conversational vs robotic and scripted?

### 2. Engagement Score (engagement_score)
- Did the SDR ask questions about the prospect's needs/situation?
- Did they listen and respond to what the prospect said?
- Did they build rapport (casual conversation, empathy, humor)?
- Did the prospect stay engaged and participatory?

### 3. Objection Handling Score (objection_handling_score)
- If the prospect raised objections ("not interested", "send an email", "too busy"), how well did the SDR handle them?
- Did they acknowledge the objection before redirecting?
- Did they offer a low-commitment alternative?
- If no objections occurred, score based on how well they preempted potential resistance
- Score N/A as 5 (neutral) if truly no opportunity for objections

### 4. Appointment Setting Score (appointment_setting_score)
- Did the SDR attempt to book a meeting/demo?
- Did they suggest specific times?
- Did they confirm the prospect's email/calendar?
- Did they get a firm commitment vs a vague "maybe"?
- If an appointment was set: how smoothly was it handled?

### 5. Professionalism Score (professionalism_score)
- Was the SDR courteous and professional?
- Did they maintain a good pace (not rushing, not dragging)?
- Did they handle the call close well (clear next steps, friendly goodbye)?
- Were there any unprofessional moments?

## Overall Grade
Based on the weighted scores, assign an overall letter grade:
- A+ (9.5-10): Exceptional — textbook cold call
- A (8.5-9.4): Excellent — strong across all dimensions
- B (7-8.4): Good — solid performance with minor improvements needed
- C (5.5-6.9): Average — functional but significant improvement areas
- D (4-5.4): Below average — multiple weaknesses
- F (below 4): Poor — fundamental issues

## Meeting Scheduled
Set meeting_scheduled to true ONLY if a concrete meeting, demo, or appointment was confirmed with a specific date/time. Vague interest or "call me back" does not count.

## Response Format
Return a JSON object:
{
  "overall_grade": "A/B/C/D/F/A+",
  "opener_score": 1-10,
  "engagement_score": 1-10,
  "objection_handling_score": 1-10,
  "appointment_setting_score": 1-10,
  "professionalism_score": 1-10,
  "meeting_scheduled": true/false,
  "call_summary": "2-3 sentence summary of what happened on this call",
  "strengths": ["strength 1", "strength 2", ...],
  "improvements": ["improvement 1", "improvement 2", ...],
  "key_moments": [
    {"timestamp": "MM:SS", "description": "What happened", "sentiment": "positive/negative/neutral"}
  ],
  "coaching_notes": "1-2 paragraphs of specific, actionable coaching advice for this SDR based on this call"
}

Return ONLY valid JSON.`,
  },
  {
    agent_key: 'filter',
    friendly_name: 'Call Classification',
    description: 'Determines how transcript segments are categorized (conversation, voicemail, hangup, internal, reminder) and which count as meaningful calls.',
    system_prompt: `You are an expert at classifying SDR cold call transcript segments.

You will receive an array of transcript segments from an SDR's day. Classify each one.

## Classification types:
- **"conversation"**: A real interaction where the SDR spoke with a prospect/contact. The prospect answered, there was back-and-forth dialogue. This includes:
  - Cold calls where the prospect engaged (even briefly to say "not interested")
  - Callback conversations
  - Follow-up reminder calls where the prospect answered
- **"voicemail"**: The call went to voicemail. Either the SDR heard a VM greeting, or left a message. Very short segments with VM system prompts.
- **"hangup"**: Immediate disconnect — the prospect hung up instantly or the line went dead with minimal/no interaction.
- **"internal"**: Between-call chatter. The SDR talking to coworkers about non-work topics (food, sports, personal stories), or discussing work logistics (Salesforce, scheduling). NO prospect is on the line.
- **"reminder"**: The SDR called specifically to remind someone about an upcoming meeting (not a cold call pitch). Usually very short: "Hey, just calling to remind you about the call in 40 minutes."

## What counts as "meaningful" (is_meaningful = true):
A call is meaningful if it's a "conversation" type AND:
- The SDR actually spoke with a prospect (not a voicemail/machine)
- This includes prospects who declined, agreed to a meeting, gave a quick "not interested," or any other real human interaction
- Even a brief "no thanks" counts as meaningful — the SDR reached a real person

NOT meaningful:
- Voicemails, hangups, internal chatter, and reminder calls
- Automated systems / IVR menus with no human contact

## For each segment, also extract:
- **prospect_name**: The prospect's name if mentioned (null otherwise)
- **prospect_company**: Their company if mentioned (null otherwise)

Return a JSON object with a "calls" array. Each element:
{
  "segment_index": <0-based index matching input>,
  "call_type": "conversation" | "voicemail" | "hangup" | "internal" | "reminder",
  "is_meaningful": true/false,
  "prospect_name": "Name" or null,
  "prospect_company": "Company" or null,
  "reasoning": "Brief explanation of classification"
}

Return ONLY valid JSON.`,
  },
  {
    agent_key: 'splitter',
    friendly_name: 'Transcript Splitting',
    description: 'Controls how a full-day dialer transcript is split into individual call segments based on timestamp gaps, greeting patterns, and speaker changes.',
    system_prompt: `You are an expert transcript analyst specializing in SDR cold call dialer sessions.

You will receive a full-day transcript from an SDR's dialer system. This transcript contains MANY calls concatenated together — real conversations, voicemails, automated phone systems, hangups, and "in-between" chatter where the rep talks to coworkers while waiting for the next call.

Your job is to SPLIT this transcript into individual segments. Each segment represents one distinct phone interaction or one block of in-between chatter.

## How to detect call boundaries:
1. **Timestamp gaps**: A gap of 30+ seconds between lines, combined with a new greeting pattern, strongly indicates a new call
2. **New greeting patterns**: Lines like "Hello", "Hi, is this [name]?", "Hey [name], this is [rep name]" signal a new call starting
3. **Speaker label changes**: When "Speaker N" numbers reset or change significantly
4. **Voicemail system prompts**: "You have reached the voicemail of..." indicates a voicemail segment
5. **Automated phone systems**: "Thank you for calling...", "Press 1 for...", "Please listen carefully..." indicate IVR navigation
6. **In-between chatter**: Extended blocks where the rep talks casually (about food, sports, personal topics) without any prospect on the line — these are between-call idle time

## Important notes:
- The transcript uses the format: "Speaker N | MM:SS" or "username | MM:SS" or "username | HH:MM:SS"
- Some timestamps reset or use different formats — use context clues alongside timestamps
- A single "call" might include the rep navigating an IVR system to reach someone — keep that as one segment
- Voicemails that play during dialing (prospect's VM greeting) are their own short segment

Return a JSON array where each element has:
- "raw_text": The full text of that segment (preserve original formatting)
- "start_timestamp": The timestamp of the first line in the segment
- "approx_duration_seconds": Estimated duration based on timestamps (null if unclear)

Return ONLY valid JSON. No markdown, no explanation.`,
  },
];

// ── Component ──────────────────────────────────────────────────────────

function SDRManagerCoaching() {
  const { user } = useAuth();
  const { data: teams = [] } = useSDRTeams();
  const myTeam = teams.find(t => t.manager_id === user?.id);
  const { data: prompts = [], isLoading } = useSDRCoachingPrompts(myTeam?.id);
  const { data: members = [] } = useSDRTeamMembers(myTeam?.id);
  const memberIds = useMemo(() => members.map(m => m.user_id), [members]);

  // Fetch coaching feedback data for effectiveness card
  const { data: feedbackData } = useQuery({
    queryKey: ['coaching-feedback', memberIds.join(',')],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sdr_call_grades')
        .select('id, coaching_feedback_helpful, coaching_feedback_note, coaching_feedback_at, coaching_notes, sdr_id, call_id, overall_grade, created_at')
        .in('sdr_id', memberIds)
        .not('coaching_feedback_at', 'is', null)
        .order('coaching_feedback_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
    enabled: memberIds.length > 0,
    staleTime: 2 * 60 * 1000,
  });

  const feedbackStats = useMemo(() => {
    if (!feedbackData || feedbackData.length === 0) return null;
    const total = feedbackData.length;
    const positive = feedbackData.filter((f: any) => f.coaching_feedback_helpful === true).length;
    const negative = feedbackData.filter((f: any) => f.coaching_feedback_helpful === false);
    return {
      total,
      positive,
      pctPositive: Math.round((positive / total) * 100),
      recentNegative: negative.slice(0, 5),
    };
  }, [feedbackData]);

  const updateMutation = useUpdateCoachingPrompt();
  const createMutation = useCreateCoachingPrompt();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newPrompt, setNewPrompt] = useState<{ agent_key: string; prompt_name: string; system_prompt: string }>({ agent_key: 'grader', prompt_name: '', system_prompt: '' });
  const [expandedDefaults, setExpandedDefaults] = useState<Record<string, boolean>>({});

  const handleEdit = (prompt: SDRCoachingPrompt) => {
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
      agent_key: newPrompt.agent_key as 'grader' | 'filter' | 'splitter',
      prompt_name: newPrompt.prompt_name,
      system_prompt: newPrompt.system_prompt,
      team_id: myTeam.id,
      created_by: user!.id,
      is_active: true,
      scoring_weights: null,
    }, { onSuccess: () => { setShowCreate(false); setNewPrompt({ agent_key: 'grader', prompt_name: '', system_prompt: '' }); }});
  };

  const handleCustomize = (def: typeof DEFAULT_PROMPTS[number]) => {
    setNewPrompt({
      agent_key: def.agent_key,
      prompt_name: `Custom ${def.friendly_name}`,
      system_prompt: def.system_prompt,
    });
    setShowCreate(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Build a map of agent_key → active custom prompt name
  const overrideMap = new Map<string, string>();
  for (const p of prompts) {
    if (p.is_active) overrideMap.set(p.agent_key, p.prompt_name);
  }

  if (isLoading) {
    return <AppLayout><div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></AppLayout>;
  }

  return (
    <AppLayout>
      <main className="space-y-6">
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

        {/* Coaching Effectiveness Card */}
        {feedbackStats && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                <CardTitle>Coaching Effectiveness</CardTitle>
              </div>
              <CardDescription>Based on SDR feedback on coaching notes</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <div className="flex items-center justify-center gap-1.5 mb-1">
                    <ThumbsUp className="h-4 w-4 text-green-500" />
                    <span className="text-2xl font-bold">{feedbackStats.pctPositive}%</span>
                  </div>
                  <p className="text-sm text-muted-foreground">Positive feedback</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <p className="text-2xl font-bold mb-1">{feedbackStats.total}</p>
                  <p className="text-sm text-muted-foreground">Total responses</p>
                </div>
              </div>
              {feedbackStats.recentNegative.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                    <ThumbsDown className="h-3.5 w-3.5 text-red-500" />
                    Recent negative feedback
                  </h4>
                  <div className="space-y-2">
                    {feedbackStats.recentNegative.map((item: any) => (
                      <div key={item.id} className="text-sm p-3 rounded-lg border border-red-200/50 bg-red-50/30 dark:bg-red-950/10 dark:border-red-900/30">
                        <div className="flex items-center justify-between mb-1">
                          <Badge variant="outline" className="text-xs">{item.overall_grade}</Badge>
                          <span className="text-xs text-muted-foreground">
                            {item.coaching_feedback_at ? format(new Date(item.coaching_feedback_at), 'MMM d, yyyy') : ''}
                          </span>
                        </div>
                        {item.coaching_feedback_note ? (
                          <p className="text-muted-foreground">{item.coaching_feedback_note}</p>
                        ) : (
                          <p className="text-muted-foreground italic">No additional comments</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {showCreate && (
          <Card>
            <CardHeader><CardTitle>Create Coaching Prompt</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Agent</Label>
                  <Select value={newPrompt.agent_key} onValueChange={(v) => setNewPrompt({ ...newPrompt, agent_key: v })}>
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
                <Textarea aria-label="System prompt content" value={newPrompt.system_prompt} onChange={(e) => setNewPrompt({ ...newPrompt, system_prompt: e.target.value })} rows={10} className="font-mono text-sm" />
              </div>
              <Button onClick={handleCreate} disabled={createMutation.isPending}>
                {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Custom prompts */}
        {prompts.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Your Custom Prompts</h2>
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
                    <Textarea aria-label={`Edit system prompt for ${p.prompt_name}`} value={editText} onChange={(e) => setEditText(e.target.value)} rows={10} className="font-mono text-sm" />
                  ) : (
                    <pre className="whitespace-pre-wrap text-sm font-mono bg-muted/50 p-4 rounded-lg max-h-48 overflow-y-auto">{p.system_prompt}</pre>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* System default prompts */}
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">System Defaults</h2>
            <p className="text-sm text-muted-foreground">These are the built-in prompts used when no custom prompt is active. Click "Customize" to create your own version.</p>
          </div>
          {DEFAULT_PROMPTS.map((def) => {
            const isOpen = expandedDefaults[def.agent_key] ?? false;
            const overriddenBy = overrideMap.get(def.agent_key);
            return (
              <Card key={def.agent_key} className="border-dashed">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <CardTitle className="text-base">{def.friendly_name}</CardTitle>
                        <Badge variant="secondary" className="text-xs font-normal">{def.agent_key}</Badge>
                        {overriddenBy && (
                          <Badge variant="default" className="text-xs gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            Overridden by: {overriddenBy}
                          </Badge>
                        )}
                      </div>
                      <CardDescription className="mt-1">{def.description}</CardDescription>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => handleCustomize(def)} className="shrink-0">
                      <Pencil className="h-3.5 w-3.5 mr-1.5" />
                      Customize
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <Collapsible open={isOpen} onOpenChange={(open) => setExpandedDefaults(prev => ({ ...prev, [def.agent_key]: open }))}>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm" aria-expanded={isOpen} className="gap-1.5 text-muted-foreground px-0 hover:bg-transparent">
                        {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        {isOpen ? 'Hide prompt' : 'View prompt'}
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <pre className="whitespace-pre-wrap text-sm font-mono bg-muted/50 p-4 rounded-lg max-h-72 overflow-y-auto mt-2">{def.system_prompt}</pre>
                    </CollapsibleContent>
                  </Collapsible>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </main>
    </AppLayout>
  );
}

export default SDRManagerCoaching;
