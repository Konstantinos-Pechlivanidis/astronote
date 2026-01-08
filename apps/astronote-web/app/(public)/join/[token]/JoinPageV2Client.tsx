'use client';

import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import { useJoinPublicConfig } from '@/src/features/publicJoin/hooks/useJoinPublicConfig';
import { useJoinSubmit } from '@/src/features/publicJoin/hooks/useJoinSubmit';
import { joinCopyV2 as en } from '@/src/features/publicJoin/i18n/enV2';
import { joinCopyV2 as el } from '@/src/features/publicJoin/i18n/elV2';
import {
  normalizePhone,
  persistCountryCode,
  readStoredCountryCode,
} from '@/src/features/publicJoin/utils/normalizePhone';
import {
  JoinShell,
  JoinTopBar,
  JoinHero,
  JoinBenefits,
  JoinFormCard,
  JoinFooter,
  THEME,
} from '@/src/components/publicJoinV2';
import { resolveContent, parseBenefits } from '@/src/components/publicJoinV2/contentResolver';

type Language = 'en' | 'el';

type FormData = {
  firstName: string
  lastName: string
  email: string
  phoneCountryCode: string
  phoneNational: string
};

const LANGUAGE_KEY = 'join_language';
const DEFAULT_COUNTRY_CODE = '+30';
const LANDING_PAGE_URL = process.env.NEXT_PUBLIC_LANDING_PAGE_URL || 'https://astronote.app';

const copy = { en, el } as const;

/**
 * Error/Loading/Success states
 */
function StateCard({ title, message, type }: { title: string; message: string; type: 'error' | 'loading' | 'success' }) {
  return (
    <div className="mx-auto max-w-2xl rounded-2xl p-8 text-center backdrop-blur-xl" style={{
      backgroundColor: THEME.bg.card,
      border: `1px solid ${THEME.border.default}`,
    }}>
      {type === 'loading' && (
        <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-t-[#0ABAB5]" style={{
          borderColor: `${THEME.border.default} ${THEME.border.default} ${THEME.accent.default} ${THEME.border.default}`,
        }} />
      )}
      {type === 'error' && (
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full" style={{ backgroundColor: 'rgba(248, 113, 113, 0.1)' }}>
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="#F87171">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
      )}
      {type === 'success' && (
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full" style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)' }}>
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="#22C55E">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}
      <h2 className="mb-2 text-lg font-semibold" style={{ color: THEME.text.primary }}>{title}</h2>
      <p className="text-sm" style={{ color: THEME.text.secondary }}>{message}</p>
    </div>
  );
}

export function JoinPageV2Client({ token }: { token: string }) {
  const resolvedToken = token || null;
  const info = useJoinPublicConfig(resolvedToken);
  const submit = useJoinSubmit(resolvedToken);
  const [language, setLanguage] = useState<Language>('en');
  const [form, setForm] = useState<FormData>({
    firstName: '',
    lastName: '',
    email: '',
    phoneCountryCode: DEFAULT_COUNTRY_CODE,
    phoneNational: '',
  });

  // Load saved language
  useEffect(() => {
    const saved = typeof window !== 'undefined' ? window.localStorage.getItem(LANGUAGE_KEY) : null;
    if (saved === 'en' || saved === 'el') {
      setLanguage(saved);
    }
  }, []);

  // Set default country code
  const defaultCountryCode = info.data?.defaults?.phoneCountryCode || DEFAULT_COUNTRY_CODE;
  useEffect(() => {
    const stored = readStoredCountryCode(defaultCountryCode);
    setForm((prev) => ({ ...prev, phoneCountryCode: stored }));
  }, [defaultCountryCode]);

  // Resolve branding and content
  const branding = info.data?.branding;
  const content = copy[language];

  // Resolve bilingual content (merchant overrides + Astronote defaults)
  const resolvedContent = resolveContent(language, branding);
  const parsedBenefits = parseBenefits(resolvedContent.benefits);

  const storeName = branding?.storeName || (language === 'en' ? 'Store' : 'Κατάστημα');

  // Handlers
  const handleChange = (key: keyof FormData, value: string) => {
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

  // Error states
  if (!resolvedToken) {
    return (
      <JoinShell>
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
          <StateCard
            type="error"
            title={content.invalidTitle}
            message={content.invalidMessage}
          />
        </div>
      </JoinShell>
    );
  }

  if (info.isLoading) {
    return (
      <JoinShell>
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
          <StateCard
            type="loading"
            title={content.loading}
            message=""
          />
        </div>
      </JoinShell>
    );
  }

  const isRateLimited =
    (info.error as any)?.response?.status === 429 ||
    (info.error as any)?.data?.code === 'RATE_LIMITED';

  if (info.error || !info.data?.ok) {
    return (
      <JoinShell>
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
          <StateCard
            type="error"
            title={isRateLimited ? content.rateLimitTitle : content.invalidTitle}
            message={isRateLimited ? content.rateLimitMessage : content.invalidMessage}
          />
        </div>
      </JoinShell>
    );
  }

  if (submit.isSuccess) {
    return (
      <JoinShell>
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
          <StateCard
            type="success"
            title={content.successTitle}
            message={content.successMessage}
          />
        </div>
      </JoinShell>
    );
  }

  // Main UI
  return (
    <JoinShell>
      <JoinTopBar
        logoUrl={branding?.logoUrl}
        storeName={storeName}
        storeDisplayName={branding?.storeDisplayName}
        language={language}
        onLanguageChange={handleLanguageChange}
        landingUrl={LANDING_PAGE_URL}
      />

      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8 lg:py-16">
        {/* Mobile layout */}
        <div className="space-y-10 lg:hidden">
          <div className="space-y-8">
            <JoinHero
              headline={resolvedContent.headline}
              subheadline={resolvedContent.subheadline}
              trustLine={content.trustLine}
            />
            <JoinBenefits benefits={parsedBenefits} />
            {resolvedContent.extraText && (
              <div className="rounded-xl p-4" style={{
                backgroundColor: THEME.bg.card,
                border: `1px solid ${THEME.border.default}`,
              }}>
                <p className="text-sm" style={{ color: THEME.text.secondary }}>
                  {resolvedContent.extraText}
                </p>
              </div>
            )}
          </div>
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
          />
        </div>

        {/* Desktop layout: 2-column grid */}
        <div className="hidden lg:grid lg:grid-cols-12 lg:gap-10">
          {/* Left column */}
          <div className="lg:col-span-6">
            <div className="space-y-8">
              <JoinHero
                headline={resolvedContent.headline}
                subheadline={resolvedContent.subheadline}
                trustLine={content.trustLine}
              />
              <JoinBenefits benefits={parsedBenefits} />
              {resolvedContent.extraText && (
                <div className="rounded-xl p-4" style={{
                  backgroundColor: THEME.bg.card,
                  border: `1px solid ${THEME.border.default}`,
                }}>
                  <p className="text-sm" style={{ color: THEME.text.secondary }}>
                    {resolvedContent.extraText}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Right column */}
          <div className="lg:col-span-6">
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
            />
          </div>
        </div>
      </main>

      <footer className="border-t py-8" style={{ borderColor: THEME.border.subtle }}>
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <JoinFooter landingUrl={LANDING_PAGE_URL} />
        </div>
      </footer>
    </JoinShell>
  );
}
