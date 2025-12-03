import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FormInput, SubmitButton } from '@/components/ui/form-fields';
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';
import { CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const authSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  name: z.string().min(2, 'Name must be at least 2 characters').optional(),
});

const newPasswordSchema = z.object({
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Must contain at least one number'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export default function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  
  // Recovery mode states - check synchronously on mount to prevent race condition
  const [isRecoveryMode, setIsRecoveryMode] = useState(() => {
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    return hashParams.get('type') === 'recovery';
  });
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [recoveryComplete, setRecoveryComplete] = useState(false);
  
  const { user, role, signIn, signUp, resetPassword, updatePassword } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Listen for PASSWORD_RECOVERY event from Supabase Auth
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        console.log('PASSWORD_RECOVERY event detected');
        setIsRecoveryMode(true);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // Redirect authenticated users (but not during recovery)
  useEffect(() => {
    if (user && role && !isRecoveryMode && !recoveryComplete) {
      const redirectPath = role === 'admin' ? '/admin' : role === 'manager' ? '/manager' : '/rep';
      navigate(redirectPath, { replace: true });
    }
  }, [user, role, navigate, isRecoveryMode, recoveryComplete]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      authSchema.parse({ email, password });
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast({
          title: 'Validation Error',
          description: err.errors[0].message,
          variant: 'destructive',
        });
        return;
      }
    }

    setIsLoading(true);
    const { error } = await signIn(email, password);
    setIsLoading(false);

    if (error) {
      toast({
        title: 'Sign In Failed',
        description: error.message === 'Invalid login credentials' 
          ? 'Invalid email or password. Please try again.'
          : error.message,
        variant: 'destructive',
      });
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      authSchema.parse({ email, password, name });
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast({
          title: 'Validation Error',
          description: err.errors[0].message,
          variant: 'destructive',
        });
        return;
      }
    }

    setIsLoading(true);
    const { error } = await signUp(email, password, name);
    setIsLoading(false);

    if (error) {
      const errorMessage = error.message.includes('already registered')
        ? 'An account with this email already exists. Please sign in instead.'
        : error.message;
      
      toast({
        title: 'Sign Up Failed',
        description: errorMessage,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Account Created',
        description: 'Your account has been created successfully. You can now sign in.',
      });
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      toast({
        title: 'Email Required',
        description: 'Please enter your email address',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    const { error } = await resetPassword(email);
    setIsLoading(false);
    
    if (error) {
      toast({
        title: 'Password Reset Failed',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Check Your Email',
        description: 'We sent you a password reset link. Please check your email.',
      });
      setIsResettingPassword(false);
    }
  };

  const handleSetNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      newPasswordSchema.parse({ password: newPassword, confirmPassword });
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast({
          title: 'Validation Error',
          description: err.errors[0].message,
          variant: 'destructive',
        });
        return;
      }
    }

    setIsLoading(true);
    const { error } = await updatePassword(newPassword);
    setIsLoading(false);

    if (error) {
      toast({
        title: 'Password Update Failed',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      // Clear the URL hash
      window.history.replaceState(null, '', window.location.pathname);
      setRecoveryComplete(true);
    }
  };

  const handleBackToSignIn = () => {
    setIsRecoveryMode(false);
    setRecoveryComplete(false);
    setNewPassword('');
    setConfirmPassword('');
    window.history.replaceState(null, '', window.location.pathname);
  };

  // Recovery mode - Set New Password form
  if (isRecoveryMode) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md" role="region" aria-labelledby="recovery-title">
          <CardHeader className="text-center">
            <CardTitle id="recovery-title" className="text-2xl font-bold text-primary">
              StormWind Sales Hub
            </CardTitle>
            <CardDescription>
              {recoveryComplete ? 'Password updated successfully' : 'Set your new password'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {recoveryComplete ? (
              <div className="space-y-4 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
                  <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold">Password Updated</h3>
                  <p className="text-sm text-muted-foreground">
                    Your password has been successfully updated. You can now sign in with your new password.
                  </p>
                </div>
                <SubmitButton 
                  className="w-full" 
                  onClick={handleBackToSignIn}
                >
                  Sign In
                </SubmitButton>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2 text-center">
                  <h3 className="text-lg font-semibold">Set New Password</h3>
                  <p className="text-sm text-muted-foreground">
                    Enter your new password below
                  </p>
                </div>
                <form onSubmit={handleSetNewPassword} className="space-y-4">
                  <FormInput
                    label="New Password"
                    type="password"
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                    description="Min 8 characters with uppercase, lowercase, and number"
                  />
                  <FormInput
                    label="Confirm Password"
                    type="password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                  />
                  <SubmitButton 
                    className="w-full" 
                    isLoading={isLoading}
                    loadingText="Updating password..."
                  >
                    Update Password
                  </SubmitButton>
                  <button
                    type="button"
                    onClick={handleBackToSignIn}
                    className="w-full text-sm text-muted-foreground hover:text-primary transition-colors"
                  >
                    Back to Sign In
                  </button>
                </form>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md" role="region" aria-labelledby="auth-title">
        <CardHeader className="text-center">
          <CardTitle id="auth-title" className="text-2xl font-bold text-primary">
            StormWind Sales Hub
          </CardTitle>
          <CardDescription>Sign in to access your sales dashboard</CardDescription>
        </CardHeader>
        <CardContent>
          {isResettingPassword ? (
            <div className="space-y-4">
              <div className="space-y-2 text-center">
                <h3 className="text-lg font-semibold">Reset Password</h3>
                <p className="text-sm text-muted-foreground">
                  Enter your email address and we'll send you a link to reset your password
                </p>
              </div>
              <form onSubmit={handlePasswordReset} className="space-y-4">
                <FormInput
                  label="Email"
                  type="email"
                  placeholder="you@stormwind.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
                <SubmitButton 
                  className="w-full" 
                  isLoading={isLoading}
                  loadingText="Sending reset link..."
                >
                  Send Reset Link
                </SubmitButton>
                <button
                  type="button"
                  onClick={() => setIsResettingPassword(false)}
                  className="w-full text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  Back to Sign In
                </button>
              </form>
            </div>
          ) : (
            <Tabs defaultValue="signin" className="w-full">
              <TabsList className="grid w-full grid-cols-2" aria-label="Authentication options">
                <TabsTrigger value="signin">Sign In</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>
              
              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-4" aria-label="Sign in form">
                  <FormInput
                    label="Email"
                    type="email"
                    placeholder="you@stormwind.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                  <FormInput
                    label="Password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                  />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => setIsResettingPassword(true)}
                      className="text-sm text-muted-foreground hover:text-primary transition-colors"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <SubmitButton 
                    className="w-full" 
                    isLoading={isLoading}
                    loadingText="Signing in..."
                  >
                    Sign In
                  </SubmitButton>
                </form>
              </TabsContent>
              
              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="space-y-4" aria-label="Sign up form">
                  <FormInput
                    label="Full Name"
                    type="text"
                    placeholder="John Doe"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    autoComplete="name"
                  />
                  <FormInput
                    label="Email"
                    type="email"
                    placeholder="you@stormwind.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                  <FormInput
                    label="Password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                    description="Password must be at least 6 characters"
                  />
                  <SubmitButton 
                    className="w-full" 
                    isLoading={isLoading}
                    loadingText="Creating account..."
                  >
                    Create Account
                  </SubmitButton>
                </form>
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
