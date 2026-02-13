import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle2, AlertTriangle, Users } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';

const ALLOWED_DOMAIN = 'stormwindlive.com';

const signupSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address').refine(
    (email) => email.toLowerCase().endsWith(`@${ALLOWED_DOMAIN}`),
    `Only @${ALLOWED_DOMAIN} email addresses are allowed`
  ),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Must contain at least one number'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

export default function SDRTeamSignup() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();

  const [validating, setValidating] = useState(true);
  const [teamName, setTeamName] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [signupComplete, setSignupComplete] = useState(false);

  // Validate the invite token on mount
  useEffect(() => {
    if (!token) {
      setValidationError('Invalid invite link');
      setValidating(false);
      return;
    }

    const validateToken = async () => {
      try {
        const response = await supabase.functions.invoke('sdr-team-signup', {
          body: { inviteToken: token },
        });

        if (response.error) {
          throw new Error(response.error.message);
        }

        const result = response.data;
        if (result.valid) {
          setTeamName(result.teamName);
        } else {
          setValidationError(result.error || 'Invalid invite link');
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to validate invite link';
        setValidationError(message);
      } finally {
        setValidating(false);
      }
    };

    validateToken();
  }, [token]);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      signupSchema.parse({ name, email, password, confirmPassword });
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast.error('Validation Error', { description: err.errors[0].message });
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const response = await supabase.functions.invoke('sdr-team-signup', {
        body: {
          inviteToken: token,
          email: email.trim().toLowerCase(),
          name: name.trim(),
          password,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const result = response.data;
      if (result.success) {
        setSignupComplete(true);
      } else {
        throw new Error(result.error || 'Signup failed');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create account';
      toast.error('Signup Failed', { description: message });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Loading state
  if (validating) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Validating invite link...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (validationError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-primary">Mindforge</CardTitle>
            <CardDescription>Team Signup</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 mx-auto">
                <AlertTriangle className="h-8 w-8 text-destructive" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">Invalid Invite Link</h3>
                <p className="text-sm text-muted-foreground">{validationError}</p>
              </div>
              <Button onClick={() => navigate('/auth')} className="w-full">
                Go to Sign In
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Success state
  if (signupComplete) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-primary">Mindforge</CardTitle>
            <CardDescription>Account Created</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">Welcome to {teamName}!</h3>
                <p className="text-sm text-muted-foreground">
                  Your account has been created successfully. You can now sign in with your email and password.
                </p>
              </div>
              <Button onClick={() => navigate('/auth')} variant="gradient" className="w-full">
                Sign In
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Signup form
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-primary">Mindforge</CardTitle>
          <CardDescription>Join {teamName}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
              <Users className="h-5 w-5 text-primary shrink-0" />
              <div className="text-sm">
                <p className="font-medium">You're joining: {teamName}</p>
                <p className="text-muted-foreground">You'll be added as an SDR to this team</p>
              </div>
            </div>

            <form onSubmit={handleSignup} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="John Doe"
                  required
                  autoComplete="name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={`you@${ALLOWED_DOMAIN}`}
                  required
                  autoComplete="email"
                />
                <p className="text-xs text-muted-foreground">
                  Must be an @{ALLOWED_DOMAIN} email address
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="new-password"
                />
                <p className="text-xs text-muted-foreground">
                  Min 8 characters with uppercase, lowercase, and number
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="new-password"
                />
              </div>

              <Button type="submit" variant="gradient" className="w-full" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {isSubmitting ? 'Creating Account...' : 'Create Account'}
              </Button>
            </form>

            <div className="text-center">
              <button
                type="button"
                onClick={() => navigate('/auth')}
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                Already have an account? Sign In
              </button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
