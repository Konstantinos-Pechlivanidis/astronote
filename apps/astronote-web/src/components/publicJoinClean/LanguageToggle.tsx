import { cn } from '@/lib/utils';

type Language = 'en' | 'el';

type LanguageToggleProps = {
  value: Language
  onChange: (_lang: Language) => void
  className?: string
};

/**
 * Simple language toggle
 */
export function LanguageToggle({ value, onChange, className }: LanguageToggleProps) {
  return (
    <div className={cn('inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-sm', className)}>
      <button
        type="button"
        onClick={() => onChange('en')}
        className={cn(
          'rounded-md px-3 py-1 text-sm font-medium transition-all',
          value === 'en'
            ? 'bg-slate-100 text-slate-900'
            : 'text-slate-600 hover:text-slate-900',
        )}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => onChange('el')}
        className={cn(
          'rounded-md px-3 py-1 text-sm font-medium transition-all',
          value === 'el'
            ? 'bg-slate-100 text-slate-900'
            : 'text-slate-600 hover:text-slate-900',
        )}
      >
        ΕΛ
      </button>
    </div>
  );
}
