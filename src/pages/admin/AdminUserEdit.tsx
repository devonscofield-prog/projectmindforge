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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, Save, KeyRound, AlertTriangle, Loader2, ShieldOff, Trash2 } from 'lucide-react';
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
import { toast } from 'sonner';
import { UserRole } from '@/types/database';
import { useAuth } from '@/contexts/AuthContext';

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
  const { user: currentUser } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settingPassword, setSettingPassword] = useState(false);
  const [resettingMFA, setResettingMFA] = useState(false);
  const [deleting, setDeleting] = useState(false);
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
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [deleteConfirmEmail, setDeleteConfirmEmail] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

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
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
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
          user_id: authUser.id,
          activity_type: 'user_profile_updated' as const,
          metadata: { ...metadata, changes } as never,
        }]);
      }

      // Log deactivation/reactivation
      if (formData.is_active !== user.is_active) {
        await supabase.from('user_activity_logs').insert([{
          user_id: authUser.id,
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
          user_id: authUser.id,
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

  const handleSetPassword = async () => {
    if (!userId) return;

    setPasswordError(null);

    // Validate passwords match
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    // Validate password complexity
    const hasMinLength = newPassword.length >= 8;
    const hasUppercase = /[A-Z]/.test(newPassword);
    const hasLowercase = /[a-z]/.test(newPassword);
    const hasNumber = /[0-9]/.test(newPassword);

    if (!hasMinLength || !hasUppercase || !hasLowercase || !hasNumber) {
      setPasswordError('Password must be at least 8 characters with uppercase, lowercase, and number');
      return;
    }

    setSettingPassword(true);

    try {
      const response = await supabase.functions.invoke('set-user-password', {
        body: { userId, newPassword },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const result = response.data;
      if (result.error) {
        throw new Error(result.error);
      }

      toast.success('Password updated successfully');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      log.error('Failed to set password', { error });
      const errorMessage = error instanceof Error ? error.message : 'Failed to set password';
      setPasswordError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setSettingPassword(false);
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

  const handleDeleteUser = async () => {
    if (!userId || !user) return;
    
    // Verify email matches
    if (deleteConfirmEmail.toLowerCase() !== user.email.toLowerCase()) {
      toast.error('Email does not match');
      return;
    }

    setDeleting(true);
    try {
      const response = await supabase.functions.invoke('delete-user', {
        body: { targetUserId: userId },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const result = response.data;
      if (result.error) {
        throw new Error(result.error);
      }

      toast.success('User deleted successfully', {
        description: result.message
      });
      
      // Navigate back to users list
      navigate('/admin/users');
    } catch (error) {
      log.error('Failed to delete user', { error });
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete user';
      toast.error(errorMessage);
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
      setDeleteConfirmEmail('');
    }
  };

  const clearPasswordForm = () => {
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError(null);
  };

  const isOwnAccount = currentUser?.id === userId;

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
                      <SelectItem value="sdr">SDR</SelectItem>
                      <SelectItem value="sdr_manager">SDR Manager</SelectItem>
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

            {/* Danger Zone */}
            <Card className="border-destructive/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-5 w-5" />
                  Danger Zone
                </CardTitle>
                <CardDescription>
                  Irreversible and destructive actions
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <p className="font-medium">Delete this user</p>
                    <p className="text-sm text-muted-foreground">
                      Permanently remove this user and all their data including calls, prospects, analysis, and activity history.
                    </p>
                  </div>
                  <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                    <AlertDialogTrigger asChild>
                      <Button 
                        variant="destructive" 
                        disabled={isOwnAccount}
                        title={isOwnAccount ? "You cannot delete your own account" : undefined}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete User
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                          <AlertTriangle className="h-5 w-5 text-destructive" />
                          Delete User Permanently?
                        </AlertDialogTitle>
                        <AlertDialogDescription asChild>
                          <div className="space-y-4">
                            <p>This will permanently delete:</p>
                            <ul className="list-disc list-inside text-sm space-y-1">
                              <li>All call transcripts & AI analysis</li>
                              <li>All prospects & stakeholders</li>
                              <li>All coaching data & follow-ups</li>
                              <li>Activity history & settings</li>
                            </ul>
                            <p className="font-medium text-destructive">
                              This action CANNOT be undone.
                            </p>
                            <div className="space-y-2 pt-2">
                              <Label htmlFor="confirm-email">
                                Type <span className="font-mono font-medium">{user.email}</span> to confirm:
                              </Label>
                              <Input
                                id="confirm-email"
                                value={deleteConfirmEmail}
                                onChange={(e) => setDeleteConfirmEmail(e.target.value)}
                                placeholder="Enter email to confirm"
                              />
                            </div>
                          </div>
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setDeleteConfirmEmail('')}>
                          Cancel
                        </AlertDialogCancel>
                        <Button
                          variant="destructive"
                          onClick={handleDeleteUser}
                          disabled={deleting || deleteConfirmEmail.toLowerCase() !== user.email.toLowerCase()}
                        >
                          {deleting ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Deleting...
                            </>
                          ) : (
                            'Delete Permanently'
                          )}
                        </Button>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
                {isOwnAccount && (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      You cannot delete your own account. Ask another admin to delete it if needed.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Set Password</CardTitle>
                <CardDescription>
                  Manually set a new password for this user
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                  />
                </div>

                <p className="text-xs text-muted-foreground">
                  Password must be at least 8 characters with uppercase, lowercase, and number.
                </p>

                {passwordError && (
                  <Alert variant="destructive" className="bg-destructive/10">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      {passwordError}
                    </AlertDescription>
                  </Alert>
                )}

                <Button
                  variant="default"
                  className="w-full"
                  onClick={handleSetPassword}
                  disabled={settingPassword || !newPassword || !confirmPassword}
                >
                  <KeyRound className="h-4 w-4 mr-2" />
                  {settingPassword ? 'Setting Password...' : 'Set Password'}
                </Button>
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
