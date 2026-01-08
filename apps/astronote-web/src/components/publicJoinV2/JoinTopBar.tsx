import { THEME } from './theme';
import { cn } from '@/lib/utils';

type Language = 'en' | 'el';

type JoinTopBarProps = {
  logoUrl?: string | null
  storeName: string
  storeDisplayName?: string
  language: Language
  onLanguageChange: (_lang: Language) => void
  landingUrl?: string
};

/**
 * Top bar: store identity + language toggle + Astronote credit
 */
export function JoinTopBar({
  logoUrl,
  storeName,
  storeDisplayName,
  language,
  onLanguageChange,
  landingUrl = 'https://astronote.app',
}: JoinTopBarProps) {
  return (
    <div className="border-b" style={{ borderColor: THEME.border.subtle }}>
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between py-4 sm:py-5">
          {/* Store identity */}
          <div className="flex items-center gap-3">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={storeDisplayName || storeName}
                className="h-8 w-auto object-contain sm:h-10"
              />
            ) : (
              <div className="text-lg font-semibold sm:text-xl" style={{ color: THEME.text.primary }}>
                {storeDisplayName || storeName}
              </div>
            )}
          </div>

          {/* Right side: Language + Credit */}
          <div className="flex items-center gap-4">
            {/* Language toggle */}
            <div
              className="inline-flex rounded-lg p-0.5"
              style={{
                backgroundColor: THEME.input.bg,
                border: `1px solid ${THEME.border.default}`,
              }}
            >
              <button
                type="button"
                onClick={() => onLanguageChange('en')}
                className={cn(
                  'px-3 py-1.5 text-sm font-medium rounded-md transition-all',
                  language === 'en'
                    ? 'shadow-sm'
                    : 'hover:bg-white/5',
                )}
                style={{
                  backgroundColor: language === 'en' ? THEME.accent.default : 'transparent',
                  color: language === 'en' ? '#FFFFFF' : THEME.text.tertiary,
                }}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => onLanguageChange('el')}
                className={cn(
                  'px-3 py-1.5 text-sm font-medium rounded-md transition-all',
                  language === 'el'
                    ? 'shadow-sm'
                    : 'hover:bg-white/5',
                )}
                style={{
                  backgroundColor: language === 'el' ? THEME.accent.default : 'transparent',
                  color: language === 'el' ? '#FFFFFF' : THEME.text.tertiary,
                }}
              >
                ΕΛ
              </button>
            </div>

            {/* Astronote credit (desktop only) */}
            <a
              href={landingUrl}
              target="_blank"
              rel="noreferrer"
              className="hidden text-xs transition-colors sm:block"
              style={{ color: THEME.text.tertiary }}
              onMouseEnter={(e) => (e.currentTarget.style.color = THEME.text.secondary)}
              onMouseLeave={(e) => (e.currentTarget.style.color = THEME.text.tertiary)}
            >
              by <span className="font-medium">Astronote</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
