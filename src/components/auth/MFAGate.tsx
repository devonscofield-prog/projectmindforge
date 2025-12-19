import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { MFAEnrollment } from './MFAEnrollment';
import { MFAChallenge } from './MFAChallenge';
import { Loader2 } from 'lucide-react';

interface MFAGateProps {
  children: React.ReactNode;
}

export function MFAGate({ children }: MFAGateProps) {
  const { user, loading: authLoading, mfaStatus, setMfaVerified } = useAuth();

  const handleEnrollmentComplete = () => {
    setMfaVerified();
  };

  const handleVerificationSuccess = () => {
    setMfaVerified();
  };

  const handleCancel = async () => {
    await supabase.auth.signOut();
  };

  // Show loading state while auth is loading or MFA status is being determined
  if (authLoading || !user || mfaStatus === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Show MFA enrollment if needed
  if (mfaStatus === 'needs-enrollment') {
    return (
      <MFAEnrollment 
        onComplete={handleEnrollmentComplete}
        onCancel={handleCancel}
      />
    );
  }

  // Show MFA challenge if needed
  if (mfaStatus === 'needs-verification') {
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
