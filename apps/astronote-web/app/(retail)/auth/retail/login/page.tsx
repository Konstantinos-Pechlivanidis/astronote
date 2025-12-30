'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { loginSchema } from '@/src/lib/retail/validators';
import { useRetailAuth } from '@/src/features/retail/auth/useRetailAuth';
import { z } from 'zod';
import { RetailPublicOnlyGuard } from '@/src/components/retail/RetailPublicOnlyGuard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { GlassCard } from '@/components/ui/glass-card';
import { toast } from 'sonner';

export default function RetailLoginPage() {
  const { login } = useRetailAuth();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema as any),
    mode: 'onChange',
  });

  const onSubmit = async (data: z.infer<typeof loginSchema>) => {
    setIsLoading(true);
    setError(null);

    try {
      await login(data.email, data.password);
      toast.success('Login successful');
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
      <div className="min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full">
          <GlassCard>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div>
                <h2 className="text-3xl font-bold text-center text-text-primary mb-2">
                  Welcome back
                </h2>
                <p className="text-center text-text-secondary">Sign in to your account</p>
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg">
                  {error}
                </div>
              )}

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-text-secondary mb-2">
                  Email
                </label>
                <Input
                  {...register('email')}
                  type="email"
                  id="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                />
                {errors.email && (
                  <p className="mt-1 text-sm text-red-400">{errors.email.message}</p>
                )}
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-text-secondary mb-2"
                >
                  Password
                </label>
                <Input
                  {...register('password')}
                  type="password"
                  id="password"
                  autoComplete="current-password"
                  placeholder="Enter your password"
                />
                {errors.password && (
                  <p className="mt-1 text-sm text-red-400">{errors.password.message}</p>
                )}
              </div>

              <Button type="submit" disabled={isLoading} className="w-full" size="lg">
                {isLoading ? 'Signing in...' : 'Log In'}
              </Button>

              <p className="text-center text-sm text-text-secondary">
                Don&apos;t have an account?{' '}
                <Link href="/auth/retail/register" className="font-medium text-accent hover:underline">
                  Sign up
                </Link>
              </p>
            </form>
          </GlassCard>
        </div>
      </div>
    </RetailPublicOnlyGuard>
  );
}

