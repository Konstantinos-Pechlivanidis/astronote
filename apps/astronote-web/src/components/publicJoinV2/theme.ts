/**
 * Static premium theme for public join page
 * iOS 26 inspired - no dynamic merchant colors
 */

export const THEME = {
  // Backgrounds
  bg: {
    page: '#0A0E14',           // Very dark blue-grey
    elevated: '#141921',        // Slightly lighter for cards
    card: 'rgba(255, 255, 255, 0.06)',  // Glass card
  },

  // Borders
  border: {
    default: 'rgba(255, 255, 255, 0.12)',
    subtle: 'rgba(255, 255, 255, 0.06)',
  },

  // Text
  text: {
    primary: '#FFFFFF',
    secondary: '#CBD5E1',      // slate-300
    tertiary: '#94A3B8',       // slate-400
  },

  // Accent (Astronote teal)
  accent: {
    default: '#0ABAB5',
    hover: '#0BC5C0',
    light: 'rgba(10, 186, 181, 0.15)',
  },

  // Input specific
  input: {
    bg: 'rgba(255, 255, 255, 0.05)',
    border: 'rgba(255, 255, 255, 0.12)',
    text: '#FFFFFF',
    placeholder: '#94A3B8',    // slate-400
  },
} as const;

