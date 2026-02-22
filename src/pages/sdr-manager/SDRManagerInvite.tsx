import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';

// TODO: Remove once sdr_team_invites is added to generated Supabase types
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sdrTeamInvitesTable = () => (supabase.from as (table: string) => ReturnType<typeof supabase.from>)('sdr_team_invites');
import { withPageErrorBoundary } from '@/components/ui/page-error-boundary';
import { useAuth } from '@/contexts/AuthContext';
import { sdrKeys, useSDRTeams } from '@/hooks/useSDR';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { UserPlus, Copy, CheckCircle2, Mail, Link2, ArrowLeft, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const log = createLogger('SDRManagerInvite');

interface InviteResult {
  success: boolean;
  email: string;
  name: string;
  inviteLink?: string;
  emailSent?: boolean;
  emailError?: string;
}

interface TeamInviteLink {
  id: string;
  invite_token: string;
  is_active: boolean;
  max_uses: number | null;
  times_used: number;
  expires_at: string | null;
  created_at: string;
}

function SDRManagerInvite() {
  const { user } = useAuth();
  const { data: teams = [] } = useSDRTeams();
  const myTeam = teams.find(t => t.manager_id === user?.id);
  const queryClient = useQueryClient();

  // Direct invite form state
  const [formData, setFormData] = useState({ email: '', name: '' });
  const [inviting, setInviting] = useState(false);
  const [inviteResult, setInviteResult] = useState<InviteResult | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Team invite link state
  const [copiedTeamLink, setCopiedTeamLink] = useState(false);

  // Fetch existing team invite links
  const { data: teamInviteLinks = [], isLoading: linksLoading } = useQuery({
    queryKey: sdrKeys.teamInviteLinks(myTeam?.id),
    queryFn: async () => {
      if (!myTeam?.id) return [];
      const { data, error } = await sdrTeamInvitesTable()
        .select('*')
        .eq('team_id', myTeam.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as TeamInviteLink[];
    },
    enabled: !!myTeam?.id,
  });

  const activeLink = teamInviteLinks[0];

  // Generate new team invite link
  const generateLinkMutation = useMutation({
    mutationFn: async () => {
      if (!myTeam?.id) throw new Error('No team found');
      const { data, error } = await sdrTeamInvitesTable()
        .insert({
          team_id: myTeam.id,
          created_by: user!.id,
        })
        .select()
        .single();
      if (error) throw error;
      return data as TeamInviteLink;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sdrKeys.teamInviteLinks(myTeam?.id) });
      toast.success('Team signup link generated');
    },
    onError: (error) => {
      toast.error('Failed to generate link: ' + (error as Error).message);
    },
  });

  // Deactivate a link
  const deactivateLinkMutation = useMutation({
    mutationFn: async (linkId: string) => {
      const { error } = await sdrTeamInvitesTable()
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', linkId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sdrKeys.teamInviteLinks(myTeam?.id) });
      toast.success('Invite link deactivated');
    },
  });

  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.email.trim() || !formData.name.trim()) {
      toast.error('Email and name are required');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      toast.error('Please enter a valid email address');
      return;
    }

    if (!myTeam) {
      toast.error('You must be assigned to an SDR team to invite members');
      return;
    }

    setInviting(true);
    setInviteResult(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('You must be logged in to invite users');
        return;
      }

      const response = await supabase.functions.invoke('invite-user', {
        body: {
          email: formData.email.trim(),
          name: formData.name.trim(),
          role: 'sdr',
          sdrTeamId: myTeam.id,
          sendEmail: true,
          redirectTo: window.location.origin,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const result = response.data;

      setInviteResult({
        success: true,
        email: formData.email,
        name: formData.name,
        inviteLink: result.inviteLink,
        emailSent: result.emailSent,
        emailError: result.emailError,
      });

      toast.success(result.emailSent
        ? `Invitation email sent to ${formData.email}`
        : `User created - share the invite link with ${formData.email}`);

      setFormData({ email: '', name: '' });
    } catch (error) {
      log.error('Failed to invite user', { error });
      const errorMessage = error instanceof Error ? error.message : 'Failed to send invitation';
      toast.error(errorMessage);
    } finally {
      setInviting(false);
    }
  };

  const handleCopyLink = async () => {
    if (inviteResult?.inviteLink) {
      await navigator.clipboard.writeText(inviteResult.inviteLink);
      setCopiedLink(true);
      toast.success('Invite link copied to clipboard');
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const getTeamSignupUrl = (token: string) => {
    return `${window.location.origin}/join/${token}`;
  };

  const handleCopyTeamLink = async () => {
    if (activeLink) {
      await navigator.clipboard.writeText(getTeamSignupUrl(activeLink.invite_token));
      setCopiedTeamLink(true);
      toast.success('Team signup link copied to clipboard');
      setTimeout(() => setCopiedTeamLink(false), 2000);
    }
  };

  if (!myTeam) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Invite Team Members</h1>
            <p className="text-muted-foreground mt-1">You are not assigned to an SDR team. Please contact an administrator.</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Invite Team Members</h1>
            <p className="text-muted-foreground mt-1">Add new SDRs to {myTeam.name}</p>
          </div>
          <Button variant="outline" asChild>
            <Link to="/sdr-manager">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Link>
          </Button>
        </div>

        <Tabs defaultValue="invite" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="invite">
              <Mail className="h-4 w-4 mr-2" />
              Direct Invite
            </TabsTrigger>
            <TabsTrigger value="link">
              <Link2 className="h-4 w-4 mr-2" />
              Signup Link
            </TabsTrigger>
          </TabsList>

          {/* Direct Invite Tab */}
          <TabsContent value="invite">
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <UserPlus className="h-5 w-5" />
                    Invite SDR
                  </CardTitle>
                  <CardDescription>
                    Send an email invitation to a new team member. They'll be added to {myTeam.name} as an SDR.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleInviteUser} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">Email Address *</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="user@stormwindlive.com"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="name">Full Name *</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="John Doe"
                        required
                      />
                    </div>

                    <Alert>
                      <AlertDescription className="text-sm">
                        The user will be assigned the <strong>SDR</strong> role and added to <strong>{myTeam.name}</strong>.
                      </AlertDescription>
                    </Alert>

                    <Button type="submit" variant="gradient" className="w-full" disabled={inviting}>
                      <Mail className="h-4 w-4 mr-2" />
                      {inviting ? 'Sending Invitation...' : 'Send Invitation'}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              <div className="space-y-4">
                {inviteResult && (
                  <Card className="border-primary/50 bg-primary/5">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-primary">
                        <CheckCircle2 className="h-5 w-5" />
                        Invitation Sent
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Email:</span>
                          <span className="font-medium">{inviteResult.email}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Name:</span>
                          <span className="font-medium">{inviteResult.name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Role:</span>
                          <span className="font-medium">SDR</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Team:</span>
                          <span className="font-medium">{myTeam.name}</span>
                        </div>
                      </div>

                      {inviteResult.inviteLink && (
                        <>
                          <Alert className={inviteResult.emailSent ? '' : 'border-amber-500/50 bg-amber-500/10'}>
                            <AlertDescription className="text-sm">
                              {inviteResult.emailSent
                                ? 'An email invitation has been sent. You can also share the link below.'
                                : inviteResult.emailError
                                  ? `Email could not be sent (${inviteResult.emailError}). Please share the link below manually.`
                                  : 'Share the link below with the user to complete their setup.'}
                            </AlertDescription>
                          </Alert>

                          <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground">Invite Link</Label>
                            <div className="flex gap-2">
                              <Input
                                value={inviteResult.inviteLink}
                                readOnly
                                className="font-mono text-xs"
                              />
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={handleCopyLink}
                                className={copiedLink ? 'bg-primary text-primary-foreground' : ''}
                              >
                                {copiedLink ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                              </Button>
                            </div>
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                )}

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">How It Works</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex gap-3">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-xs">1</div>
                      <p className="text-muted-foreground">User receives an invitation email with a secure link</p>
                    </div>
                    <div className="flex gap-3">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-xs">2</div>
                      <p className="text-muted-foreground">They click the link and set their own password</p>
                    </div>
                    <div className="flex gap-3">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-xs">3</div>
                      <p className="text-muted-foreground">They're automatically added to {myTeam.name} as an SDR</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Signup Link Tab */}
          <TabsContent value="link">
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Link2 className="h-5 w-5" />
                    Team Signup Link
                  </CardTitle>
                  <CardDescription>
                    Generate a shareable link that lets people sign up and join {myTeam.name}.
                    Only <strong>@stormwindlive.com</strong> email addresses are accepted.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {linksLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : activeLink ? (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Shareable Signup Link</Label>
                        <div className="flex gap-2">
                          <Input
                            value={getTeamSignupUrl(activeLink.invite_token)}
                            readOnly
                            className="font-mono text-xs"
                          />
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={handleCopyTeamLink}
                            className={copiedTeamLink ? 'bg-primary text-primary-foreground' : ''}
                          >
                            {copiedTeamLink ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>

                      <div className="text-sm text-muted-foreground space-y-1">
                        <p>Used <strong>{activeLink.times_used}</strong> time{activeLink.times_used !== 1 ? 's' : ''}</p>
                        {activeLink.max_uses && (
                          <p>Max uses: {activeLink.max_uses}</p>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => generateLinkMutation.mutate()}
                          disabled={generateLinkMutation.isPending}
                        >
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Generate New Link
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deactivateLinkMutation.mutate(activeLink.id)}
                          disabled={deactivateLinkMutation.isPending}
                          className="text-destructive hover:text-destructive"
                        >
                          Deactivate
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-6 space-y-4">
                      <p className="text-muted-foreground text-sm">
                        No active signup link. Generate one to allow people to sign themselves up for your team.
                      </p>
                      <Button
                        onClick={() => generateLinkMutation.mutate()}
                        disabled={generateLinkMutation.isPending}
                        variant="gradient"
                      >
                        {generateLinkMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        <Link2 className="h-4 w-4 mr-2" />
                        Generate Signup Link
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">How Signup Links Work</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex gap-3">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-xs">1</div>
                    <p className="text-muted-foreground">Share the link with your team members</p>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-xs">2</div>
                    <p className="text-muted-foreground">They create an account using their <strong>@stormwindlive.com</strong> email</p>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-xs">3</div>
                    <p className="text-muted-foreground">They're automatically assigned the SDR role and added to {myTeam.name}</p>
                  </div>

                  <Alert className="mt-4">
                    <AlertDescription className="text-xs">
                      Only <strong>@stormwindlive.com</strong> email addresses can sign up through this link. You can deactivate the link at any time.
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

export default withPageErrorBoundary(SDRManagerInvite, 'Invite Team Members');
