import type { FormEvent } from 'react';
import { cn } from '@/lib/utils';

type FormData = {
  firstName: string
  lastName: string
  email: string
  phoneCountryCode: string
  phoneNational: string
};

type FormCopy = {
  cta: string
  submitting: string
  consentText: string
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
};

/**
 * Clean form card with white background and simple styling
 */
export function JoinFormCard({
  copy,
  form,
  onChange,
  onSubmit,
  isSubmitting,
  errorMessage,
}: JoinFormCardProps) {
  const inputClass =
    'w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 placeholder-slate-400 shadow-sm transition-all focus:border-[var(--accent,#2563eb)] focus:outline-none focus:ring-2 focus:ring-[var(--accent,#2563eb)]/30 disabled:bg-slate-50 disabled:text-slate-500 h-12';

  return (
    <div className="w-full max-w-[520px] lg:justify-self-end">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-lg sm:p-8">
        <form onSubmit={onSubmit} className="space-y-5">
          {/* First name */}
          <div className="space-y-2">
            <label htmlFor="firstName" className="block text-sm font-medium text-slate-700">
              {copy.fields.firstName} <span className="text-red-500">*</span>
            </label>
            <input
              id="firstName"
              name="firstName"
              type="text"
              required
              value={form.firstName}
              onChange={(e) => onChange('firstName', e.target.value)}
              placeholder={copy.fields.firstName}
              className={inputClass}
              autoComplete="given-name"
              disabled={isSubmitting}
            />
          </div>

          {/* Last name (optional) */}
          <div className="space-y-2">
            <label htmlFor="lastName" className="block text-sm font-medium text-slate-700">
              {copy.fields.lastName}
            </label>
            <input
              id="lastName"
              name="lastName"
              type="text"
              value={form.lastName}
              onChange={(e) => onChange('lastName', e.target.value)}
              placeholder={copy.fields.lastName}
              className={inputClass}
              autoComplete="family-name"
              disabled={isSubmitting}
            />
          </div>

          {/* Phone */}
          <div className="space-y-2">
            <label htmlFor="phoneNational" className="block text-sm font-medium text-slate-700">
              {copy.fields.phone} <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-3">
              <input
                id="phoneCountryCode"
                name="phoneCountryCode"
                type="tel"
                value={form.phoneCountryCode}
                onChange={(e) => onChange('phoneCountryCode', e.target.value)}
                placeholder={copy.fields.phoneCountry}
                className={cn(inputClass, 'w-24 flex-shrink-0')}
                inputMode="tel"
                autoComplete="tel-country-code"
                disabled={isSubmitting}
              />
              <input
                id="phoneNational"
                name="phoneNational"
                type="tel"
                required
                value={form.phoneNational}
                onChange={(e) => onChange('phoneNational', e.target.value)}
                placeholder={copy.fields.phone}
                className={cn(inputClass, 'flex-1')}
                inputMode="tel"
                autoComplete="tel-national"
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* Email (optional) */}
          <div className="space-y-2">
            <label htmlFor="email" className="block text-sm font-medium text-slate-700">
              {copy.fields.email}
            </label>
            <input
              id="email"
              name="email"
              type="email"
              value={form.email}
              onChange={(e) => onChange('email', e.target.value)}
              placeholder={copy.fields.email}
              className={inputClass}
              autoComplete="email"
              disabled={isSubmitting}
            />
          </div>

          {/* Submit button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="h-12 w-full rounded-lg text-base font-semibold text-white shadow-md transition-all hover:shadow-lg active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              backgroundColor: 'var(--accent, #2563eb)',
            }}
            onMouseEnter={(e) => {
              if (!isSubmitting) {
                e.currentTarget.style.backgroundColor = 'var(--accent-hover, #1d4ed8)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--accent, #2563eb)';
            }}
          >
            {isSubmitting ? copy.submitting : copy.cta}
          </button>

          {/* Error message */}
          {errorMessage && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {errorMessage}
            </div>
          )}

          {/* Consent text */}
          <p className="text-xs text-slate-500">{copy.consentText}</p>
        </form>
      </div>
    </div>
  );
}
