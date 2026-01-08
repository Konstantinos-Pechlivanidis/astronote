import type { FormEvent } from 'react';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

type FormData = {
  firstName: string
  lastName: string
  email: string
  phoneCountryCode: string
  phoneNational: string
};

type FormCopy = {
  vipLine: string
  cta: string
  submitting: string
  helperLine: string
  privacyNote?: string
  privacyLinkLabel: string
  fields: {
    firstName: string
    lastName: string
    phoneCountry: string
    phone: string
    email: string
  }
};

type JoinFormCardProps = {
  copy: FormCopy
  form: FormData
  onChange: (_key: keyof FormData, _value: string) => void
  onSubmit: (_event: FormEvent<HTMLFormElement>) => void
  isSubmitting: boolean
  errorMessage?: string
  privacyUrl?: string | null
};

/**
 * Join form card with glass morphism
 * Includes all input fields and CTA
 */
export function JoinFormCard({
  copy,
  form,
  onChange,
  onSubmit,
  isSubmitting,
  errorMessage,
  privacyUrl,
}: JoinFormCardProps) {
  const inputBaseClass =
    'w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-base text-white placeholder-white/40 shadow-sm backdrop-blur-md transition-all focus:border-[var(--theme-accent,#0ABAB5)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--theme-accent,#0ABAB5)]/30 disabled:opacity-50 h-12 lg:h-14';

  return (
    <div className="relative w-full max-w-[580px] lg:justify-self-end">
      {/* Radial glow behind card */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 rounded-3xl opacity-20 blur-3xl"
        style={{
          background:
            'radial-gradient(circle at center, var(--theme-accent, #0ABAB5), transparent 70%)',
        }}
      />

      {/* Glass card */}
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl sm:p-8 lg:p-10">
        <div className="space-y-6">
          {/* VIP line */}
          <div className="flex items-center gap-2 text-base text-white/60">
            <Sparkles className="h-5 w-5 text-[var(--theme-accent,#0ABAB5)]" />
            <span>{copy.vipLine}</span>
          </div>

          {/* Form */}
          <form onSubmit={onSubmit} className="space-y-5">
            {/* First name */}
            <div className="space-y-2">
              <label htmlFor="firstName" className="block text-sm font-medium text-white/80">
                {copy.fields.firstName} <span className="text-red-400">*</span>
              </label>
              <input
                id="firstName"
                name="firstName"
                type="text"
                required
                value={form.firstName}
                onChange={(e) => onChange('firstName', e.target.value)}
                placeholder={copy.fields.firstName}
                className={inputBaseClass}
                autoComplete="given-name"
              />
            </div>

            {/* Last name */}
            <div className="space-y-2">
              <label htmlFor="lastName" className="block text-sm font-medium text-white/80">
                {copy.fields.lastName}
              </label>
              <input
                id="lastName"
                name="lastName"
                type="text"
                value={form.lastName}
                onChange={(e) => onChange('lastName', e.target.value)}
                placeholder={copy.fields.lastName}
                className={inputBaseClass}
                autoComplete="family-name"
              />
            </div>

            {/* Phone */}
            <div className="space-y-2">
              <label htmlFor="phoneNational" className="block text-sm font-medium text-white/80">
                {copy.fields.phone} <span className="text-red-400">*</span>
              </label>
              <div className="flex gap-3">
                <input
                  id="phoneCountryCode"
                  name="phoneCountryCode"
                  type="tel"
                  value={form.phoneCountryCode}
                  onChange={(e) => onChange('phoneCountryCode', e.target.value)}
                  placeholder={copy.fields.phoneCountry}
                  className={cn(inputBaseClass, 'w-24 flex-shrink-0')}
                  inputMode="tel"
                  autoComplete="tel-country-code"
                />
                <input
                  id="phoneNational"
                  name="phoneNational"
                  type="tel"
                  required
                  value={form.phoneNational}
                  onChange={(e) => onChange('phoneNational', e.target.value)}
                  placeholder={copy.fields.phone}
                  className={cn(inputBaseClass, 'flex-1')}
                  inputMode="tel"
                  autoComplete="tel-national"
                />
              </div>
            </div>

            {/* Email */}
            <div className="space-y-2">
              <label htmlFor="email" className="block text-sm font-medium text-white/80">
                {copy.fields.email}
              </label>
              <input
                id="email"
                name="email"
                type="email"
                value={form.email}
                onChange={(e) => onChange('email', e.target.value)}
                placeholder={copy.fields.email}
                className={inputBaseClass}
                autoComplete="email"
              />
            </div>

            {/* CTA Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="h-12 w-full rounded-xl text-base font-semibold text-white shadow-lg transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed lg:h-14 lg:text-lg"
              style={{
                backgroundColor: 'var(--theme-accent, #0ABAB5)',
              }}
            >
              {isSubmitting ? copy.submitting : copy.cta}
            </button>

            {/* Error message */}
            {errorMessage && (
              <div className="rounded-xl bg-red-500/15 px-4 py-3 text-sm text-red-200">
                {errorMessage}
              </div>
            )}
          </form>

          {/* Helper text */}
          <div className="space-y-2 text-xs text-white/50 sm:text-sm">
            {copy.helperLine && <p>{copy.helperLine}</p>}
            {copy.privacyNote && <p>{copy.privacyNote}</p>}
            {privacyUrl && (
              <p>
                {copy.privacyLinkLabel}:{' '}
                <a
                  href={privacyUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="underline decoration-white/30 underline-offset-2 transition-colors hover:text-white/80"
                >
                  {privacyUrl}
                </a>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
