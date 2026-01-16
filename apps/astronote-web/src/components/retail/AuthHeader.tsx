'use client';

import { Logo } from '@/src/components/brand/Logo';

interface AuthHeaderProps {
  title: string;
  subtitle: string;
}

export function AuthHeader({ title, subtitle }: AuthHeaderProps) {
  return (
    <div className="flex flex-col items-center space-y-4 text-center">
      <div className="flex items-center justify-center">
        <Logo size="lg" />
      </div>
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-text-primary sm:text-4xl">
          {title}
        </h1>
        <p className="text-sm text-text-secondary sm:text-base">{subtitle}</p>
      </div>
    </div>
  );
}

