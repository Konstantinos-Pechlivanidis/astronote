'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff } from 'lucide-react';
import { loginSchema } from '@/src/lib/retail/validators';
import { useRetailAuth } from '@/src/features/retail/auth/useRetailAuth';
import { z } from 'zod';
import { RetailPublicOnlyGuard } from '@/src/components/retail/RetailPublicOnlyGuard';
import { Button } from '@/components/ui/button';
import { RetailCard } from '@/src/components/retail/RetailCard';
import { RetailFormField } from '@/src/components/retail/RetailFormField';
import { toast } from 'sonner';

export default function RetailLoginPage() {
  const { login } = useRetailAuth();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema as any),
    mode: 'onChange',
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
    getValues,
    trigger,
  } = form;

  // Fix autofill: trigger validation after mount to sync browser autofill values
  useEffect(() => {
    const timer = setTimeout(() => {
      trigger(['email', 'password']);
    }, 100);
    return () => clearTimeout(timer);
  }, [trigger]);

  const onSubmit = async (data: z.infer<typeof loginSchema>) => {
    // Debug: log form values before submit
    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.log('[Login] Form values:', getValues());
      // eslint-disable-next-line no-console
      console.log('[Login] Form errors:', errors);
    }

    setIsLoading(true);
    setError(null);

    try {
      const authResponse = await login(data.email, data.password);

      // Log token storage (development only)
      if (process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_APP_ENV === 'development') {
        const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
        // eslint-disable-next-line no-console
        console.log('[Login] Token stored:', token ? 'present' : 'absent');
        // eslint-disable-next-line no-console
        console.log('[Login] User data:', authResponse.user);
      }

      toast.success('Login successful');

      // Verify token by calling /api/me (development only)
      if (process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_APP_ENV === 'development') {
        try {
          const { meApi } = await import('@/src/lib/retail/api/me');
          const meRes = await meApi.get();
          // eslint-disable-next-line no-console
          console.log('[Login] /api/me verification:', meRes.data);
        } catch (meError: any) {
          // eslint-disable-next-line no-console
          console.error('[Login] /api/me verification failed:', meError?.response?.status, meError?.response?.data);
        }
      }

      router.push('/app/retail/dashboard');
    } catch (err: any) {
      const errorMessage =
        err?.response?.data?.message || err?.message || 'Invalid email or password';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <RetailPublicOnlyGuard>
      <div className="flex min-h-screen items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
        <div className="w-full max-w-md">
          <RetailCard className="p-6 sm:p-8">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div className="text-center">
                <h2 className="mb-2 text-3xl font-bold text-text-primary">
                  Welcome back
                </h2>
                <p className="text-sm text-text-secondary">Sign in to your account</p>
              </div>

              {error && (
                <RetailCard variant="danger" className="p-4">
                  <p className="text-sm text-red-800">{error}</p>
                </RetailCard>
              )}

              {/* Debug: show form errors in development */}
              {process.env.NODE_ENV === 'development' && (
                <div className="rounded-md bg-gray-100 p-2 text-xs">
                  <strong>Debug (dev only):</strong>
                  <pre className="mt-1 overflow-auto">
                    {JSON.stringify({ errors, values: getValues() }, null, 2)}
                  </pre>
                </div>
              )}

              <RetailFormField
                label="Email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                error={errors.email?.message}
                {...register('email')}
              />

              <div className="space-y-2">
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-text-secondary"
                >
                  Password
                </label>
                <div className="relative">
                  <input
                    {...register('password')}
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    name="password"
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    onInput={(e) => {
                      // Handle autofill: trigger validation on input event
                      const target = e.target as HTMLInputElement;
                      register('password').onChange({ target, type: 'change' });
                    }}
                    className="h-11 w-full rounded-xl border border-border bg-surface px-4 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-0"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary transition-colors hover:text-text-primary"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-sm text-red-400">{errors.password.message}</p>
                )}
              </div>

              <Button type="submit" disabled={isLoading} className="w-full" size="lg">
                {isLoading ? 'Signing in...' : 'Log In'}
              </Button>

              <p className="text-center text-sm text-text-secondary">
                Don&apos;t have an account?{' '}
                <Link
                  href="/auth/retail/register"
                  className="font-medium text-accent underline underline-offset-4 transition-colors hover:text-accent-hover"
                >
                  Sign up
                </Link>
              </p>
            </form>
          </RetailCard>
        </div>
      </div>
    </RetailPublicOnlyGuard>
  );
}

