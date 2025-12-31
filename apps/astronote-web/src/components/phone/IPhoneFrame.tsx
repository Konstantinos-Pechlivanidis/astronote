'use client';

import React, { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface IPhoneFrameProps {
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  theme?: 'retail' | 'shopify';
  deviceLabel?: string;
  showStatusBar?: boolean;
}

/**
 * Premium Realistic iPhone Frame Component
 * Structure only - renders device frame with realistic bezel, dynamic island, and screen
 */
export function IPhoneFrame({
  children,
  size = 'md',
  className,
  theme = 'retail',
  deviceLabel,
  showStatusBar = true,
}: IPhoneFrameProps) {
  // Theme token maps
  const themeTokens = {
    retail: {
      '--phone-bg': 'linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%)',
      '--phone-bezel': '#1a1a1a',
      '--phone-edge': 'rgba(255, 255, 255, 0.1)',
      '--phone-shadow': '0 20px 60px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.05) inset',
      '--screen-bg': '#000000',
      '--screen-border': 'rgba(0, 0, 0, 0.3)',
      '--screen-glass': 'inset 0 0 0 1px rgba(0, 0, 0, 0.3), inset 0 2px 8px rgba(0, 0, 0, 0.5)',
      '--status-bar-bg': '#000000',
      '--status-bar-text': '#ffffff',
      '--island-bg': '#000000',
      '--island-border': 'rgba(255, 255, 255, 0.1)',
      '--home-indicator-bg': '#000000',
      '--home-indicator-color': 'rgba(255, 255, 255, 0.3)',
    },
    shopify: {
      '--phone-bg': 'linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%)',
      '--phone-bezel': '#1a1a1a',
      '--phone-edge': 'rgba(255, 255, 255, 0.1)',
      '--phone-shadow': '0 20px 60px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.05) inset',
      '--screen-bg': '#000000',
      '--screen-border': 'rgba(0, 0, 0, 0.3)',
      '--screen-glass': 'inset 0 0 0 1px rgba(0, 0, 0, 0.3), inset 0 2px 8px rgba(0, 0, 0, 0.5)',
      '--status-bar-bg': '#000000',
      '--status-bar-text': '#ffffff',
      '--island-bg': '#000000',
      '--island-border': 'rgba(255, 255, 255, 0.1)',
      '--home-indicator-bg': '#000000',
      '--home-indicator-color': 'rgba(255, 255, 255, 0.3)',
    },
  };

  const tokens = themeTokens[theme];

  // Size variants
  const sizeClasses = {
    sm: 'w-[260px]',
    md: 'w-[clamp(260px,40vw,420px)]',
    lg: 'w-[clamp(320px,45vw,480px)]',
  };

  return (
    <div
      className={cn('relative mx-auto', sizeClasses[size], className)}
      style={tokens as React.CSSProperties}
      aria-label={deviceLabel || 'iPhone frame'}
    >
      {/* Outer Device Container */}
      <div
        className="relative rounded-[2.5rem] p-[6px] shadow-2xl"
        style={{
          background: tokens['--phone-bg'],
          boxShadow: tokens['--phone-shadow'],
        }}
      >
        {/* Specular Edge Highlight */}
        <div
          className="absolute inset-0 rounded-[2.5rem] pointer-events-none"
          style={{
            background: `linear-gradient(135deg, ${tokens['--phone-edge']} 0%, transparent 50%)`,
            mixBlendMode: 'overlay',
          }}
        />

        {/* Inner Screen Container */}
        <div
          className="relative rounded-[2rem] overflow-hidden"
          style={{
            backgroundColor: tokens['--screen-bg'],
            boxShadow: tokens['--screen-glass'],
          }}
        >
          {/* Status Bar */}
          {showStatusBar && (
            <div
              className="h-6 flex items-center justify-between px-4 text-[10px] font-medium relative z-10"
              style={{
                backgroundColor: tokens['--status-bar-bg'],
                color: tokens['--status-bar-text'],
              }}
            >
              <span>9:41</span>
              <div className="flex items-center gap-1">
                {/* Battery indicator */}
                <div
                  className="w-4 h-2 border rounded-sm"
                  style={{ borderColor: tokens['--status-bar-text'] }}
                >
                  <div
                    className="h-full rounded-sm"
                    style={{ width: '75%', backgroundColor: tokens['--status-bar-text'] }}
                  />
                </div>
                {/* Signal indicators */}
                <div
                  className="w-1 h-1 rounded-full"
                  style={{ backgroundColor: tokens['--status-bar-text'] }}
                />
                <div
                  className="w-1 h-1 rounded-full"
                  style={{ backgroundColor: tokens['--status-bar-text'] }}
                />
              </div>
            </div>
          )}

          {/* Dynamic Island */}
          <div
            className="absolute top-2 left-1/2 -translate-x-1/2 w-24 h-6 rounded-full z-20 pointer-events-none"
            style={{
              backgroundColor: tokens['--island-bg'],
              border: `1px solid ${tokens['--island-border']}`,
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
            }}
          />

          {/* Screen Content Area */}
          <div className="relative z-0">{children}</div>

          {/* Home Indicator (iPhone X+ style) */}
          <div
            className="h-8 flex items-center justify-center relative z-10"
            style={{ backgroundColor: tokens['--home-indicator-bg'] }}
          >
            <div
              className="w-32 h-1 rounded-full"
              style={{ backgroundColor: tokens['--home-indicator-color'] }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

