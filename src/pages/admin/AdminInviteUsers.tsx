import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';
import { withPageErrorBoundary } from '@/components/ui/page-error-boundary';
import { useTeams } from '@/hooks/useTeams';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageBreadcrumb } from '@/components/ui/page-breadcrumb';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { UserPlus, Copy, CheckCircle2, Mail, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';

const log = createLogger('AdminInviteUsers');

interface InviteResult {
  success: boolean;
  email: string;
  name: string;
  role: string;
  inviteLink?: string;
  emailSent?: boolean;
  emailError?: string;
}

function AdminInviteUsers() {
  const { data: teams = [] } = useTeams();
  
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    role: 'rep' as 'rep' | 'manager' | 'admin' | 'sdr' | 'sdr_manager',
    teamId: '',
  });
  const [inviting, setInviting] = useState(false);
  const [inviteResult, setInviteResult] = useState<InviteResult | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.email.trim() || !formData.name.trim()) {
      toast.error('Email and name are required');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      toast.error('Please enter a valid email address');
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
          role: formData.role,
          teamId: formData.teamId || null,
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
        role: formData.role,
        inviteLink: result.inviteLink,
        emailSent: result.emailSent,
        emailError: result.emailError,
      });

      toast.success(result.emailSent 
        ? `Invitation email sent to ${formData.email}` 
        : `User created - share the invite link with ${formData.email}`);
      
      // Reset form
      setFormData({
        email: '',
        name: '',
        role: 'rep',
        teamId: '',
      });
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

  const breadcrumbItems = [
    { label: 'Admin', href: '/admin' },
    { label: 'Users', href: '/admin/users' },
    { label: 'Invite User' },
  ];

  return (
    <AppLayout>
      <div className="space-y-8">
        <PageBreadcrumb items={breadcrumbItems} />
        
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Invite User</h1>
            <p className="text-muted-foreground mt-1">Send an invitation to a new team member</p>
          </div>
          <Button variant="outline" asChild>
            <Link to="/admin/users">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Users
            </Link>
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Invitation Form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5" />
                User Details
              </CardTitle>
              <CardDescription>
                Enter the new user's information and select their role
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
                    placeholder="user@example.com"
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

                <div className="space-y-2">
                  <Label htmlFor="role">Role *</Label>
                  <Select
                    value={formData.role}
                    onValueChange={(v) => setFormData({ ...formData, role: v as 'rep' | 'manager' | 'admin' | 'sdr' | 'sdr_manager' })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="rep">Sales Rep</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="sdr">SDR</SelectItem>
                      <SelectItem value="sdr_manager">SDR Manager</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {formData.role === 'rep' && 'Can submit calls, view own prospects and coaching'}
                    {formData.role === 'manager' && 'Can view team performance and provide coaching'}
                    {formData.role === 'admin' && 'Full access to all features and settings'}
                    {formData.role === 'sdr' && 'Can submit dialer transcripts, view call grades and coaching'}
                    {formData.role === 'sdr_manager' && 'Can view SDR team performance, manage coaching prompts'}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="team">Team (Optional)</Label>
                  <Select
                    value={formData.teamId || 'none'}
                    onValueChange={(v) => setFormData({ ...formData, teamId: v === 'none' ? '' : v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select team" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Team</SelectItem>
                      {teams.map((team) => (
                        <SelectItem key={team.id} value={team.id}>
                          {team.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {teams.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      No teams available. Create teams first in the Teams page.
                    </p>
                  )}
                </div>

                <Button type="submit" variant="gradient" className="w-full" disabled={inviting}>
                  <Mail className="h-4 w-4 mr-2" />
                  {inviting ? 'Sending Invitation...' : 'Send Invitation'}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Success Result */}
          <div className="space-y-4">
            {inviteResult && (
              <Card className="border-primary/50 bg-primary/5">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-primary">
                    <CheckCircle2 className="h-5 w-5" />
                    Invitation Sent
                  </CardTitle>
                  <CardDescription>
                    User has been created and invited successfully
                  </CardDescription>
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
                      <span className="font-medium capitalize">{inviteResult.role}</span>
                    </div>
                  </div>

                  {inviteResult.inviteLink && (
                    <>
                      <Alert className={inviteResult.emailSent ? '' : 'border-amber-500/50 bg-amber-500/10'}>
                        <AlertDescription className="text-sm">
                          {inviteResult.emailSent 
                            ? 'An email invitation has been sent. Alternatively, you can share the link below with the user.'
                            : inviteResult.emailError 
                              ? `Email could not be sent (${inviteResult.emailError}). Please share the link below with the user manually.`
                              : 'Please share the link below with the user to complete their setup.'}
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
                            {copiedLink ? (
                              <CheckCircle2 className="h-4 w-4" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          This link allows the user to set their password and log in.
                        </p>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Info Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">How It Works</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-xs">
                    1
                  </div>
                  <p className="text-muted-foreground">
                    User receives an invitation email with a secure link
                  </p>
                </div>
                <div className="flex gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-xs">
                    2
                  </div>
                  <p className="text-muted-foreground">
                    They click the link and set their own password
                  </p>
                </div>
                <div className="flex gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-xs">
                    3
                  </div>
                  <p className="text-muted-foreground">
                    They can immediately log in with their assigned role
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

export default withPageErrorBoundary(AdminInviteUsers, 'Invite User');
