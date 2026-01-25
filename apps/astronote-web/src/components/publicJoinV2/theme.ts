/**
 * Static premium theme for public join page
 * iOS 26 inspired - no dynamic merchant colors
 */

export const THEME = {
  // Backgrounds
  bg: {
    page: '#0B1120',           // Deep navy
    elevated: '#111A2B',        // Slightly lighter for cards
    card: 'rgba(255, 255, 255, 0.07)',  // Glass card
  },

  // Borders
  border: {
    default: 'rgba(148, 163, 184, 0.2)',
    subtle: 'rgba(148, 163, 184, 0.12)',
  },

  // Text
  text: {
    primary: '#F8FAFC',
    secondary: '#E2E8F0',      // slate-200
    tertiary: '#94A3B8',       // slate-400
  },

  // Accent (Astronote teal)
  accent: {
    default: '#12C6B5',
    hover: '#19D3C1',
    light: 'rgba(18, 198, 181, 0.2)',
  },

  // Input specific
  input: {
    bg: 'rgba(15, 23, 42, 0.65)',
    border: 'rgba(148, 163, 184, 0.2)',
    text: '#F8FAFC',
    placeholder: '#94A3B8',    // slate-400
  },
} as const;
