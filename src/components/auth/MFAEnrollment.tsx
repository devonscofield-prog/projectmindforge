import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator } from '@/components/ui/input-otp';
import { toast } from 'sonner';
import { Loader2, Smartphone, Shield, CheckCircle2 } from 'lucide-react';
import { getDeviceId, getDeviceName } from '@/lib/deviceId';

interface MFAEnrollmentProps {
  onComplete: () => void;
  onCancel?: () => void;
}

export function MFAEnrollment({ onComplete, onCancel }: MFAEnrollmentProps) {
  const [step, setStep] = useState<'intro' | 'qr' | 'verify' | 'complete'>('intro');
  const [qrCode, setQrCode] = useState<string>('');
  const [secret, setSecret] = useState<string>('');
  const [factorId, setFactorId] = useState<string>('');
  const [verifyCode, setVerifyCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const startEnrollment = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'Authenticator App',
      });

      if (error) throw error;

      if (data.totp) {
        setQrCode(data.totp.qr_code);
        setSecret(data.totp.secret);
        setFactorId(data.id);
        setStep('qr');
      }
    } catch (error) {
      console.error('MFA enrollment error:', error);
      toast.error('Failed to start MFA enrollment. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const verifyAndComplete = async () => {
    if (verifyCode.length !== 6) {
      toast.error('Please enter a 6-digit code');
      return;
    }

    setIsVerifying(true);
    try {
      // Challenge the factor
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId,
      });

      if (challengeError) throw challengeError;

      // Verify the code
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code: verifyCode,
      });

      if (verifyError) throw verifyError;

      // Update MFA enrollment status in database
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('mfa_enrollment_status').upsert({
          user_id: user.id,
          is_enrolled: true,
          enrolled_at: new Date().toISOString(),
        });

        // Trust this device
        await supabase.from('user_trusted_devices').upsert({
          user_id: user.id,
          device_id: getDeviceId(),
          device_name: getDeviceName(),
          user_agent: navigator.userAgent,
          trusted_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          last_used_at: new Date().toISOString(),
        });
      }

      setStep('complete');
      toast.success('MFA enabled successfully!');
      
      // Short delay before completing to show success state
      setTimeout(() => {
        onComplete();
      }, 1500);
    } catch (error: unknown) {
      console.error('MFA verification error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Verification failed';
      if (errorMessage.includes('Invalid')) {
        toast.error('Invalid code. Please check your authenticator app and try again.');
      } else {
        toast.error('Verification failed. Please try again.');
      }
      setVerifyCode('');
    } finally {
      setIsVerifying(false);
    }
  };

  useEffect(() => {
    if (verifyCode.length === 6) {
      verifyAndComplete();
    }
  }, [verifyCode]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        {step === 'intro' && (
          <>
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <Shield className="h-8 w-8 text-primary" />
              </div>
              <CardTitle>Set Up Two-Factor Authentication</CardTitle>
              <CardDescription>
                Add an extra layer of security to your account by requiring a verification code when signing in from a new device.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg bg-muted p-4 space-y-2 text-sm">
                <p className="font-medium">You'll need:</p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>An authenticator app (Google Authenticator, Authy, etc.)</li>
                  <li>Your phone or tablet</li>
                </ul>
              </div>
              <Button 
                onClick={startEnrollment} 
                className="w-full" 
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Setting up...
                  </>
                ) : (
                  <>
                    <Smartphone className="mr-2 h-4 w-4" />
                    Continue with Setup
                  </>
                )}
              </Button>
              {onCancel && (
                <Button variant="ghost" onClick={onCancel} className="w-full">
                  Cancel
                </Button>
              )}
            </CardContent>
          </>
        )}

        {step === 'qr' && (
          <>
            <CardHeader className="text-center">
              <CardTitle>Scan QR Code</CardTitle>
              <CardDescription>
                Open your authenticator app and scan this QR code
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex justify-center">
                <div className="rounded-lg border bg-white p-4">
                  <img src={qrCode} alt="QR Code" className="h-48 w-48" />
                </div>
              </div>
              
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground text-center">
                  Can't scan? Enter this code manually:
                </p>
                <div className="rounded-lg bg-muted p-3 text-center font-mono text-sm break-all">
                  {secret}
                </div>
              </div>

              <Button onClick={() => setStep('verify')} className="w-full">
                I've Scanned the Code
              </Button>
            </CardContent>
          </>
        )}

        {step === 'verify' && (
          <>
            <CardHeader className="text-center">
              <CardTitle>Enter Verification Code</CardTitle>
              <CardDescription>
                Enter the 6-digit code from your authenticator app
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex justify-center">
                <InputOTP
                  maxLength={6}
                  value={verifyCode}
                  onChange={setVerifyCode}
                  disabled={isVerifying}
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                  </InputOTPGroup>
                  <InputOTPSeparator />
                  <InputOTPGroup>
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>

              {isVerifying && (
                <div className="flex justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              )}

              <Button 
                variant="ghost" 
                onClick={() => setStep('qr')} 
                className="w-full"
                disabled={isVerifying}
              >
                Back to QR Code
              </Button>
            </CardContent>
          </>
        )}

        {step === 'complete' && (
          <>
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
              <CardTitle>MFA Enabled!</CardTitle>
              <CardDescription>
                Your account is now protected with two-factor authentication. This device has been trusted for 30 days.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            </CardContent>
          </>
        )}
      </Card>
    </div>
  );
}
