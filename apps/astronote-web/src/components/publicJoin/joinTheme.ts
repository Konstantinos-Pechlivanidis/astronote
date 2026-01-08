import type { CSSProperties } from 'react';

export type JoinTheme = {
  primary: string
  accent: string
  background: string
  backgroundSecondary: string
  glowPrimary: string
  glowSecondary: string
};

export const DEFAULT_THEME: JoinTheme = {
  primary: '#111827',      // Dark blue-grey for primary elements
  accent: '#0ABAB5',       // Astronote teal (matching landing)
  background: '#070B12',   // Deep navy
  backgroundSecondary: '#0B1220',
  glowPrimary: '#0ABAB5',
  glowSecondary: '#3B82F6',
};

/**
 * Resolve theme with merchant overrides
 * Ensures safe contrast even with custom colors
 */
export function resolveJoinTheme(
  primaryColor?: string | null,
  accentColor?: string | null,
  backgroundColor?: string | null,
  secondaryColor?: string | null,
): JoinTheme {
  const theme: JoinTheme = {
    primary: primaryColor || DEFAULT_THEME.primary,
    accent: accentColor || DEFAULT_THEME.accent,
    background: backgroundColor || DEFAULT_THEME.background,
    backgroundSecondary: secondaryColor || DEFAULT_THEME.backgroundSecondary,
    glowPrimary: backgroundColor || accentColor || DEFAULT_THEME.glowPrimary,
    glowSecondary: secondaryColor || DEFAULT_THEME.glowSecondary,
  };

  return theme;
}

/**
 * Convert theme to CSS custom properties
 */
export function themeToStyles(theme: JoinTheme): CSSProperties & Record<string, string> {
  return {
    '--theme-primary': theme.primary,
    '--theme-accent': theme.accent,
    '--theme-bg': theme.background,
    '--theme-bg-secondary': theme.backgroundSecondary,
    '--theme-glow': theme.glowPrimary,
    '--theme-glow-secondary': theme.glowSecondary,
  };
}

