import { DEFAULT_HEADLINE_EN, DEFAULT_SUBHEADLINE_EN, DEFAULT_BULLETS_EN } from '../../features/publicJoin/i18n/enV2';
import { DEFAULT_HEADLINE_EL, DEFAULT_SUBHEADLINE_EL, DEFAULT_BULLETS_EL } from '../../features/publicJoin/i18n/elV2';

export type Language = 'en' | 'el';

export interface MerchantBranding {
  headlineEn?: string | null;
  headlineEl?: string | null;
  subheadlineEn?: string | null;
  subheadlineEl?: string | null;
  bulletsEn?: string[] | null;
  bulletsEl?: string[] | null;
  merchantBlurbEn?: string | null;
  merchantBlurbEl?: string | null;
  logoUrl?: string | null;
  websiteUrl?: string | null;
  facebookUrl?: string | null;
  instagramUrl?: string | null;
}

/**
 * Resolves content for the public join page based on:
 * 1. Merchant-provided bilingual content (if available)
 * 2. Astronote defaults (fallback)
 *
 * Architecture: Merchant overrides take precedence, but we always have safe defaults.
 */
export function resolveContent(lang: Language, branding?: MerchantBranding | null) {
  // Headline
  const headline =
    (lang === 'en' ? branding?.headlineEn : branding?.headlineEl) ||
    (lang === 'en' ? DEFAULT_HEADLINE_EN : DEFAULT_HEADLINE_EL);

  // Subheadline
  const subheadline =
    (lang === 'en' ? branding?.subheadlineEn : branding?.subheadlineEl) ||
    (lang === 'en' ? DEFAULT_SUBHEADLINE_EN : DEFAULT_SUBHEADLINE_EL);

  // Benefits (bullets)
  let benefits: string[] = [];
  const merchantBullets = lang === 'en' ? branding?.bulletsEn : branding?.bulletsEl;
  if (merchantBullets && Array.isArray(merchantBullets) && merchantBullets.length > 0) {
    // Use merchant-provided bullets, cleaned
    benefits = merchantBullets
      .map((b) => String(b).trim())
      .filter(Boolean)
      .slice(0, 5); // Max 5 bullets
  } else {
    // Fallback to Astronote defaults
    benefits = lang === 'en' ? DEFAULT_BULLETS_EN : DEFAULT_BULLETS_EL;
  }

  // Extra text box (merchant blurb)
  const extraText = (lang === 'en' ? branding?.merchantBlurbEn : branding?.merchantBlurbEl) || null;

  return {
    headline,
    subheadline,
    benefits,
    extraText,
  };
}

/**
 * Parse benefits bullets into structured format for UI rendering
 * Expected format: "Title — Description" or just "Title"
 */
export function parseBenefits(bullets: string[]) {
  return bullets.map((bullet) => {
    const parts = bullet.split('—').map((s) => s.trim());
    if (parts.length >= 2) {
      return {
        title: parts[0],
        description: parts.slice(1).join(' — '),
      };
    }
    return {
      title: bullet,
      description: '',
    };
  });
}

