import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { ArrowLeft, Lock, User, Shield, Smartphone, Trash2, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { format } from 'date-fns';
import { getDeviceId } from '@/lib/deviceId';

const passwordSchema = z.object({
  newPassword: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  confirmPassword: z.string()
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"]
});

interface TrustedDevice {
  id: string;
  device_id: string;
  device_name: string | null;
  user_agent: string | null;
  trusted_at: string | null;
  expires_at: string | null;
  last_used_at: string | null;
}

export default function UserSettings() {
  const { profile, role, user, updatePassword } = useAuth();
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const [trustedDevices, setTrustedDevices] = useState<TrustedDevice[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(true);
  const [deletingDevice, setDeletingDevice] = useState<string | null>(null);
  const [mfaEnrolled, setMfaEnrolled] = useState(false);
  
  const currentDeviceId = getDeviceId();

  useEffect(() => {
    if (user) {
      loadTrustedDevices();
      checkMFAStatus();
    }
  }, [user]);

  const loadTrustedDevices = async () => {
    if (!user) return;
    setLoadingDevices(true);
    try {
      const { data, error } = await supabase
        .from('user_trusted_devices')
        .select('id, device_id, device_name, user_agent, trusted_at, expires_at, last_used_at')
        .eq('user_id', user.id)
        .order('last_used_at', { ascending: false });

      if (error) throw error;
      setTrustedDevices(data || []);
    } catch (error) {
      console.error('Failed to load trusted devices:', error);
    } finally {
      setLoadingDevices(false);
    }
  };

  const checkMFAStatus = async () => {
    const { data: factors } = await supabase.auth.mfa.listFactors();
    setMfaEnrolled(factors?.totp?.some(f => f.status === 'verified') || false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    const result = passwordSchema.safeParse({ newPassword, confirmPassword });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await updatePassword(newPassword);
      if (error) {
        toast.error('Failed to update password', { description: error.message });
      } else {
        toast.success('Password updated successfully');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch {
      toast.error('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveDevice = async (deviceId: string) => {
    if (!user) return;
    setDeletingDevice(deviceId);
    try {
      const { error } = await supabase
        .from('user_trusted_devices')
        .delete()
        .eq('id', deviceId)
        .eq('user_id', user.id);
      if (error) throw error;
      toast.success('Device removed');
      setTrustedDevices(prev => prev.filter(d => d.id !== deviceId));
    } catch {
      toast.error('Failed to remove device');
    } finally {
      setDeletingDevice(null);
    }
  };

  const handleRemoveAllOtherDevices = async () => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('user_trusted_devices')
        .delete()
        .eq('user_id', user.id)
        .neq('device_id', currentDeviceId);
      if (error) throw error;
      toast.success('All other devices removed');
      setTrustedDevices(prev => prev.filter(d => d.device_id === currentDeviceId));
    } catch {
      toast.error('Failed to remove devices');
    }
  };

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <h1 className="text-3xl font-bold">Settings</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><User className="h-5 w-5" />Profile Information</CardTitle>
            <CardDescription>Your account details</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div><Label className="text-muted-foreground">Name</Label><p className="font-medium">{profile?.name}</p></div>
              <div><Label className="text-muted-foreground">Email</Label><p className="font-medium">{profile?.email}</p></div>
              <div><Label className="text-muted-foreground">Role</Label><p className="font-medium capitalize">{role}</p></div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5" />Two-Factor Authentication</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{mfaEnrolled ? 'MFA is enabled' : 'MFA not yet set up'}</p>
                <p className="text-sm text-muted-foreground">
                  {mfaEnrolled ? 'Your account is protected' : 'You will be prompted to set up MFA on next login from a new device'}
                </p>
              </div>
              <div className={`h-3 w-3 rounded-full ${mfaEnrolled ? 'bg-green-500' : 'bg-yellow-500'}`} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Smartphone className="h-5 w-5" />Trusted Devices</CardTitle>
            <CardDescription>Devices that don't require MFA verification</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loadingDevices ? (
              <div className="flex justify-center py-4"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : trustedDevices.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No trusted devices</p>
            ) : (
              <>
                <div className="space-y-3">
                  {trustedDevices.map((device) => {
                    const isCurrentDevice = device.device_id === currentDeviceId;
                    const isExpired = device.expires_at ? new Date(device.expires_at) < new Date() : false;
                    return (
                      <div key={device.id} className="flex items-center justify-between p-3 rounded-lg border">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm">{device.device_name || 'Unknown Device'}</p>
                            {isCurrentDevice && <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">This device</span>}
                            {isExpired && <span className="text-xs bg-destructive/10 text-destructive px-2 py-0.5 rounded">Expired</span>}
                          </div>
                          {device.trusted_at && <p className="text-xs text-muted-foreground">Trusted {format(new Date(device.trusted_at), 'MMM d, yyyy')}</p>}
                        </div>
                        {!isCurrentDevice && (
                          <Button variant="ghost" size="sm" onClick={() => handleRemoveDevice(device.id)} disabled={deletingDevice === device.id}>
                            {deletingDevice === device.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
                {trustedDevices.length > 1 && (
                  <Button variant="outline" size="sm" onClick={handleRemoveAllOtherDevices} className="w-full">Remove all other devices</Button>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Lock className="h-5 w-5" />Change Password</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <Input id="newPassword" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} disabled={isLoading} />
                {errors.newPassword && <p className="text-sm text-destructive">{errors.newPassword}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} disabled={isLoading} />
                {errors.confirmPassword && <p className="text-sm text-destructive">{errors.confirmPassword}</p>}
              </div>
              <Button type="submit" disabled={isLoading}>{isLoading ? 'Updating...' : 'Update Password'}</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
