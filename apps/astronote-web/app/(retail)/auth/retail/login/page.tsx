'use client';

import React, { useState, useEffect } from 'react';
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
import { toast } from 'sonner';

export default function RetailLoginPage() {
  const { login } = useRetailAuth();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema as any),
    mode: 'onBlur', // Validate on blur, not on every change
    reValidateMode: 'onChange', // Re-validate on change after first submit
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitted, submitCount },
    trigger,
  } = form;

  // Only show errors after first submit attempt
  const shouldShowErrors = isSubmitted || submitCount > 0;

  // Store register results to avoid calling register() multiple times
  const emailRegister = register('email');
  const passwordRegister = register('password');

  // Fix autofill: trigger validation after mount to sync browser autofill values
  useEffect(() => {
    const timer = setTimeout(() => {
      trigger(['email', 'password']);
    }, 100);
    return () => clearTimeout(timer);
  }, [trigger]);

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

              <div className="space-y-2">
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-text-secondary"
                >
                  Email
                  <span className="ml-1 text-red-400">*</span>
                </label>
                <input
                  {...emailRegister}
                  type="email"
                  id="email"
                  name="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  onInput={(e) => {
                    // Handle autofill: trigger validation on input event
                    const target = e.target as HTMLInputElement;
                    emailRegister.onChange({
                      target,
                      currentTarget: target,
                      type: 'change',
                      bubbles: true,
                      cancelable: true,
                    } as React.ChangeEvent<HTMLInputElement>);
                  }}
                  className={`h-11 w-full rounded-xl border bg-surface px-4 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-0 ${
                    shouldShowErrors && errors.email
                      ? 'border-red-300 focus:border-red-400'
                      : 'border-border focus:border-accent'
                  }`}
                />
                {shouldShowErrors && errors.email && (
                  <p className="text-sm text-red-400">{errors.email.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-text-secondary"
                >
                  Password
                </label>
                <div className="relative">
                  <input
                    {...passwordRegister}
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    name="password"
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    onInput={(e) => {
                      // Handle autofill: trigger validation on input event
                      const target = e.target as HTMLInputElement;
                      passwordRegister.onChange({
                        target,
                        currentTarget: target,
                        type: 'change',
                        bubbles: true,
                        cancelable: true,
                      } as React.ChangeEvent<HTMLInputElement>);
                    }}
                    className={`h-11 w-full rounded-xl border bg-surface px-4 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-0 ${
                      shouldShowErrors && errors.password
                        ? 'border-red-300 focus:border-red-400'
                        : 'border-border focus:border-accent'
                    }`}
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
                {shouldShowErrors && errors.password && (
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

