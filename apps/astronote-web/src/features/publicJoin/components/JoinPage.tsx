'use client';

import type { CSSProperties, FormEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Bell, Facebook, Globe, Instagram } from 'lucide-react';
import { PublicError } from '@/src/components/retail/public/PublicError';
import { PublicLoading } from '@/src/components/retail/public/PublicLoading';
import { PublicSuccess } from '@/src/components/retail/public/PublicSuccess';
import type { JoinInfoResponse } from '@/src/lib/retail/api/public';
import { useJoinPublicConfig } from '@/src/features/publicJoin/hooks/useJoinPublicConfig';
import { useJoinSubmit } from '@/src/features/publicJoin/hooks/useJoinSubmit';
import { joinCopy as en } from '@/src/features/publicJoin/i18n/en';
import { joinCopy as el } from '@/src/features/publicJoin/i18n/el';
import {
  normalizePhone,
  persistCountryCode,
  readStoredCountryCode,
} from '@/src/features/publicJoin/utils/normalizePhone';
import { JoinFormCard } from './JoinFormCard';
import { JoinHero } from './JoinHero';
import { JoinGlassCard } from './JoinGlassCard';
import { JoinLanguageToggle } from './JoinLanguageToggle';
import { JoinPageShell } from './JoinPageShell';
import { JoinSocialLinks } from './JoinSocialLinks';
import { ProvidedByAstronote } from './ProvidedByAstronote';

type Language = 'en' | 'el';

type JoinFormState = {
  firstName: string
  lastName: string
  email: string
  phoneCountryCode: string
  phoneNational: string
};

type JoinBranding = JoinInfoResponse['branding'] & {
  headlineOverride?: string | null
  extraTextBox?: string | null
  benefitsOverride?: string[] | null
};

const LANGUAGE_KEY = 'join_language';
const DEFAULT_PRIMARY = '#111827';
const DEFAULT_ACCENT = '#4FD1C5'; // Astronote teal/mint
const DEFAULT_COUNTRY_CODE = '+30';

const copy = { en, el } as const;

type JoinPageProps = {
  token: string
};

