import type { FormEvent } from 'react';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { JoinGlassCard } from './JoinGlassCard';

type JoinFormState = {
  firstName: string
  lastName: string
  email: string
  phoneCountryCode: string
  phoneNational: string
};

type JoinFormCopy = {
  cta: string
  vipLine: string
  helperLine: string
  privacyNote: string
  privacyLinkLabel: string
  fields: {
    firstName: string
    lastName: string
    phoneCountry: string
    phone: string
    email: string
  }
  submitting: string
};

type JoinFormCardProps = {
  copy: JoinFormCopy
  form: JoinFormState
  onChange: (_key: keyof JoinFormState, _value: string) => void
  onSubmit: (_event: FormEvent<HTMLFormElement>) => void
  isSubmitting: boolean
  errorMessage?: string
  privacyUrl?: string | null
};

export function JoinFormCard({
  copy,
  form,
  onChange,
  onSubmit,
  isSubmitting,
  errorMessage,
  privacyUrl,
}: JoinFormCardProps) {
  const inputClassName =
    'w-full h-12 lg:h-14 rounded-xl border border-white/12 bg-[rgba(255,255,255,0.08)] px-4 py-3 text-base lg:text-lg text-white placeholder:text-white/45 caret-white shadow-sm backdrop-blur-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent transition-colors';

  return (
    <div className="relative">
      {/* Radial highlight behind form card */}
      <div
        className="absolute inset-0 -z-10 rounded-3xl opacity-20 blur-3xl"
        style={{
          background: 'radial-gradient(circle at center, var(--brand-accent), transparent 70%)',
        }}
      />
      <JoinGlassCard className="p-6 sm:p-8 lg:p-10 relative">
        <div className="space-y-6" id="join-form">
          <div className="flex items-center gap-2 text-base lg:text-lg text-[#A9B4CC]">
            <Sparkles className="h-5 w-5 text-[color:var(--brand-accent)]" />
            <span>{copy.vipLine}</span>
          </div>
          <form onSubmit={onSubmit} className="space-y-4 lg:space-y-5">
            <div className="space-y-2">
              <label className="text-base lg:text-lg text-[#A9B4CC] font-medium">
                {copy.fields.firstName} <span className="text-red-400">*</span>
              </label>
              <input
                required
                name="firstName"
                value={form.firstName}
                onChange={(e) => onChange('firstName', e.target.value)}
                placeholder={copy.fields.firstName}
                className={inputClassName}
                autoComplete="given-name"
              />
            </div>
            <div className="space-y-2">
              <label className="text-base lg:text-lg text-[#A9B4CC] font-medium">
                {copy.fields.lastName}
              </label>
              <input
                name="lastName"
                value={form.lastName}
                onChange={(e) => onChange('lastName', e.target.value)}
                placeholder={copy.fields.lastName}
                className={inputClassName}
                autoComplete="family-name"
              />
            </div>
            <div className="space-y-2">
              <label className="text-base lg:text-lg text-[#A9B4CC] font-medium">
                {copy.fields.phone} <span className="text-red-400">*</span>
              </label>
              <div className="flex gap-3 lg:gap-4">
                <input
                  name="phoneCountryCode"
                  value={form.phoneCountryCode}
                  onChange={(e) => onChange('phoneCountryCode', e.target.value)}
                  className={cn(inputClassName, 'w-24 flex-shrink-0')}
                  inputMode="tel"
                  autoComplete="tel-country-code"
                  placeholder={copy.fields.phoneCountry}
                />
                <input
                  required
                  name="phoneNational"
                  value={form.phoneNational}
                  onChange={(e) => onChange('phoneNational', e.target.value)}
                  placeholder={copy.fields.phone}
                  className={cn(inputClassName, 'flex-1')}
                  inputMode="tel"
                  autoComplete="tel-national"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-base lg:text-lg text-[#A9B4CC] font-medium">
                {copy.fields.email}
              </label>
              <input
                name="email"
                type="email"
                value={form.email}
                onChange={(e) => onChange('email', e.target.value)}
                placeholder={copy.fields.email}
                className={inputClassName}
                autoComplete="email"
              />
            </div>
            <Button
              type="submit"
              className="w-full h-12 lg:h-14 rounded-xl text-base lg:text-lg bg-[color:var(--brand-accent)] text-white hover:bg-[color:var(--brand-accent)]/90 active:scale-[0.98] shadow-[0_12px_30px_-16px_rgba(0,0,0,0.6)] focus-visible:ring-2 focus-visible:ring-[color:var(--brand-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent transition-all"
              disabled={isSubmitting}
            >
              {isSubmitting ? copy.submitting : copy.cta}
            </Button>
            {errorMessage ? (
              <p className="text-sm lg:text-base text-red-200 bg-red-500/15 rounded-xl px-4 py-2">
                {errorMessage}
              </p>
            ) : null}
          </form>
          <div className="text-xs lg:text-sm text-[#A9B4CC] space-y-1">
            {copy.helperLine ? <p>{copy.helperLine}</p> : null}
            {copy.privacyNote ? <p>{copy.privacyNote}</p> : null}
            {privacyUrl ? (
              <p>
                {copy.privacyLinkLabel}:{' '}
                <a
                  className="underline decoration-white/50 underline-offset-4 hover:text-white transition-colors"
                  href={privacyUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  {privacyUrl}
                </a>
              </p>
            ) : null}
          </div>
        </div>
      </JoinGlassCard>
    </div>
  );
}
