import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type JoinGlassCardProps = HTMLAttributes<HTMLDivElement> & {
  hover?: boolean
  light?: boolean
};

export function JoinGlassCard({
  className,
  hover,
  light: _light,
  style,
  ...props
}: JoinGlassCardProps) {
  return (
    <div
      className={cn(
        'rounded-3xl',
        'bg-[rgba(255,255,255,0.06)]',
        'backdrop-blur-xl',
        'border border-white/12',
        hover && 'transition-all duration-300 hover:bg-[rgba(255,255,255,0.08)]',
        className,
      )}
      style={{
        boxShadow: '0 18px 45px -30px rgba(0, 0, 0, 0.55)',
        ...style,
      }}
      {...props}
    />
  );
}
