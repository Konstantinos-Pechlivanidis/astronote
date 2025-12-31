'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface RetailPageLayoutProps {
  children: ReactNode;
  className?: string;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '7xl' | 'full';
}

const maxWidthClasses = {
  sm: 'max-w-screen-sm',
  md: 'max-w-screen-md',
  lg: 'max-w-screen-lg',
  xl: 'max-w-screen-xl',
  '2xl': 'max-w-screen-2xl',
  '7xl': 'max-w-7xl',
  full: 'max-w-full',
};

export function RetailPageLayout({
  children,
  className,
  maxWidth = '7xl',
}: RetailPageLayoutProps) {
  return (
    <div
      className={cn(
        'mx-auto w-full px-4 py-6 sm:px-6 lg:px-8 lg:py-8',
        maxWidthClasses[maxWidth],
        className,
      )}
    >
      {children}
    </div>
  );
}

