import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FormInput, SubmitButton } from '@/components/ui/form-fields';
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';

const authSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  name: z.string().min(2, 'Name must be at least 2 characters').optional(),
});

export default function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const { user, role, signIn, signUp, resetPassword } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (user && role) {
      const redirectPath = role === 'admin' ? '/admin' : role === 'manager' ? '/manager' : '/rep';
      navigate(redirectPath, { replace: true });
    }
  }, [user, role, navigate]);

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
