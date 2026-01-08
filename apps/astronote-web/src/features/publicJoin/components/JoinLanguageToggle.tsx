import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type JoinLanguageToggleProps = Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> & {
  value: 'en' | 'el'
  onValueChange: (_value: 'en' | 'el') => void
};

export function JoinLanguageToggle({
  value,
  onValueChange,
  className,
  style,
  ...props
}: JoinLanguageToggleProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-1 py-1 text-sm',
        'bg-[rgba(255,255,255,0.06)] backdrop-blur-xl border border-white/12',
        className,
      )}
      style={{
        boxShadow: '0 12px 32px -24px rgba(0, 0, 0, 0.6)',
        ...style,
      }}
      {...props}
    >
      <button
        type="button"
        onClick={() => onValueChange('en')}
        aria-pressed={value === 'en'}
        className={cn(
          'px-3 py-1.5 rounded-full transition font-medium',
          value === 'en'
            ? 'bg-white/15 text-white shadow-sm'
            : 'text-white/70 hover:text-white',
        )}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => onValueChange('el')}
        aria-pressed={value === 'el'}
        className={cn(
          'px-3 py-1.5 rounded-full transition font-medium',
          value === 'el'
            ? 'bg-white/15 text-white shadow-sm'
            : 'text-white/70 hover:text-white',
        )}
      >
        ΕΛ
      </button>
    </div>
  );
}
