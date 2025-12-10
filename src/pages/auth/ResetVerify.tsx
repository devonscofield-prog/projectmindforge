import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, CheckCircle, KeyRound, Loader2, ShieldCheck } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function ResetVerify() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get the encoded reset link from URL params
  const encodedLink = searchParams.get('link');

  const handleConfirmReset = () => {
    if (!encodedLink) {
      setError('Invalid or missing reset link');
      return;
    }

    setIsVerifying(true);
    setError(null);

    try {
      // Decode the base64-encoded Supabase reset link
      const resetLink = atob(encodedLink);
      
      // Redirect to the actual Supabase reset link
      // This will only happen when user clicks - scanners won't trigger this
      window.location.href = resetLink;
    } catch (err) {
      console.error('Failed to decode reset link:', err);
      setError('Invalid reset link format. Please request a new password reset.');
      setIsVerifying(false);
    }
  };

  // If no link provided, show error
  if (!encodedLink) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle>Invalid Reset Link</CardTitle>
            <CardDescription>
              This password reset link is invalid or has expired.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Please request a new password reset from your administrator or use the "Forgot Password" option on the login page.
              </AlertDescription>
            </Alert>
            <Button 
              className="w-full" 
              onClick={() => navigate('/auth')}
            >
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <KeyRound className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Confirm Password Reset</CardTitle>
          <CardDescription>
            Click the button below to continue with your password reset.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Security explanation */}
          <Alert className="bg-muted border-border">
            <ShieldCheck className="h-4 w-4" />
            <AlertDescription className="text-sm">
              <strong>Why this extra step?</strong> Corporate email security systems can 
              automatically click links and invalidate them. This confirmation ensures 
              only you can reset your password.
            </AlertDescription>
          </Alert>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button 
            className="w-full" 
            size="lg"
            onClick={handleConfirmReset}
            disabled={isVerifying}
          >
            {isVerifying ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verifying...
              </>
            ) : (
              <>
                <CheckCircle className="mr-2 h-4 w-4" />
                Continue to Password Reset
              </>
            )}
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            If you didn't request a password reset, you can safely ignore this page.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
