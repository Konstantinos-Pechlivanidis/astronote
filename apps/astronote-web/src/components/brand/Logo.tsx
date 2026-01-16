'use client';

import Image from 'next/image';
import { cn } from '@/lib/utils';

type LogoSize = 'sm' | 'md' | 'lg';
type LogoTone = 'light' | 'dark';

const sizePx: Record<LogoSize, number> = {
  sm: 24,
  md: 32,
  lg: 48,
};

export function Logo({
  size = 'md',
  tone = 'light',
  withText = false,
  text = 'Astronote',
  className,
  textClassName,
  imageClassName,
}: {
  size?: LogoSize;
  tone?: LogoTone;
  withText?: boolean;
  text?: string;
  className?: string;
  textClassName?: string;
  imageClassName?: string;
}) {
  const px = sizePx[size];

  return (
    <div className={cn('inline-flex items-center gap-2', className)}>
      <Image
        src="/logo/astronote-logo-1200x1200.png"
        alt="Astronote"
        width={px}
        height={px}
        priority={size === 'lg'}
        className={cn('object-contain', imageClassName)}
      />
      {withText && (
        <span
          className={cn(
            'text-sm font-semibold',
            tone === 'dark' ? 'text-white' : 'text-text-primary',
            textClassName,
          )}
        >
          {text}
        </span>
      )}
    </div>
  );
}

