/**
 * Marketing Copy - Single Source of Truth
 *
 * MESSAGING CHECKLIST:
 *
 * PROMISE: "Get seen fast. Drive action. Capture revenue."
 * - SMS gets read quickly (98% open rate, ~3 min read time)
 * - Right offer + timing converts
 * - System captures opt-ins → automates → tracks → improves ROI
 *
 * MECHANISM:
 * - Capture opt-in → Send revenue message → Track clicks + purchases → Repeat what works
 *
 * CTA:
 * - Primary: "Start earning" / "Connect your store" / "Launch your first campaign"
 * - Secondary: "See how it works" / "View pricing" / "Calculate ROI"
 *
 * COMPLIANCE-SAFE WORDING:
 * - Use "can", "when done right", "typical", "results vary"
 * - No guarantees, no promises of specific results
 * - Cite sources for statistics
 * - Frame as "opportunity" not "guarantee"
 */

export const marketingCopy = {
  hero: {
    // Option 1 (implemented)
    headline: 'Turn texts into revenue.',
    subhead: 'Send the right message at the right moment — and get customers back to checkout.',
    primaryCta: 'Start earning with SMS',
    secondaryCta: 'See how it works',

    // Option 2 (commented)
    // headline: "Stop treating messaging like a cost.",
    // subhead: "Astronote is built to recover abandoned carts, trigger repeat orders, and drive sales — fast.",
    // primaryCta: "Connect your store",
    // secondaryCta: "View pricing",

    // Option 3 (commented)
    // headline: "You don't need more traffic.",
    // subhead: "You need more conversions. SMS gets seen. The offer gets clicked. The sale gets closed.",
    // primaryCta: "Launch your first campaign",

    howYouMakeMoney: [
      'Capture opt-ins from customers who want to hear from you',
      "Send revenue messages when they're most likely to buy",
      'Track what converts and repeat what works',
    ],

    whySmsWorks: {
      title: 'Why SMS works',
      points: [
        'SMS gets read fast — typically within 3 minutes of delivery',
        'High open rates mean your offer reaches the customer',
        'Direct link to checkout removes friction',
        'Timing matters — reach them when intent is highest',
      ],
      note: 'Sources: Twilio (2024), GSMA (2024). Performance varies by campaign design and audience.',
    },
  },

  moneyLoop: {
    title: 'The Money Loop',
    steps: [
      {
        number: 1,
        title: 'Capture opt-in',
        description: 'Get permission from customers who want your offers',
      },
      {
        number: 2,
        title: 'Send revenue message',
        description: 'Deliver the right offer at the right moment',
      },
      {
        number: 3,
        title: 'Track clicks + purchases',
        description: "See what converts and what doesn't",
      },
      {
        number: 4,
        title: 'Repeat what works',
        description: 'Double down on campaigns that drive revenue',
      },
    ],
  },

  objectionKiller: {
    points: [
      'No complex setup',
      'Launch in minutes',
      'Pay monthly or yearly',
      'Cancel anytime',
    ],
  },

  features: {
    title: 'Outcomes, not features',
    subtitle: 'Every tool is built to put revenue in your pocket',
    sections: [
      {
        outcome: 'Recover Revenue',
        whatItDoes: 'Automatically message customers who abandon carts or go inactive.',
        howItMakesMoney: 'Bring high-intent buyers back within minutes while they still want it.',
        useCases: [
          'Abandoned cart recovery',
          'Customer winback campaigns',
        ],
      },
      {
        outcome: 'Increase Repeat Purchases',
        whatItDoes: 'Send post-purchase sequences that drive second and third orders.',
        howItMakesMoney: 'Turn one-time buyers into repeat customers with timely offers.',
        useCases: [
          'Post-purchase upsells',
          'Replenishment reminders',
        ],
      },
      {
        outcome: 'Move Inventory',
        whatItDoes: 'Create flash offers and limited-time promotions for specific products.',
        howItMakesMoney: 'Clear slow-moving stock while maintaining margin through urgency.',
        useCases: [
          'Flash sales',
          'Inventory clearance',
        ],
      },
      {
        outcome: 'Track What Pays',
        whatItDoes: 'See which messages drive clicks, redemptions, and actual purchases.',
        howItMakesMoney: "Stop guessing. Double down on campaigns that convert. Cut what doesn't.",
        useCases: [
          'Click tracking',
          'Redemption tracking',
          'Revenue attribution',
        ],
      },
    ],
  },

  howItWorks: {
    title: 'How It Works',
    subtitle: 'From setup to revenue in days, not weeks',
    steps: [
      {
        title: 'Setup',
        subtitle: 'Connect your store or login',
        description: 'Shopify: one-click connection. Retail: email login. We handle the technical integration.',
        timeToValue: '0-15 minutes',
        details: [
          'Connect Shopify store via OAuth',
          'Or login with email for retail businesses',
          'Automatic customer and order sync',
        ],
      },
      {
        title: 'Consent',
        subtitle: 'Capture opt-ins, ensure compliance',
        description: 'Build your SMS list with proper consent. Required for GDPR, CAN-SPAM, and other regulations.',
        timeToValue: 'Ongoing (first contacts: immediate)',
        details: [
          'Checkout opt-in forms',
          'Website opt-in banners',
          'Consent tracking and proof',
          'Opt-out management',
        ],
      },
      {
        title: 'Build the message',
        subtitle: 'Offer + timing + personalization',
        description: 'Create messages that convert. The right offer at the right time to the right person.',
        timeToValue: '5-10 minutes per campaign',
        details: [
          'Pre-built templates for common use cases',
          'Personalize with customer name, order details',
          'Add discount codes and offers',
          'Set timing and triggers',
        ],
      },
      {
        title: 'Send & automate',
        subtitle: 'Campaigns + sequences',
        description: 'Set it once. Run forever. Automated sequences that work while you sleep.',
        timeToValue: 'Immediate (messages sent within seconds)',
        details: [
          'One-time campaigns',
          'Automated sequences (abandoned cart, winback)',
          'Scheduled sends',
          'Event-based triggers',
        ],
      },
      {
        title: 'Track ROI',
        subtitle: 'Clicks, redemptions, revenue attribution',
        description: 'See which messages drive actual purchases. Not clicks. Revenue.',
        timeToValue: 'Real-time (data available immediately)',
        details: [
          'Click-through tracking',
          'Redemption link tracking',
          'Revenue attribution per campaign',
          'ROI calculations',
        ],
      },
      {
        title: 'Optimize',
        subtitle: 'Repeat winners, cut losers',
        description: "Use data to improve. Double down on what converts. Stop what doesn't.",
        timeToValue: 'Ongoing',
        details: [
          'A/B test messages and offers',
          'Analyze conversion rates',
          'Optimize send times',
          'Refine audience segments',
        ],
      },
    ],
    timeToValue: {
      title: 'Time to Value',
      blocks: [
        {
          time: '0-15 minutes',
          action: 'Connect + import audience',
        },
        {
          time: 'Day 1',
          action: 'First campaign live',
        },
        {
          time: 'Week 1',
          action: 'Repeatable revenue loop',
        },
      ],
      note: 'Timelines are typical. Results vary by business and campaign execution.',
    },
    whatToSend: {
      title: 'What to send',
      subtitle: 'Mini-playbook for revenue messages',
      examples: [
        {
          type: 'Abandoned cart',
          message: 'Reminder + incentive',
          example: '"You left items in your cart. Complete your order and save 10%."',
          whyItWorks: 'High intent. They already wanted it. Incentive removes friction.',
        },
        {
          type: 'Winback',
          message: '"We miss you" + best seller',
          example: "\"We haven't seen you in a while. Here's our best seller — 15% off.\"",
          whyItWorks: 'Re-engages with social proof. Discount creates urgency.',
        },
        {
          type: 'Post-purchase',
          message: 'Upsell / replenishment',
          example: "\"Love your purchase? Here's what pairs perfectly.\" or \"Time to reorder?\"",
          whyItWorks: 'They just bought. Trust is high. Perfect moment for related offer.',
        },
      ],
    },
  },

  pricing: {
    title: 'Simple pricing. Profit-focused.',
    subtitle: 'Your plan is the engine. Credits are the fuel.',
    plans: {
      monthly: {
        name: 'Monthly',
        price: '€40',
        period: '/month',
        credits: 100,
        creditsPeriod: 'per billing cycle',
        tagline: 'Start small. Scale when you see returns.',
        description: 'Perfect for testing SMS revenue recovery. Includes 100 free credits every month.',
      },
      yearly: {
        name: 'Yearly',
        price: '€240',
        period: '/year',
        effectiveMonthly: '€20/month effective',
        credits: 500,
        creditsPeriod: 'per billing cycle',
        tagline: 'Best value. More credits. Lower cost.',
        description: 'Save 50% with annual billing. Includes 500 free credits every year.',
      },
    },
    credits: {
      title: 'Buy extra credits anytime',
      description: 'Need more? Purchase credit packs. Credits never expire. Use them when you need them.',
      note: 'Credit packs available after subscription. See packages in your billing dashboard.',
    },
    mathThatMatters: {
      title: 'Math that matters',
      description: 'If one recovered order covers your month, everything after that is profit.',
      note: 'This is a concept, not a guarantee. Results vary by business, offer, and execution.',
    },
    faq: [
      {
        q: 'Do credits expire?',
        a: 'No. Credits never expire. Use them whenever you need them.',
      },
      {
        q: 'Can I switch between monthly and yearly?',
        a: 'Yes. Change your billing cycle anytime. Changes take effect on your next billing cycle.',
      },
      {
        q: 'What happens if I exceed my free credits?',
        a: 'Buy credit packs to continue sending. Credits are deducted per SMS sent.',
      },
      {
        q: 'When do I get my free credits?',
        a: 'Free credits are allocated at the start of each billing cycle (monthly or yearly, depending on your plan).',
      },
    ],
  },

  roi: {
    title: 'ROI Calculator',
    subtitle: 'ROI is not clicks. ROI is revenue.',
    description: 'See how much revenue you can recover with SMS marketing. This calculator shows real profit, not just costs.',
    bestUseCases: {
      title: 'Best use cases',
      cases: [
        {
          scenario: 'Abandoned cart recovery',
          whyItWorks: 'High intent. They already wanted it. SMS reminder + offer can bring them back.',
          typicalResults: 'Recovery rates typically 15-30% when done right',
        },
        {
          scenario: 'Customer winback',
          whyItWorks: 'Re-engage inactive customers with compelling offers. Lower acquisition cost than new customers.',
          typicalResults: 'Response rates vary by offer value and timing',
        },
        {
          scenario: 'Post-purchase sequences',
          whyItWorks: 'They just bought. Trust is high. Perfect moment for upsells and repeat purchases.',
          typicalResults: 'Conversion rates typically higher than cold outreach',
        },
      ],
    },
    whenSmsWins: {
      title: 'When SMS wins',
      points: [
        'Your customers check their phones frequently',
        'You have products/services that benefit from urgency',
        'You can offer compelling discounts or incentives',
        "You're willing to test and optimize message timing and offers",
      ],
    },
    assumptions: {
      title: 'Calculation assumptions',
      points: [
        'Cart abandonment rate: 70% (industry standard, Baymard Institute 2024)',
        'Messages per campaign: 2 (initial + follow-up)',
        'Recovery rates vary based on message quality, timing, and offer value',
        'Opt-in rates depend on placement, value proposition, and industry',
        'Conversion uplift reflects additional engagement from SMS campaigns',
      ],
    },
    sources: {
      title: 'Sources & benchmarks',
      points: [
        'Cart abandonment rate (70%): Baymard Institute (2024)',
        'Recovery rates (15-30%): Industry benchmarks, varies by campaign design',
        'Opt-in rates (15-25%): Industry benchmarks, varies by placement',
        'SMS performance: 98% open rate, ~3 min read time, 21-35% CTR (Twilio, GSMA, Omnisend 2024-2025)',
      ],
      note: 'Results are estimates based on industry benchmarks. Actual performance depends on your specific use case, audience, message quality, and timing. Always test and optimize.',
    },
  },

  cta: {
    primary: {
      start: 'Start earning',
      connect: 'Connect your store',
      launch: 'Launch your first campaign',
      subscribe: 'Subscribe Monthly',
      subscribeYearly: 'Subscribe Yearly',
    },
    secondary: {
      howItWorks: 'See how it works',
      pricing: 'View pricing',
      calculateRoi: 'Calculate ROI',
      learnMore: 'Learn more',
    },
    billing: {
      buyCredits: 'Add fuel (credits)',
      purchase: 'Purchase',
      manage: 'Manage Subscription',
    },
  },
};

