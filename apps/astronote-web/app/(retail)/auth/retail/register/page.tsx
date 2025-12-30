'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signupSchema } from '@/src/lib/retail/validators';
import { z } from 'zod';
import { useRetailAuth } from '@/src/features/retail/auth/useRetailAuth';
import { RetailPublicOnlyGuard } from '@/src/components/retail/RetailPublicOnlyGuard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { GlassCard } from '@/components/ui/glass-card';
import { toast } from 'sonner';

export default function RetailRegisterPage() {
  const { signup } = useRetailAuth();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<z.infer<typeof signupSchema>>({
    resolver: zodResolver(signupSchema as any),
  });

  const onSubmit = async (data: z.infer<typeof signupSchema>) => {
    setIsLoading(true);
    setError(null);

    try {
      await signup(
        data.email,
        data.password,
        data.senderName || undefined,
        data.company || undefined,
      );
      toast.success('Account created successfully');
      router.push('/app/retail/dashboard');
    } catch (err: any) {
      const errorMessage = err?.response?.data?.message || err?.message || 'Failed to create account';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <RetailPublicOnlyGuard>
      <div className="min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8 py-12">
        <div className="max-w-md w-full">
          <GlassCard>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div>
                <h2 className="text-3xl font-bold text-center text-text-primary mb-2">
                  Create your account
                </h2>
                <p className="text-center text-text-secondary">
                  Start sending SMS campaigns to your customers
                </p>
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
                  placeholder="At least 8 characters"
                />
                {errors.password && (
                  <p className="mt-1 text-sm text-red-400">{errors.password.message}</p>
                )}
              </div>

              <div>
                <label
                  htmlFor="confirmPassword"
                  className="block text-sm font-medium text-text-secondary mb-2"
                >
                  Confirm Password
                </label>
                <Input
                  {...register('confirmPassword')}
                  type="password"
                  id="confirmPassword"
                  placeholder="Confirm your password"
                />
                {errors.confirmPassword && (
                  <p className="mt-1 text-sm text-red-400">{errors.confirmPassword.message}</p>
                )}
              </div>

              <div>
                <label
                  htmlFor="senderName"
                  className="block text-sm font-medium text-text-secondary mb-2"
                >
                  Sender Name <span className="text-text-tertiary text-xs">(Optional)</span>
                </label>
                <Input
                  {...register('senderName')}
                  type="text"
                  id="senderName"
                  maxLength={11}
                  placeholder="YourStore (max 11 chars)"
                />
                <p className="mt-1 text-xs text-text-tertiary">
                  SMS sender ID (alphanumeric, max 11 characters)
                </p>
                {errors.senderName && (
                  <p className="mt-1 text-sm text-red-400">{errors.senderName.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="company" className="block text-sm font-medium text-text-secondary mb-2">
                  Company Name <span className="text-text-tertiary text-xs">(Optional)</span>
                </label>
                <Input
                  {...register('company')}
                  type="text"
                  id="company"
                  maxLength={160}
                  placeholder="Your Store Name"
                />
                {errors.company && (
                  <p className="mt-1 text-sm text-red-400">{errors.company.message}</p>
                )}
              </div>

              <Button type="submit" disabled={isLoading} className="w-full" size="lg">
                {isLoading ? 'Creating account...' : 'Sign Up'}
              </Button>

              <p className="text-center text-sm text-text-secondary">
                Already have an account?{' '}
                <Link href="/auth/retail/login" className="font-medium text-accent hover:underline">
                  Log in
                </Link>
              </p>
            </form>
          </GlassCard>
        </div>
      </div>
    </RetailPublicOnlyGuard>
  );
}
