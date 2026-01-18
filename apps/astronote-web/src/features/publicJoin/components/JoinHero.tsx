/* eslint-disable @next/next/no-img-element */
import type { ReactNode } from 'react';
import { ShieldCheck } from 'lucide-react';
import { JoinGlassCard } from './JoinGlassCard';

type JoinHeroProps = {
  logoUrl?: string | null
  storeName?: string
  storeDisplayName?: string
  headline: string
  subheadline: string
  ctaLabel: string
  onCtaClick?: () => void
  incentiveTitle: string
  incentiveText: string
  benefitsTitle: string
  benefits: ReadonlyArray<string>
  extraTextBox?: string | null
  socialLinks?: ReactNode
};

export function JoinHero({
  logoUrl,
  storeName,
  storeDisplayName,
  headline,
  subheadline,
  benefitsTitle,
  benefits,
  extraTextBox,
  socialLinks,
}: JoinHeroProps) {
  return (
    <div className="space-y-8 lg:space-y-10">
      {/* Brand row: logo + store name */}
      <div className="space-y-4">
        {logoUrl ? (
          <img
            src={logoUrl}
            alt={storeDisplayName || storeName || 'Store logo'}
            className="h-14 sm:h-16 lg:h-20 object-contain"
          />
        ) : null}
        <p className="text-base lg:text-lg text-[#A9B4CC]">
          {storeDisplayName || storeName || 'The store'}
        </p>
      </div>

      {/* Headline + subheadline */}
      <div className="space-y-4">
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-semibold leading-tight tracking-tight text-[#EAF0FF]">
          {headline}
        </h1>
        <p className="text-base lg:text-lg text-[#A9B4CC]">
          {subheadline}
        </p>
      </div>

      {/* Benefits list */}
      <div className="space-y-3">
        <p className="font-semibold text-base lg:text-lg text-[#EAF0FF]">
          {benefitsTitle}
        </p>
        <ul className="text-base lg:text-lg text-[#A9B4CC] space-y-2.5">
          {benefits.map((benefit, idx) => (
            <li key={idx} className="flex items-start gap-2.5">
              <ShieldCheck className="h-5 w-5 text-[color:var(--brand-accent)] mt-0.5 flex-shrink-0" />
              <span>{benefit}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Extra text box */}
      {extraTextBox ? (
        <JoinGlassCard
          className="p-5 lg:p-6"
          style={{ borderLeftWidth: '4px', borderLeftColor: 'var(--brand-accent)' }}
        >
          <p className="text-base lg:text-lg text-[#A9B4CC]">{extraTextBox}</p>
        </JoinGlassCard>
      ) : null}

      {/* Social links */}
      {socialLinks ? <div className="pt-2">{socialLinks}</div> : null}
    </div>
  );
}
