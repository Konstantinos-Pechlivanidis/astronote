'use client';

import React, { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface IPhoneFrameProps {
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  // Theme tokens (passed from wrapper)
  bezelColor?: string;
  bezelGradient?: string;
  screenBg?: string;
  statusBarBg?: string;
  statusBarText?: string;
  islandBg?: string;
  islandBorder?: string;
  homeIndicatorBg?: string;
  homeIndicatorColor?: string;
}

/**
 * Realistic iPhone Frame Component (Structure Only)
 * Premium product shot style with bezel, dynamic island, screen, and safe areas
 */
export function IPhoneFrame({
  children,
  size = 'md',
  className,
  bezelGradient = 'linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%)',
  screenBg = '#000000',
  statusBarBg = '#000000',
  statusBarText = '#ffffff',
  islandBg = '#000000',
  islandBorder = 'rgba(255, 255, 255, 0.1)',
  homeIndicatorBg = '#000000',
  homeIndicatorColor = 'rgba(255, 255, 255, 0.3)',
}: IPhoneFrameProps) {
  // Size variants
  const sizeClasses = {
    sm: 'w-[260px]',
    md: 'w-[clamp(260px,40vw,420px)]',
    lg: 'w-[clamp(320px,45vw,480px)]',
  };

  return (
    <div className={cn('relative mx-auto', sizeClasses[size], className)} aria-label="iPhone frame">
      {/* Outer Bezel with Gradient + Specular Highlight */}
      <div
        className="relative rounded-[2.5rem] p-[6px] shadow-2xl"
        style={{
          background: bezelGradient,
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.05) inset',
        }}
      >
        {/* Specular edge highlight (subtle) */}
        <div
          className="absolute inset-0 rounded-[2.5rem] pointer-events-none"
          style={{
            background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, transparent 50%)',
            mixBlendMode: 'overlay',
          }}
        />

        {/* Inner Screen Container */}
        <div
          className="relative rounded-[2rem] overflow-hidden"
          style={{
            backgroundColor: screenBg,
            boxShadow: 'inset 0 0 0 1px rgba(0, 0, 0, 0.3), inset 0 2px 8px rgba(0, 0, 0, 0.5)',
          }}
        >
          {/* Status Bar */}
          <div
            className="h-6 flex items-center justify-between px-4 text-[10px] font-medium relative z-10"
            style={{ backgroundColor: statusBarBg, color: statusBarText }}
          >
            <span>9:41</span>
            <div className="flex items-center gap-1">
              {/* Battery indicator */}
              <div className="w-4 h-2 border rounded-sm" style={{ borderColor: statusBarText }}>
                <div className="h-full rounded-sm" style={{ width: '75%', backgroundColor: statusBarText }} />
              </div>
              {/* Signal indicators */}
              <div className="w-1 h-1 rounded-full" style={{ backgroundColor: statusBarText }} />
              <div className="w-1 h-1 rounded-full" style={{ backgroundColor: statusBarText }} />
            </div>
          </div>

          {/* Dynamic Island (centered, realistic proportions) */}
          <div
            className="absolute top-2 left-1/2 -translate-x-1/2 w-24 h-6 rounded-full z-20 pointer-events-none"
            style={{
              backgroundColor: islandBg,
              border: `1px solid ${islandBorder}`,
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
            }}
          />

          {/* Screen Content Area (scrollable) */}
          <div className="relative z-0">{children}</div>

          {/* Home Indicator (iPhone X+ style) */}
          <div
            className="h-8 flex items-center justify-center relative z-10"
            style={{ backgroundColor: homeIndicatorBg }}
          >
            <div
              className="w-32 h-1 rounded-full"
              style={{ backgroundColor: homeIndicatorColor }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

