import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { getDeviceId } from '@/lib/deviceId';
import { MFAEnrollment } from './MFAEnrollment';
import { MFAChallenge } from './MFAChallenge';
import { Loader2 } from 'lucide-react';

interface MFAGateProps {
  children: React.ReactNode;
}

type MFAState = 'loading' | 'enrolled' | 'needs-enrollment' | 'needs-verification' | 'verified';

export function MFAGate({ children }: MFAGateProps) {
  const { user, loading: authLoading } = useAuth();
  const [mfaState, setMfaState] = useState<MFAState>('loading');

  useEffect(() => {
    if (authLoading || !user) {
      setMfaState('loading');
      return;
    }

    checkMFAStatus();
  }, [user, authLoading]);

  const checkMFAStatus = async () => {
    if (!user) return;

    try {
      // Check if device is trusted
      const deviceId = getDeviceId();
      const { data: trustedDevice } = await supabase
        .from('user_trusted_devices')
        .select('id, expires_at')
        .eq('user_id', user.id)
        .eq('device_id', deviceId)
        .maybeSingle(); // Use maybeSingle - device may not exist yet

      if (trustedDevice && trustedDevice.expires_at && new Date(trustedDevice.expires_at) > new Date()) {
        // Device is trusted and not expired - update last_used_at
        await supabase
          .from('user_trusted_devices')
          .update({ last_used_at: new Date().toISOString() })
          .eq('id', trustedDevice.id);
        
        setMfaState('verified');
        return;
      }

      // Device not trusted - check MFA enrollment status
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const hasVerifiedTOTP = factors?.totp?.some(f => f.status === 'verified');

      if (hasVerifiedTOTP) {
        // User has MFA enrolled but device not trusted - need verification
        setMfaState('needs-verification');
      } else {
        // User has no MFA - need enrollment
        setMfaState('needs-enrollment');
      }
    } catch (error) {
      console.error('Error checking MFA status:', error);
      // On error, default to needs-enrollment for safety
      setMfaState('needs-enrollment');
    }
  };

  const handleEnrollmentComplete = () => {
    setMfaState('verified');
  };

  const handleVerificationSuccess = () => {
    setMfaState('verified');
  };

  const handleCancel = async () => {
    await supabase.auth.signOut();
  };

  // Show loading state
  if (mfaState === 'loading' || authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Checking security status...</p>
        </div>
      </div>
    );
  }

  // Show MFA enrollment if needed
  if (mfaState === 'needs-enrollment') {
    return (
      <MFAEnrollment 
        onComplete={handleEnrollmentComplete}
        onCancel={handleCancel}
      />
    );
  }

  // Show MFA challenge if needed
  if (mfaState === 'needs-verification') {
    return (
      <MFAChallenge 
        onSuccess={handleVerificationSuccess}
        onCancel={handleCancel}
      />
    );
  }

  // MFA verified - render children
  return <>{children}</>;
}
