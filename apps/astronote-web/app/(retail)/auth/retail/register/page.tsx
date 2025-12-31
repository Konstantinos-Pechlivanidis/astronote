'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff } from 'lucide-react';
import { signupSchema } from '@/src/lib/retail/validators';
import { z } from 'zod';
import { useRetailAuth } from '@/src/features/retail/auth/useRetailAuth';
import { RetailPublicOnlyGuard } from '@/src/components/retail/RetailPublicOnlyGuard';
import { Button } from '@/components/ui/button';
import { RetailCard } from '@/src/components/retail/RetailCard';
import { RetailFormField } from '@/src/components/retail/RetailFormField';
import { toast } from 'sonner';

export default function RetailRegisterPage() {
  const { signup } = useRetailAuth();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const form = useForm<z.infer<typeof signupSchema>>({
    resolver: zodResolver(signupSchema as any),
    mode: 'onChange',
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
    getValues,
    trigger,
  } = form;

  // Store register results to avoid calling register() multiple times
  const emailRegister = register('email');
  const passwordRegister = register('password');
  const confirmPasswordRegister = register('confirmPassword');

  // Fix autofill: trigger validation after mount to sync browser autofill values
  useEffect(() => {
    const timer = setTimeout(() => {
      trigger(['email', 'password', 'confirmPassword']);
    }, 100);
    return () => clearTimeout(timer);
  }, [trigger]);

  const onSubmit = async (data: z.infer<typeof signupSchema>) => {
    // TEMP INSTRUMENTATION: Log submit handler invocation
    // eslint-disable-next-line no-console
    console.log('[Register] ✅ handleSubmit invoked - onSubmit called');
    // eslint-disable-next-line no-console
    console.log('[Register] Form values:', getValues());
    // eslint-disable-next-line no-console
    console.log('[Register] Form errors:', errors);
    // eslint-disable-next-line no-console
    console.log('[Register] Validated data:', data);

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
      <div className="flex min-h-screen items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
        <div className="w-full max-w-md">
          <RetailCard className="p-6 sm:p-8">
            <form
              onSubmit={(e) => {
                // TEMP INSTRUMENTATION: Log form submit event
                // eslint-disable-next-line no-console
                console.log('[Register] 🔵 FORM SUBMIT EVENT FIRED', e);
                // eslint-disable-next-line no-console
                console.log('[Register] Form errors before handleSubmit:', errors);
                // eslint-disable-next-line no-console
                console.log('[Register] Form values before handleSubmit:', getValues());
                handleSubmit(onSubmit)(e);
              }}
              className="space-y-6"
            >
              <div className="text-center">
                <h2 className="mb-2 text-3xl font-bold text-text-primary">
                  Create your account
                </h2>
                <p className="text-sm text-text-secondary">
                  Start sending SMS campaigns to your customers
                </p>
              </div>

              {error && (
                <RetailCard variant="danger" className="p-4">
                  <p className="text-sm text-red-800">{error}</p>
                </RetailCard>
              )}

              {/* TEMP INSTRUMENTATION: Enhanced debug panel */}
              <div className="rounded-md bg-gray-100 p-2 text-xs">
                <strong>🔍 DEBUG INSTRUMENTATION:</strong>
                <pre className="mt-1 overflow-auto">
                  {JSON.stringify(
                    {
                      errors,
                      values: getValues(),
                      isValid: form.formState.isValid,
                      isDirty: form.formState.isDirty,
                      isSubmitting: form.formState.isSubmitting,
                      touchedFields: form.formState.touchedFields,
                    },
                    null,
                    2,
                  )}
                </pre>
              </div>

              <RetailFormField
                label="Email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                error={errors.email?.message}
                {...emailRegister}
                onInput={(e) => {
                  // TEMP INSTRUMENTATION: Log input event
                  const target = e.target as HTMLInputElement;
                  // eslint-disable-next-line no-console
                  console.log('[Register] Email onInput:', target.value);
                  // Handle autofill: manually trigger RHF onChange for autofill events
                  emailRegister.onChange({ target, type: 'change' } as any);
                }}
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
                    {...passwordRegister}
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    name="password"
                    autoComplete="new-password"
                    placeholder="At least 8 characters"
                    onInput={(e) => {
                      // TEMP INSTRUMENTATION: Log input event
                      const target = e.target as HTMLInputElement;
                      // eslint-disable-next-line no-console
                      console.log('[Register] Password onInput:', target.value);
                      // Handle autofill: trigger validation on input event
                      passwordRegister.onChange({ target, type: 'change' } as any);
                    }}
                    onChange={(e) => {
                      // TEMP INSTRUMENTATION: Log change event
                      // eslint-disable-next-line no-console
                      console.log('[Register] Password onChange:', e.target.value);
                      passwordRegister.onChange(e);
                    }}
                    className="h-11 w-full rounded-xl border border-border bg-surface px-4 py-2 pr-10 text-sm text-text-primary placeholder:text-text-tertiary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-0"
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

              <div className="space-y-2">
                <label
                  htmlFor="confirmPassword"
                  className="block text-sm font-medium text-text-secondary"
                >
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    {...confirmPasswordRegister}
                    type={showConfirmPassword ? 'text' : 'password'}
                    id="confirmPassword"
                    name="confirmPassword"
                    autoComplete="new-password"
                    placeholder="Confirm your password"
                    onInput={(e) => {
                      // TEMP INSTRUMENTATION: Log input event
                      const target = e.target as HTMLInputElement;
                      // eslint-disable-next-line no-console
                      console.log('[Register] ConfirmPassword onInput:', target.value);
                      // Handle autofill: trigger validation on input event
                      confirmPasswordRegister.onChange({ target, type: 'change' } as any);
                    }}
                    onChange={(e) => {
                      // TEMP INSTRUMENTATION: Log change event
                      // eslint-disable-next-line no-console
                      console.log('[Register] ConfirmPassword onChange:', e.target.value);
                      confirmPasswordRegister.onChange(e);
                    }}
                    className="h-11 w-full rounded-xl border border-border bg-surface px-4 py-2 pr-10 text-sm text-text-primary placeholder:text-text-tertiary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-0"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary transition-colors hover:text-text-primary"
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <p className="text-sm text-red-400">{errors.confirmPassword.message}</p>
                )}
              </div>

              <RetailFormField
                label="Sender Name"
                type="text"
                maxLength={11}
                placeholder="YourStore (max 11 chars)"
                helper="SMS sender ID (alphanumeric, max 11 characters)"
                error={errors.senderName?.message}
                {...register('senderName')}
              />

              <RetailFormField
                label="Company Name"
                type="text"
                maxLength={160}
                placeholder="Your Store Name"
                error={errors.company?.message}
                {...register('company')}
              />

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full"
                size="lg"
                onClick={(e) => {
                  // TEMP INSTRUMENTATION: Log button click
                  // eslint-disable-next-line no-console
                  console.log('[Register] 🟢 BUTTON CLICK - type:', e.currentTarget.type, 'disabled:', isLoading);
                  // eslint-disable-next-line no-console
                  console.log('[Register] Form errors on click:', errors);
                  // eslint-disable-next-line no-console
                  console.log('[Register] Form values on click:', getValues());
                  // eslint-disable-next-line no-console
                  console.log('[Register] Form isValid:', form.formState.isValid);
                  // eslint-disable-next-line no-console
                  console.log('[Register] Form isDirty:', form.formState.isDirty);
                }}
              >
                {isLoading ? 'Creating account...' : 'Sign Up'}
              </Button>

              <p className="text-center text-sm text-text-secondary">
                Already have an account?{' '}
                <Link
                  href="/auth/retail/login"
                  className="font-medium text-accent underline underline-offset-4 transition-colors hover:text-accent-hover"
                >
                  Log in
                </Link>
              </p>
            </form>
          </RetailCard>
        </div>
      </div>
    </RetailPublicOnlyGuard>
  );
}
