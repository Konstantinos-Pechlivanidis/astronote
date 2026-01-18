import type { FormEvent } from 'react';
import { THEME } from './theme';
import { cn } from '@/lib/utils';

type FormData = {
  firstName: string
  lastName: string
  email: string
  phoneCountryCode: string
  phoneNational: string
  gender: string
  birthday: string
};

type FormCopy = {
  cta: string
  submitting: string
  trustLine: string
  fields: {
    firstName: string
    lastName: string
    phoneCountry: string
    phone: string
    email: string
    gender: string
    birthday: string
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
 * Premium form card with glass styling
 */
export function JoinFormCard({
  copy,
  form,
  onChange,
  onSubmit,
  isSubmitting,
  errorMessage,
}: JoinFormCardProps) {
  const inputClass = cn(
    'w-full rounded-lg px-4 py-3.5 text-base backdrop-blur-xl transition-all',
    'focus:outline-none focus:ring-2',
    'disabled:opacity-50 disabled:cursor-not-allowed',
  );

  return (
    <div className="w-full max-w-[520px] lg:ml-auto">
      <div
        className="rounded-2xl p-6 backdrop-blur-xl sm:p-8"
        style={{
          backgroundColor: THEME.bg.card,
          border: `1px solid ${THEME.border.default}`,
        }}
      >
        <form onSubmit={onSubmit} className="space-y-5">
          {/* First name */}
          <div className="space-y-2">
            <label
              htmlFor="firstName"
              className="block text-sm font-medium"
              style={{ color: THEME.text.secondary }}
            >
              {copy.fields.firstName} <span style={{ color: '#F87171' }}>*</span>
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
              style={{
                backgroundColor: THEME.input.bg,
                border: `1px solid ${THEME.input.border}`,
                color: THEME.input.text,
              }}
              autoComplete="given-name"
              disabled={isSubmitting}
              onFocus={(e) => {
                e.target.style.borderColor = THEME.accent.default;
                e.target.style.boxShadow = `0 0 0 3px ${THEME.accent.light}`;
              }}
              onBlur={(e) => {
                e.target.style.borderColor = THEME.input.border;
                e.target.style.boxShadow = 'none';
              }}
            />
          </div>

          {/* Last name */}
          <div className="space-y-2">
            <label
              htmlFor="lastName"
              className="block text-sm font-medium"
              style={{ color: THEME.text.secondary }}
            >
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
              style={{
                backgroundColor: THEME.input.bg,
                border: `1px solid ${THEME.input.border}`,
                color: THEME.input.text,
              }}
              autoComplete="family-name"
              disabled={isSubmitting}
              onFocus={(e) => {
                e.target.style.borderColor = THEME.accent.default;
                e.target.style.boxShadow = `0 0 0 3px ${THEME.accent.light}`;
              }}
              onBlur={(e) => {
                e.target.style.borderColor = THEME.input.border;
                e.target.style.boxShadow = 'none';
              }}
            />
          </div>

          {/* Phone */}
          <div className="space-y-2">
            <label
              htmlFor="phoneNational"
              className="block text-sm font-medium"
              style={{ color: THEME.text.secondary }}
            >
              {copy.fields.phone} <span style={{ color: '#F87171' }}>*</span>
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
                style={{
                  backgroundColor: THEME.input.bg,
                  border: `1px solid ${THEME.input.border}`,
                  color: THEME.input.text,
                }}
                inputMode="tel"
                autoComplete="tel-country-code"
                disabled={isSubmitting}
                onFocus={(e) => {
                  e.target.style.borderColor = THEME.accent.default;
                  e.target.style.boxShadow = `0 0 0 3px ${THEME.accent.light}`;
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = THEME.input.border;
                  e.target.style.boxShadow = 'none';
                }}
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
                style={{
                  backgroundColor: THEME.input.bg,
                  border: `1px solid ${THEME.input.border}`,
                  color: THEME.input.text,
                }}
                inputMode="tel"
                autoComplete="tel-national"
                disabled={isSubmitting}
                onFocus={(e) => {
                  e.target.style.borderColor = THEME.accent.default;
                  e.target.style.boxShadow = `0 0 0 3px ${THEME.accent.light}`;
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = THEME.input.border;
                  e.target.style.boxShadow = 'none';
                }}
              />
            </div>
          </div>

          {/* Email */}
          <div className="space-y-2">
            <label
              htmlFor="email"
              className="block text-sm font-medium"
              style={{ color: THEME.text.secondary }}
            >
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
              style={{
                backgroundColor: THEME.input.bg,
                border: `1px solid ${THEME.input.border}`,
                color: THEME.input.text,
              }}
              autoComplete="email"
              disabled={isSubmitting}
              onFocus={(e) => {
                e.target.style.borderColor = THEME.accent.default;
                e.target.style.boxShadow = `0 0 0 3px ${THEME.accent.light}`;
              }}
              onBlur={(e) => {
                e.target.style.borderColor = THEME.input.border;
                e.target.style.boxShadow = 'none';
              }}
            />
          </div>

          {/* Gender */}
          <div className="space-y-2">
            <label
              htmlFor="gender"
              className="block text-sm font-medium"
              style={{ color: THEME.text.secondary }}
            >
              {copy.fields.gender}
            </label>
            <select
              id="gender"
              name="gender"
              value={form.gender}
              onChange={(e) => onChange('gender', e.target.value)}
              className={inputClass}
              style={{
                backgroundColor: THEME.input.bg,
                border: `1px solid ${THEME.input.border}`,
                color: THEME.input.text,
              }}
              disabled={isSubmitting}
              onFocus={(e) => {
                e.target.style.borderColor = THEME.accent.default;
                e.target.style.boxShadow = `0 0 0 3px ${THEME.accent.light}`;
              }}
              onBlur={(e) => {
                e.target.style.borderColor = THEME.input.border;
                e.target.style.boxShadow = 'none';
              }}
            >
              <option value="">Select gender (optional)</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* Birthday */}
          <div className="space-y-2">
            <label
              htmlFor="birthday"
              className="block text-sm font-medium"
              style={{ color: THEME.text.secondary }}
            >
              {copy.fields.birthday}
            </label>
            <input
              id="birthday"
              name="birthday"
              type="date"
              value={form.birthday}
              onChange={(e) => onChange('birthday', e.target.value)}
              className={inputClass}
              style={{
                backgroundColor: THEME.input.bg,
                border: `1px solid ${THEME.input.border}`,
                color: THEME.input.text,
              }}
              disabled={isSubmitting}
              onFocus={(e) => {
                e.target.style.borderColor = THEME.accent.default;
                e.target.style.boxShadow = `0 0 0 3px ${THEME.accent.light}`;
              }}
              onBlur={(e) => {
                e.target.style.borderColor = THEME.input.border;
                e.target.style.boxShadow = 'none';
              }}
            />
          </div>

          {/* Submit button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="h-12 w-full rounded-lg text-base font-semibold shadow-lg transition-all hover:shadow-xl active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              backgroundColor: THEME.accent.default,
              color: '#FFFFFF',
            }}
            onMouseEnter={(e) => !isSubmitting && (e.currentTarget.style.backgroundColor = THEME.accent.hover)}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = THEME.accent.default)}
          >
            {isSubmitting ? copy.submitting : copy.cta}
          </button>

          {/* Error message */}
          {errorMessage && (
            <div
              className="rounded-lg px-4 py-3 text-sm"
              style={{
                backgroundColor: 'rgba(248, 113, 113, 0.1)',
                border: '1px solid rgba(248, 113, 113, 0.3)',
                color: '#FCA5A5',
              }}
            >
              {errorMessage}
            </div>
          )}

          {/* Trust line */}
          <p className="text-xs" style={{ color: THEME.text.tertiary }}>
            {copy.trustLine}
          </p>
        </form>
      </div>
    </div>
  );
}
