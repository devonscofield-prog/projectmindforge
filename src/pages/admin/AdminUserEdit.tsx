import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
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
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Save, KeyRound, Copy, CheckCircle2, AlertTriangle, Loader2, ShieldOff } from 'lucide-react';
import { toast } from 'sonner';
import { UserRole } from '@/types/database';

const log = createLogger('AdminUserEdit');

interface UserProfile {
  id: string;
  name: string;
  email: string;
  team_id: string | null;
  is_active: boolean;
  role: UserRole;
  hire_date: string | null;
  notes: string | null;
}

function AdminUserEdit() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { data: teams = [] } = useTeams();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [resettingMFA, setResettingMFA] = useState(false);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'rep' as UserRole,
    team_id: '',
    is_active: true,
    hire_date: '',
    notes: '',
  });
  const [resetLink, setResetLink] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    if (userId) {
      loadUser();
    }
  }, [userId]);

  const loadUser = async () => {
    if (!userId) return;

    setLoading(true);
    try {
      // Fetch profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle(); // Use maybeSingle - user may not exist if invalid URL

      if (profileError) throw profileError;
      if (!profileData) throw new Error('User not found');

      // Fetch role
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle(); // Use maybeSingle - role may not exist

      if (roleError) throw roleError;
      if (!roleData) throw new Error('User role not found');

      const userData: UserProfile = {
        ...profileData,
        role: roleData.role,
      };

      setUser(userData);
      setFormData({
        name: userData.name,
        email: userData.email,
        role: userData.role,
        team_id: userData.team_id || '',
        is_active: userData.is_active,
        hire_date: userData.hire_date || '',
        notes: userData.notes || '',
      });
    } catch (error) {
      log.error('Failed to load user', { error });
      toast.error('Failed to load user details');
      navigate('/admin/users');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!userId || !user) return;

    setSaving(true);
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) {
        toast.error('You must be logged in');
        return;
      }

      // Track changes for audit log
      const changes: Record<string, { old: unknown; new: unknown }> = {};
      const metadata: Record<string, unknown> = {
        target_user_id: userId,
        target_user_name: user.name,
        target_user_email: user.email,
      };

      if (formData.name !== user.name) changes.name = { old: user.name, new: formData.name };
      if (formData.team_id !== (user.team_id || '')) changes.team_id = { old: user.team_id, new: formData.team_id };
      if (formData.is_active !== user.is_active) changes.is_active = { old: user.is_active, new: formData.is_active };
      if (formData.hire_date !== (user.hire_date || '')) changes.hire_date = { old: user.hire_date, new: formData.hire_date };

      // Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          name: formData.name.trim(),
          team_id: formData.team_id || null,
          is_active: formData.is_active,
          hire_date: formData.hire_date || null,
          notes: formData.notes || null,
        })
        .eq('id', userId);

      if (profileError) throw profileError;

      // Log profile update if there were changes
      if (Object.keys(changes).length > 0) {
        await supabase.from('user_activity_logs').insert([{
          user_id: currentUser.id,
          activity_type: 'user_profile_updated' as const,
          metadata: { ...metadata, changes } as never,
        }]);
      }

      // Log deactivation/reactivation
      if (formData.is_active !== user.is_active) {
        await supabase.from('user_activity_logs').insert([{
          user_id: currentUser.id,
          activity_type: formData.is_active ? 'user_reactivated' as const : 'user_deactivated' as const,
          metadata: metadata as never,
        }]);
      }

      // Update role if changed
      if (formData.role !== user.role) {
        const { error: roleError } = await supabase
          .from('user_roles')
          .update({ role: formData.role })
          .eq('user_id', userId);

        if (roleError) throw roleError;

        // Log role change
        await supabase.from('user_activity_logs').insert([{
          user_id: currentUser.id,
          activity_type: 'user_role_changed' as const,
          metadata: {
            ...metadata,
            old_role: user.role,
            new_role: formData.role,
          } as never,
        }]);
      }

      toast.success('User updated successfully');
      
      // Reload user data
      await loadUser();
    } catch (error) {
      log.error('Failed to update user', { error });
      toast.error('Failed to update user');
    } finally {
      setSaving(false);
    }
  };

  const handleResetPassword = async () => {
    if (!userId) return;

    setResettingPassword(true);
    setResetLink(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('You must be logged in');
        return;
      }

      const response = await supabase.functions.invoke('reset-user-password', {
        body: {
          userId,
          sendEmail: true,
          redirectTo: `${window.location.origin}/auth`,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const result = response.data;
      setResetLink(result.resetLink);
      toast.success('Password reset link generated');
    } catch (error) {
      log.error('Failed to reset password', { error });
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate reset link';
      toast.error(errorMessage);
    } finally {
      setResettingPassword(false);
    }
  };

  const handleResetMFA = async () => {
    if (!userId) return;

    setResettingMFA(true);
    try {
      const response = await supabase.functions.invoke('admin-reset-mfa', {
        body: { targetUserId: userId },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      toast.success('MFA has been reset', {
        description: 'User will need to set up MFA again on next login.'
      });
    } catch (error) {
      log.error('Failed to reset MFA', { error });
      const errorMessage = error instanceof Error ? error.message : 'Failed to reset MFA';
      toast.error(errorMessage);
    } finally {
      setResettingMFA(false);
    }
  };

  const handleCopyResetLink = async () => {
    if (resetLink) {
      await navigator.clipboard.writeText(resetLink);
      setCopiedLink(true);
      toast.success('Reset link copied to clipboard');
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const breadcrumbItems = [
    { label: 'Admin', href: '/admin' },
    { label: 'Users', href: '/admin/users' },
    { label: 'Edit User' },
  ];

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading user details...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!user) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Card className="max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                User Not Found
              </CardTitle>
              <CardDescription>
                The requested user could not be found.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link to="/admin/users">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Users
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-8">
        <PageBreadcrumb items={breadcrumbItems} />

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Edit User</h1>
            <p className="text-muted-foreground mt-1">Update user profile and permissions</p>
          </div>
          <Button variant="outline" asChild>
            <Link to="/admin/users">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Users
            </Link>
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {/* Main Form */}
          <div className="md:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>User Information</CardTitle>
                <CardDescription>Basic profile details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="John Doe"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    disabled
                    className="bg-muted"
                  />
                  <p className="text-xs text-muted-foreground">
                    Email cannot be changed directly
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="hire_date">Hire Date</Label>
                  <Input
                    id="hire_date"
                    type="date"
                    value={formData.hire_date}
                    onChange={(e) => setFormData({ ...formData, hire_date: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Input
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Additional notes about this user"
                  />
                </div>

                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <Label htmlFor="is_active">Active Status</Label>
                    <p className="text-xs text-muted-foreground">
                      Inactive users cannot log in
                    </p>
                  </div>
                  <Switch
                    id="is_active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Permissions</CardTitle>
                <CardDescription>Manage user role and team assignment</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="role">Role *</Label>
                  <Select
                    value={formData.role}
                    onValueChange={(v) => setFormData({ ...formData, role: v as UserRole })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="rep">Sales Rep</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                  {formData.role !== user.role && (
                    <Alert>
                      <AlertDescription className="text-xs">
                        <strong>Warning:</strong> Changing the role will affect this user's permissions immediately.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="team">Team</Label>
                  <Select
                    value={formData.team_id || 'none'}
                    onValueChange={(v) => setFormData({ ...formData, team_id: v === 'none' ? '' : v })}
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
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={saving} className="flex-1">
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
              <Button variant="outline" onClick={() => navigate('/admin/users')}>
                Cancel
              </Button>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Password Reset</CardTitle>
                <CardDescription>
                  Generate a secure link for the user to reset their password
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleResetPassword}
                  disabled={resettingPassword}
                >
                  <KeyRound className="h-4 w-4 mr-2" />
                  {resettingPassword ? 'Generating...' : 'Reset Password'}
                </Button>

                {resetLink && (
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Reset Link</Label>
                    <div className="flex gap-2">
                      <Input
                        value={resetLink}
                        readOnly
                        className="font-mono text-xs"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={handleCopyResetLink}
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
                      Share this link with the user to set a new password
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">MFA Reset</CardTitle>
                <CardDescription>
                  Reset two-factor authentication for this user
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    This will remove all MFA factors and trusted devices. The user will need to set up MFA again.
                  </AlertDescription>
                </Alert>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleResetMFA}
                  disabled={resettingMFA}
                >
                  <ShieldOff className="h-4 w-4 mr-2" />
                  {resettingMFA ? 'Resetting...' : 'Reset MFA'}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">User ID</CardTitle>
                <CardDescription>Internal identifier</CardDescription>
              </CardHeader>
              <CardContent>
                <code className="text-xs break-all bg-muted p-2 rounded block">
                  {user.id}
                </code>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

export default withPageErrorBoundary(AdminUserEdit);
