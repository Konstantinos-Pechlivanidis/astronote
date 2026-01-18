/* eslint-disable @next/next/no-img-element */
import type { ReactNode } from 'react';

type JoinHeroProps = {
  logoUrl?: string | null
  storeName: string
  storeDisplayName?: string
  headline: string
  subheadline: string
  extraContent?: ReactNode
  socialLinks?: ReactNode
};

/**
 * Hero section: logo, store name, headline, subheadline
 */
export function JoinHero({
  logoUrl,
  storeName,
  storeDisplayName,
  headline,
  subheadline,
  extraContent,
  socialLinks,
}: JoinHeroProps) {
  return (
    <div className="w-full max-w-[680px] space-y-8 lg:space-y-10">
      {/* Logo + Store Name */}
      <div className="space-y-4">
        {logoUrl && (
          <img
            src={logoUrl}
            alt={storeDisplayName || storeName}
            className="h-16 w-auto object-contain sm:h-20 lg:h-24"
          />
        )}
        <p className="text-base text-white/60 sm:text-lg">
          {storeDisplayName || storeName}
        </p>
      </div>

      {/* Headline + Subheadline */}
      <div className="space-y-4">
        <h1 className="text-3xl font-semibold leading-tight tracking-tight text-white sm:text-4xl lg:text-5xl">
          {headline}
        </h1>
        <p className="text-base text-white/70 sm:text-lg lg:text-xl">{subheadline}</p>
      </div>

      {/* Extra content (benefits, text box) */}
      {extraContent}

      {/* Social links */}
      {socialLinks && <div className="pt-2">{socialLinks}</div>}
    </div>
  );
}
