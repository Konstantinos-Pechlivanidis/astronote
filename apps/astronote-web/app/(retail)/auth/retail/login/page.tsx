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
import { AuthHeader } from '@/src/components/retail/AuthHeader';
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
        err?.response?.data?.message ||
        err?.message ||
        'Invalid email or password';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const starBackground = `
    radial-gradient(circle at 20% 20%, rgba(34, 211, 238, 0.18), transparent 25%),
    radial-gradient(circle at 80% 0%, rgba(34, 211, 238, 0.12), transparent 25%),
    radial-gradient(circle at 50% 80%, rgba(34, 211, 238, 0.1), transparent 25%),
    radial-gradient(1px 1px at 20% 30%, rgba(125, 211, 252, 0.6), transparent 0.6px),
    radial-gradient(1px 1px at 80% 40%, rgba(125, 211, 252, 0.4), transparent 0.6px),
    radial-gradient(1px 1px at 50% 70%, rgba(125, 211, 252, 0.5), transparent 0.6px)
  `;

  return (
    <RetailPublicOnlyGuard>
      <div className="relative min-h-screen overflow-hidden bg-[#05070b] text-white">
        <div
          className="pointer-events-none absolute inset-0 opacity-50"
          style={{ backgroundImage: starBackground }}
        />
        <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
          <div className="w-full max-w-md">
            <RetailCard className="p-6 sm:p-8 lg:p-10 bg-background/90">
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <AuthHeader
                  title="Welcome back"
                  subtitle="Sign in to your account"
                />

                {error && (
                  <div className="rounded-xl border border-red-200 bg-red-50/80 p-4 backdrop-blur-sm">
                    <p className="text-sm font-medium text-red-800">{error}</p>
                  </div>
                )}

                <div className="space-y-2">
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-text-secondary"
                  >
                    Email
                    <span className="ml-1 text-red-500">*</span>
                  </label>
                  <input
                    {...emailRegister}
                    type="email"
                    id="email"
                    name="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    onInput={e => {
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
                    className={`h-12 w-full rounded-xl border bg-surface px-4 py-3 text-base text-text-primary transition-all placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-background ${
                      shouldShowErrors && errors.email
                        ? 'border-red-400 focus:border-red-500 focus:ring-red-400'
                        : 'border-border focus:border-accent'
                    }`}
                  />
                  {shouldShowErrors && errors.email && (
                    <p className="text-sm font-medium text-red-600">
                      {errors.email.message}
                    </p>
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
                      onInput={e => {
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
                      className={`h-12 w-full rounded-xl border bg-surface px-4 py-3 pr-12 text-base text-text-primary transition-all placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-background ${
                        shouldShowErrors && errors.password
                          ? 'border-red-400 focus:border-red-500 focus:ring-red-400'
                          : 'border-border focus:border-accent'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary transition-colors hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 rounded-md p-1"
                      aria-label={
                        showPassword ? 'Hide password' : 'Show password'
                      }
                    >
                      {showPassword ? (
                        <EyeOff className="h-5 w-5" />
                      ) : (
                        <Eye className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                  {shouldShowErrors && errors.password && (
                    <p className="text-sm font-medium text-red-600">
                      {errors.password.message}
                    </p>
                  )}
                </div>

                <div className="pt-2">
                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="w-full h-12 text-base font-semibold shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                    size="lg"
                  >
                    {isLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        Signing in...
                      </span>
                    ) : (
                      'Log In'
                    )}
                  </Button>
                </div>

                <div className="pt-2">
                  <p className="text-center text-sm text-text-secondary">
                    Don&apos;t have an account?{' '}
                    <Link
                      href="/auth/retail/register"
                      className="font-semibold text-accent underline underline-offset-4 transition-colors hover:text-accent-hover focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 rounded-sm"
                    >
                      Sign up
                    </Link>
                  </p>
                </div>
              </form>
            </RetailCard>
          </div>
        </div>
      </div>
    </RetailPublicOnlyGuard>
  );
}
