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

type FrameStyle = React.CSSProperties & Record<`--${string}`, string | number>;

/**
 * Premium Realistic iPhone 17-ish Frame Component
 * Realistic titanium frame with glass reflections, Dynamic Island, and proper safe areas
 */
export function IPhoneFrame({
  children,
  size = 'md',
  className,
  theme = 'retail',
  deviceLabel,
  showStatusBar = true,
}: IPhoneFrameProps) {
  // Theme token maps (light mode only, using retail tokens)
  const themeTokens = {
    retail: {
      '--screen-bg': 'var(--color-background)',
      '--screen-border': 'var(--color-border)',
      '--status-bar-bg': 'var(--color-background)',
      '--status-bar-text': 'var(--color-text-primary)',
      '--island-bg': 'var(--color-text-primary)',
      '--island-border': 'rgba(255, 255, 255, 0.25)',
      '--home-indicator-bg': 'transparent',
      '--home-indicator-color': 'var(--color-text-tertiary)',
    },
    shopify: {
      '--screen-bg': 'var(--color-background)',
      '--screen-border': 'var(--color-border)',
      '--status-bar-bg': 'var(--color-background)',
      '--status-bar-text': 'var(--color-text-primary)',
      '--island-bg': 'var(--color-text-primary)',
      '--island-border': 'rgba(255, 255, 255, 0.25)',
      '--home-indicator-bg': 'transparent',
      '--home-indicator-color': 'var(--color-text-tertiary)',
    },
  };

  const tokens = themeTokens[theme] as Record<`--${string}`, string>;

  // Size variants with scaled radii for realistic proportions
  const sizeConfig = {
    sm: {
      maxWidth: '240px',
      outerRadius: '2.25rem', // 36px
      innerRadius: '1.875rem', // 30px
      padding: '5px',
      islandWidth: '20px',
      islandHeight: '5px',
    },
    md: {
      maxWidth: '280px',
      outerRadius: '2.5rem', // 40px
      innerRadius: '2rem', // 32px
      padding: '6px',
      islandWidth: '24px',
      islandHeight: '6px',
    },
    lg: {
      maxWidth: '320px',
      outerRadius: '2.75rem', // 44px
      innerRadius: '2.25rem', // 36px
      padding: '7px',
      islandWidth: '28px',
      islandHeight: '7px',
    },
  };

  const config = sizeConfig[size];

  const safeAreaValues = {
    sm: { top: '24px', bottom: '18px' },
    md: { top: '28px', bottom: '22px' },
    lg: { top: '32px', bottom: '24px' },
  }[size];

  const frameStyle: FrameStyle = {
    ...tokens,
    aspectRatio: '9 / 19.5',
    '--safe-top': safeAreaValues.top,
    '--safe-bottom': safeAreaValues.bottom,
  };

  // Titanium frame gradient (multi-stop for realistic metal shimmer)
  const titaniumGradient = `
    linear-gradient(145deg, 
      #d4d8dd 0%,
      #e8ebef 15%,
      #f0f2f5 30%,
      #e5e7eb 50%,
      #d9dce0 70%,
      #e8ebef 85%,
      #f5f7fa 100%
    )
  `;

  return (
    <div
      className={cn('relative mx-auto w-full min-w-0', className)}
      style={{
        ...frameStyle,
        maxWidth: config.maxWidth,
      }}
      aria-label={deviceLabel || 'iPhone frame'}
    >
      {/* Outer Device Container - Titanium Frame */}
      <div
        className="relative h-full w-full shadow-2xl"
        style={{
          borderRadius: config.outerRadius,
          padding: config.padding,
          background: titaniumGradient,
          boxShadow: `
            0 20px 50px rgba(15, 23, 42, 0.2),
            0 0 0 0.5px rgba(255, 255, 255, 0.4) inset,
            0 0 0 1px rgba(0, 0, 0, 0.05) inset
          `,
          position: 'relative',
        }}
      >
        {/* Metal Grain / Shimmer Effect */}
        <div
          className="absolute inset-0 pointer-events-none rounded-[inherit] opacity-30"
          style={{
            backgroundImage: `
              repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255, 255, 255, 0.1) 2px, rgba(255, 255, 255, 0.1) 4px),
              repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(0, 0, 0, 0.02) 2px, rgba(0, 0, 0, 0.02) 4px)
            `,
            mixBlendMode: 'overlay',
          }}
        />

        {/* Specular Edge Highlights */}
        {/* Top-left highlight */}
        <div
          className="absolute inset-0 pointer-events-none rounded-[inherit]"
          style={{
            background: `
              radial-gradient(ellipse 80% 40% at 20% 20%, rgba(255, 255, 255, 0.6) 0%, transparent 60%),
              linear-gradient(135deg, rgba(255, 255, 255, 0.4) 0%, transparent 40%)
            `,
            mixBlendMode: 'overlay',
          }}
        />
        {/* Bottom-right highlight */}
        <div
          className="absolute inset-0 pointer-events-none rounded-[inherit]"
          style={{
            background: `
              radial-gradient(ellipse 60% 30% at 80% 80%, rgba(255, 255, 255, 0.3) 0%, transparent 70%)
            `,
            mixBlendMode: 'overlay',
          }}
        />

        {/* Inner Bezel Ring (screen gasket) */}
        <div
          className="absolute inset-0 pointer-events-none rounded-[inherit]"
          style={{
            borderRadius: config.outerRadius,
            padding: config.padding,
            boxShadow: `
              inset 0 0 0 0.5px rgba(0, 0, 0, 0.15),
              inset 0 0 0 1px rgba(255, 255, 255, 0.1)
            `,
          }}
        />

        {/* Inner Screen Container */}
        <div
          className="relative w-full overflow-hidden flex flex-col"
          style={{
            borderRadius: config.innerRadius,
            backgroundColor: tokens['--screen-bg'],
            borderColor: tokens['--screen-border'],
            borderWidth: '1px',
            borderStyle: 'solid',
            height: '100%',
            minHeight: 0,
            position: 'relative',
          }}
        >
          {/* Glass Reflection Layer 1: Wide Diagonal Sweep */}
          <div
            className="absolute inset-0 pointer-events-none z-40"
            style={{
              background: `
                linear-gradient(135deg, 
                  rgba(255, 255, 255, 0.15) 0%,
                  transparent 25%,
                  transparent 75%,
                  rgba(255, 255, 255, 0.05) 100%
                )
              `,
              mixBlendMode: 'overlay',
            }}
          />

          {/* Glass Reflection Layer 2: Thin Edge Glint */}
          <div
            className="absolute inset-0 pointer-events-none z-40"
            style={{
              background: `
                linear-gradient(180deg,
                  rgba(255, 255, 255, 0.4) 0%,
                  transparent 8%,
                  transparent 92%,
                  rgba(255, 255, 255, 0.2) 100%
                )
              `,
              mixBlendMode: 'overlay',
            }}
          />

          {/* Subtle Screen Vignette (light, not dark) */}
          <div
            className="absolute inset-0 pointer-events-none z-40"
            style={{
              background: `
                radial-gradient(ellipse 100% 120% at 50% 50%, transparent 40%, rgba(0, 0, 0, 0.02) 100%)
              `,
            }}
          />

          {/* Status Bar */}
          {showStatusBar && (
            <div
              className="pointer-events-none absolute left-0 right-0 top-0 z-30 flex h-8 items-center justify-between px-4 text-[10px] font-semibold"
              style={{
                backgroundColor: `color-mix(in srgb, ${tokens['--status-bar-bg']} 85%, transparent)`,
                backdropFilter: 'blur(20px)',
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

          {/* Dynamic Island - Realistic with gloss and sensor dots */}
          <div
            className="pointer-events-none absolute left-1/2 z-30 -translate-x-1/2 rounded-full"
            style={{
              top: '8px',
              width: config.islandWidth,
              height: config.islandHeight,
              backgroundColor: tokens['--island-bg'],
              border: `0.5px solid ${tokens['--island-border']}`,
              boxShadow: `
                0 2px 8px rgba(0, 0, 0, 0.25),
                0 1px 2px rgba(0, 0, 0, 0.15),
                inset 0 1px 1px rgba(255, 255, 255, 0.1)
              `,
              position: 'relative',
            }}
          >
            {/* Inner Gloss Highlight */}
            <div
              className="absolute inset-0 rounded-full pointer-events-none"
              style={{
                background: `
                  radial-gradient(ellipse 100% 60% at 50% 20%, rgba(255, 255, 255, 0.3) 0%, transparent 60%)
                `,
                mixBlendMode: 'overlay',
              }}
            />
            {/* Sensor Dots */}
            <div
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-0.5"
              style={{
                width: '60%',
                justifyContent: 'center',
              }}
            >
              <div
                className="w-0.5 h-0.5 rounded-full"
                style={{ backgroundColor: 'rgba(255, 255, 255, 0.4)' }}
              />
              <div
                className="w-0.5 h-0.5 rounded-full"
                style={{ backgroundColor: 'rgba(255, 255, 255, 0.3)' }}
              />
            </div>
          </div>

          {/* Screen Content Area */}
          <div
            className="relative z-10 w-full flex-1 min-h-0 flex flex-col"
            style={{
              paddingTop: 'var(--safe-top)',
              paddingBottom: 'var(--safe-bottom)',
            }}
          >
            <div className="relative h-full w-full overflow-hidden flex flex-col min-h-0" style={{ borderRadius: config.innerRadius }}>
              {children}
            </div>
          </div>

          {/* Home Indicator with Safe Area Fade */}
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex items-center justify-center"
            style={{
              height: '40px',
              background: `
                linear-gradient(to top,
                  ${tokens['--home-indicator-bg']} 0%,
                  color-mix(in srgb, ${tokens['--home-indicator-bg']} 80%, transparent) 50%,
                  transparent 100%
                )
              `,
            }}
          >
            <div
              className="h-1 rounded-full"
              style={{
                width: '96px',
                backgroundColor: tokens['--home-indicator-color'],
                opacity: 0.6,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
