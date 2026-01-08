const COUNTRY_KEY = 'join_country_code';
const DEFAULT_COUNTRY_CODE = '+30';

export function readStoredCountryCode(fallback = DEFAULT_COUNTRY_CODE) {
  if (typeof window === 'undefined') return fallback;
  const stored = window.localStorage.getItem(COUNTRY_KEY);
  return stored || fallback;
}

export function persistCountryCode(value: string) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(COUNTRY_KEY, value);
}

function normalizeCountryCode(value: string | null | undefined, fallback = DEFAULT_COUNTRY_CODE) {
  const trimmed = (value || '').trim();
  if (!trimmed) return fallback;
  return trimmed.startsWith('+') ? trimmed : `+${trimmed}`;
}

export function normalizePhone({
  countryCode,
  phoneNational,
  fallbackCountryCode = DEFAULT_COUNTRY_CODE,
}: {
  countryCode?: string | null
  phoneNational?: string | null
  fallbackCountryCode?: string
}) {
  return {
    countryCode: normalizeCountryCode(countryCode, fallbackCountryCode),
    phoneNational: (phoneNational || '').trim(),
  };
}
