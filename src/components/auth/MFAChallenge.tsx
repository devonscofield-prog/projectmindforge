import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator } from '@/components/ui/input-otp';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, Shield, AlertCircle } from 'lucide-react';
import { getDeviceId, getDeviceName } from '@/lib/deviceId';

interface MFAChallengeProps {
  onSuccess: () => void;
  onCancel?: () => void;
}

export function MFAChallenge({ onSuccess, onCancel }: MFAChallengeProps) {
  const [code, setCode] = useState('');
  const [trustDevice, setTrustDevice] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Get the user's enrolled TOTP factor
    const getFactors = async () => {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) {
        console.error('Error listing MFA factors:', error);
        setError('Failed to load MFA factors');
        return;
      }

      const totpFactor = data.totp.find(f => f.status === 'verified');
      if (totpFactor) {
        setFactorId(totpFactor.id);
      } else {
        setError('No verified MFA factor found');
      }
    };

    getFactors();
  }, []);

  const verifyCode = async () => {
    if (!factorId) {
      toast.error('MFA not properly configured');
      return;
    }

    if (code.length !== 6) {
      toast.error('Please enter a 6-digit code');
      return;
    }

    setIsVerifying(true);
    setError(null);

    try {
      // Create a challenge
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId,
      });

      if (challengeError) throw challengeError;

      // Verify the code
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code,
      });

      if (verifyError) throw verifyError;

      // If trust device is checked, save to database
      if (trustDevice) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
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
      }

      toast.success('Verification successful!');
      onSuccess();
    } catch (error: unknown) {
      console.error('MFA verification error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Verification failed';
      
      if (errorMessage.includes('Invalid') || errorMessage.includes('invalid')) {
        setError('Invalid code. Please try again.');
      } else {
        setError('Verification failed. Please try again.');
      }
      setCode('');
    } finally {
      setIsVerifying(false);
    }
  };

  useEffect(() => {
    if (code.length === 6 && factorId) {
      verifyCode();
    }
  }, [code, factorId]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    if (onCancel) onCancel();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <CardTitle>Two-Factor Authentication</CardTitle>
          <CardDescription>
            Enter the 6-digit code from your authenticator app
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          <div className="flex justify-center">
            <InputOTP
              maxLength={6}
              value={code}
              onChange={setCode}
              disabled={isVerifying || !factorId}
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

          <div className="flex items-center space-x-2">
            <Checkbox
              id="trust-device"
              checked={trustDevice}
              onCheckedChange={(checked) => setTrustDevice(checked === true)}
              disabled={isVerifying}
            />
            <Label 
              htmlFor="trust-device" 
              className="text-sm text-muted-foreground cursor-pointer"
            >
              Trust this device for 30 days
            </Label>
          </div>

          <div className="pt-2">
            <Button 
              variant="ghost" 
              onClick={handleSignOut} 
              className="w-full"
              disabled={isVerifying}
            >
              Sign out
            </Button>
          </div>

          <p className="text-xs text-center text-muted-foreground">
            Lost access to your authenticator? Contact your administrator to reset your MFA.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
