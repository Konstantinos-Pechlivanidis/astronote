import type { CSSProperties } from 'react';

export type CleanTheme = {
  accent: string
  accentHover: string
};

export const DEFAULT_CLEAN_THEME: CleanTheme = {
  accent: '#2563eb',      // Clean blue
  accentHover: '#1d4ed8', // Darker blue on hover
};

/**
 * Resolve clean theme with merchant overrides
 * Ensures readable contrast on light backgrounds
 */
export function resolveCleanTheme(
  merchantAccent?: string | null,
  merchantPrimary?: string | null,
): CleanTheme {
  // Use merchant accent if provided, fallback to primary, then default
  const accent = merchantAccent || merchantPrimary || DEFAULT_CLEAN_THEME.accent;

  // Simple darker shade for hover (reduce lightness)
  const accentHover = merchantAccent ? darken(accent, 10) : DEFAULT_CLEAN_THEME.accentHover;

  return {
    accent,
    accentHover,
  };
}

/**
 * Simple color darkening function
 */
function darken(color: string, percent: number): string {
  // Simple hex darkening - reduce RGB values
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    const num = parseInt(hex, 16);
    const r = Math.max(0, ((num >> 16) & 0xff) - (255 * percent) / 100);
    const g = Math.max(0, ((num >> 8) & 0xff) - (255 * percent) / 100);
    const b = Math.max(0, (num & 0xff) - (255 * percent) / 100);
    return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
  }
  return color;
}

/**
 * Convert theme to CSS custom properties
 */
export function themeToStylesClean(theme: CleanTheme): CSSProperties & Record<string, string> {
  return {
    '--accent': theme.accent,
    '--accent-hover': theme.accentHover,
  };
}