export function JoinPage({ token }: JoinPageProps) {
  const resolvedToken = token || null;
  const info = useJoinPublicConfig(resolvedToken);
  const submit = useJoinSubmit(resolvedToken);
  const [language, setLanguage] = useState<Language>('en');
  const [form, setForm] = useState<JoinFormState>({
    firstName: '',
    lastName: '',
    email: '',
    phoneCountryCode: DEFAULT_COUNTRY_CODE,
    phoneNational: '',
  });

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? window.localStorage.getItem(LANGUAGE_KEY) : null;
    if (saved === 'en' || saved === 'el') {
      setLanguage(saved);
    }
  }, []);

  const defaultCountryCode = info.data?.defaults?.phoneCountryCode || DEFAULT_COUNTRY_CODE;

  useEffect(() => {
    const stored = readStoredCountryCode(defaultCountryCode);
    setForm((prev) => ({ ...prev, phoneCountryCode: stored }));
  }, [defaultCountryCode]);

  const branding = (info.data?.branding || {}) as JoinBranding;
  const content = copy[language];

  const storeName = branding.storeName || (language === 'en' ? 'The store' : 'Το κατάστημα');
  const headline = branding.headlineOverride || branding.headline || content.headline;
  const subheadline = branding.subheadline || branding.pageDescription || content.subheadline;
  const extraTextBox = branding.extraTextBox || branding.merchantBlurb;

  const benefits = useMemo(() => {
    const override = branding.benefitsOverride || branding.benefits;
    if (override && Array.isArray(override) && override.length) {
      return override.slice(0, 5);
    }
    return content.benefits;
  }, [branding.benefits, branding.benefitsOverride, content.benefits]);

  const socialLinks = useMemo(() => {
    const links = [];
    if (branding.websiteUrl) {
      links.push({ href: branding.websiteUrl, label: content.websiteLabel, icon: Globe });
    }
    if (branding.facebookUrl) {
      links.push({ href: branding.facebookUrl, label: 'Facebook', icon: Facebook });
    }
    if (branding.instagramUrl) {
      links.push({ href: branding.instagramUrl, label: 'Instagram', icon: Instagram });
    }
    return links;
  }, [branding.facebookUrl, branding.instagramUrl, branding.websiteUrl, content.websiteLabel]);

  const primaryColor = branding.primaryColor || DEFAULT_PRIMARY;
  const accentColor = branding.accentColor || branding.secondaryColor || DEFAULT_ACCENT;
  const backgroundColor = branding.backgroundColor || accentColor;
  const gradientEnd = branding.secondaryColor || primaryColor;
  const brandStyle: CSSProperties & Record<string, string | undefined> = {
    '--brand-primary': primaryColor,
    '--brand-accent': accentColor,
    '--join-glow': backgroundColor,
    '--join-glow-secondary': gradientEnd,
    '--color-surface': 'rgba(15, 23, 42, 0.6)',
    '--color-surface-hover': 'rgba(15, 23, 42, 0.72)',
    '--color-border': 'rgba(148, 163, 184, 0.2)',
    '--color-border-light': 'rgba(148, 163, 184, 0.12)',
    '--color-accent': accentColor,
  };

  const handleChange = (key: keyof JoinFormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (key === 'phoneCountryCode') {
      persistCountryCode(value);
    }
  };

  const handleLanguageChange = (next: Language) => {
    setLanguage(next);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(LANGUAGE_KEY, next);
    }
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedPhone = normalizePhone({
      countryCode: form.phoneCountryCode,
      phoneNational: form.phoneNational,
      fallbackCountryCode: defaultCountryCode,
    });
    await submit.mutateAsync({
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim() || undefined,
      email: form.email.trim() || undefined,
      countryCode: normalizedPhone.countryCode,
      phoneNational: normalizedPhone.phoneNational,
    });
  };

  if (!resolvedToken) {
    return (
      <JoinPageShell style={brandStyle} footer={<ProvidedByAstronote />}>
        <div className="mx-auto w-full max-w-2xl">
          <JoinGlassCard className="p-6 sm:p-8">
            <PublicError title={content.invalidTitle} message={content.invalidMessage} />
          </JoinGlassCard>
        </div>
      </JoinPageShell>
    );
  }

  if (info.isLoading) {
    return (
      <JoinPageShell style={brandStyle} footer={<ProvidedByAstronote />}>
        <div className="mx-auto w-full max-w-2xl">
          <JoinGlassCard className="p-6 sm:p-8">
            <PublicLoading message={content.loading} />
          </JoinGlassCard>
        </div>
      </JoinPageShell>
    );
  }

  const isRateLimited =
    (info.error as any)?.response?.status === 429 ||
    (info.error as any)?.data?.code === 'RATE_LIMITED';

  if (info.error || !info.data?.ok) {
    return (
      <JoinPageShell style={brandStyle} footer={<ProvidedByAstronote />}>
        <div className="mx-auto w-full max-w-2xl">
          <JoinGlassCard className="p-6 sm:p-8">
            <PublicError
              title={isRateLimited ? content.rateLimitTitle : content.invalidTitle}
              message={isRateLimited ? content.rateLimitMessage : content.invalidMessage}
            />
          </JoinGlassCard>
        </div>
      </JoinPageShell>
    );
  }

  if (submit.isSuccess) {
    return (
      <JoinPageShell style={brandStyle} footer={<ProvidedByAstronote />}>
        <div className="mx-auto w-full max-w-2xl">
          <JoinGlassCard className="p-6 sm:p-8">
            <PublicSuccess title={content.successTitle} message={content.successMessage} />
          </JoinGlassCard>
        </div>
      </JoinPageShell>
    );
  }

  return (
    <JoinPageShell
      style={brandStyle}
      header={<JoinLanguageToggle value={language} onValueChange={handleLanguageChange} />}
      footer={<ProvidedByAstronote />}
    >
      {/* Mobile: Stacked layout */}
      <div className="lg:hidden space-y-10">
        <JoinHero
          logoUrl={branding.logoUrl}
          storeName={storeName}
          storeDisplayName={branding.storeDisplayName}
          headline={headline}
          subheadline={subheadline}
          ctaLabel={content.cta}
          onCtaClick={() => {
            const el = document.getElementById('join-form');
            el?.scrollIntoView({ behavior: 'smooth' });
          }}
          incentiveTitle={content.whatYouGainTitle}
          incentiveText={branding.incentiveText || content.incentiveText}
          benefitsTitle={content.benefitsTitle}
          benefits={benefits}
          extraTextBox={extraTextBox}
          socialLinks={socialLinks.length ? <JoinSocialLinks links={socialLinks} /> : null}
        />

        <div className="space-y-6">
          <JoinFormCard
            copy={content}
            form={form}
            onChange={handleChange}
            onSubmit={onSubmit}
            isSubmitting={submit.isPending}
            errorMessage={
              submit.error
                ? (submit.error as any)?.response?.data?.message || content.errorMessage
                : undefined
            }
            privacyUrl={branding.privacyUrl}
          />

          <JoinGlassCard className="p-6">
            <div className="flex items-start gap-3">
              <Bell className="h-5 w-5 text-[color:var(--brand-accent)] mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-base text-[#EAF0FF]">
                  {content.trustCardTitle}
                </p>
                <p className="text-sm text-[#A9B4CC] mt-1">
                  {content.trustCardBody}
                </p>
              </div>
            </div>
          </JoinGlassCard>
        </div>
      </div>

      {/* Desktop: Two-column grid */}
      <div className="hidden lg:grid lg:grid-cols-2 lg:gap-12 lg:items-start">
        {/* Left column */}
        <div className="space-y-8">
          <JoinHero
            logoUrl={branding.logoUrl}
            storeName={storeName}
            storeDisplayName={branding.storeDisplayName}
            headline={headline}
            subheadline={subheadline}
            ctaLabel={content.cta}
            onCtaClick={() => {
              const el = document.getElementById('join-form');
              el?.scrollIntoView({ behavior: 'smooth' });
            }}
            incentiveTitle={content.whatYouGainTitle}
            incentiveText={branding.incentiveText || content.incentiveText}
            benefitsTitle={content.benefitsTitle}
            benefits={benefits}
            extraTextBox={extraTextBox}
            socialLinks={socialLinks.length ? <JoinSocialLinks links={socialLinks} /> : null}
          />
        </div>

        {/* Right column: Form card */}
        <div className="space-y-6 lg:sticky lg:top-16">
          <JoinFormCard
            copy={content}
            form={form}
            onChange={handleChange}
            onSubmit={onSubmit}
            isSubmitting={submit.isPending}
            errorMessage={
              submit.error
                ? (submit.error as any)?.response?.data?.message || content.errorMessage
                : undefined
            }
            privacyUrl={branding.privacyUrl}
          />

          <JoinGlassCard className="p-6 lg:p-7">
            <div className="flex items-start gap-3">
              <Bell className="h-5 w-5 text-[color:var(--brand-accent)] mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-lg text-[#EAF0FF]">
                  {content.trustCardTitle}
                </p>
                <p className="text-base text-[#A9B4CC] mt-1">
                  {content.trustCardBody}
                </p>
              </div>
            </div>
          </JoinGlassCard>
        </div>
      </div>
    </JoinPageShell>
  );
}
