export const joinCopyV2 = {
  headline: 'Subscribe to get member benefits',
  subheadline: 'Get offers, updates, and member-only perks from this store.',
  trustLine: 'No spam. Unsubscribe anytime.',
  cta: 'Subscribe',
  submitting: 'Subscribing...',
  fields: {
    firstName: 'First name',
    lastName: 'Last name (optional)',
    phoneCountry: '+30',
    phone: 'Mobile number',
    email: 'Email (optional)',
  },
  benefits: [
    {
      icon: 'check' as const,
      title: 'Exclusive discounts',
      description: 'Members get better deals and limited offers.',
    },
    {
      icon: 'zap' as const,
      title: 'Early access',
      description: 'Be first to know about new arrivals.',
    },
    {
      icon: 'bell' as const,
      title: 'Updates that matter',
      description: 'Only important announcements.',
    },
    {
      icon: 'logout' as const,
      title: 'Easy opt-out',
      description: 'Unsubscribe anytime with 1 tap.',
    },
  ],
  successTitle: 'Successfully subscribed ✓',
  successMessage: 'You will now receive member benefits and updates.',
  invalidTitle: 'Link unavailable',
  invalidMessage: 'This subscription link is invalid or has expired.',
  rateLimitTitle: 'Too many attempts',
  rateLimitMessage: 'Please wait a moment and try again.',
  loading: 'Loading...',
  errorMessage: 'Something went wrong. Please try again.',
} as const;

// Default content for merchant override fallbacks
export const DEFAULT_HEADLINE_EN = 'Subscribe to get member benefits';
export const DEFAULT_SUBHEADLINE_EN = 'Get offers, updates, and member-only perks from this store.';
export const DEFAULT_BULLETS_EN = [
  'Exclusive discounts — Members get better deals and limited offers.',
  'Early access — Be first to know about new arrivals.',
  'Updates that matter — Only important announcements.',
  'Easy opt-out — Unsubscribe anytime with 1 tap.',
];

