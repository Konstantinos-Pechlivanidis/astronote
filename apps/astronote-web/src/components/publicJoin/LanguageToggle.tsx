import { cn } from '@/lib/utils';

type Language = 'en' | 'el';

type LanguageToggleProps = {
  value: Language
  onChange: (_lang: Language) => void
  className?: string
};

/**
 * Language toggle pill (EN / EL)
 */
export function LanguageToggle({ value, onChange, className }: LanguageToggleProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 p-1 backdrop-blur-xl',
        className,
      )}
    >
      <button
        type="button"
        onClick={() => onChange('en')}
        aria-pressed={value === 'en'}
        className={cn(
          'rounded-full px-4 py-1.5 text-sm font-medium transition-all',
          value === 'en'
            ? 'bg-white/15 text-white shadow-sm'
            : 'text-white/60 hover:text-white/80',
        )}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => onChange('el')}
        aria-pressed={value === 'el'}
        className={cn(
          'rounded-full px-4 py-1.5 text-sm font-medium transition-all',
          value === 'el'
            ? 'bg-white/15 text-white shadow-sm'
            : 'text-white/60 hover:text-white/80',
        )}
      >
        ΕΛ
      </button>
    </div>
  );
}
