export const endpoints = {
  // Auth
  auth: {
    register: '/api/auth/register',
    login: '/api/auth/login',
    refresh: '/api/auth/refresh',
    logout: '/api/auth/logout',
  },

  // User
  me: '/api/me',
  user: {
    update: '/api/user',
    changePassword: '/api/user/password',
  },

  // Dashboard
  dashboard: {
    kpis: '/api/dashboard/kpis',
  },

  // Billing
  billing: {
    balance: '/api/billing/balance',
    wallet: '/api/billing/wallet',
    summary: '/api/billing/summary',
    packages: '/api/billing/packages',
    transactions: '/api/billing/transactions',
    purchases: '/api/billing/purchases',
    purchase: '/api/billing/purchase',
    topup: '/api/billing/topup',
    topupCalculate: '/api/billing/topup/calculate',
    invoices: '/api/billing/invoices',
    billingHistory: '/api/billing/billing-history',
    verifyPayment: '/api/billing/verify-payment',
  },

  // Subscriptions
  subscriptions: {
    current: '/api/subscriptions/current',
    subscribe: '/api/subscriptions/subscribe',
    update: '/api/subscriptions/update',
    switch: '/api/subscriptions/switch',
    cancel: '/api/subscriptions/cancel',
    portal: '/api/subscriptions/portal',
    reconcile: '/api/subscriptions/reconcile',
    finalize: '/api/subscriptions/finalize',
  },

  // Campaigns
  campaigns: {
    list: '/api/campaigns',
    detail: (id: number) => `/api/campaigns/${id}`,
    create: '/api/campaigns',
    update: (id: number) => `/api/campaigns/${id}`,
    enqueue: (id: number) => `/api/campaigns/${id}/enqueue`,
    schedule: (id: number) => `/api/campaigns/${id}/schedule`,
    unschedule: (id: number) => `/api/campaigns/${id}/unschedule`,
    status: (id: number) => `/api/campaigns/${id}/status`,
    stats: (id: number) => `/api/campaigns/${id}/stats`,
    preview: (id: number) => `/api/campaigns/${id}/preview`,
    previewAudience: '/api/campaigns/preview-audience',
  },

  // Contacts
  contacts: {
    list: '/api/contacts',
    detail: (id: number) => `/api/contacts/${id}`,
    create: '/api/contacts',
    update: (id: number) => `/api/contacts/${id}`,
    delete: (id: number) => `/api/contacts/${id}`,
    import: '/api/contacts/import',
    importStatus: (jobId: string) => `/api/contacts/import/${jobId}`,
    importTemplate: '/api/contacts/import/template',
  },

  // Lists (system lists for filtering)
  lists: {
    list: '/api/lists',
    detail: (id: number) => `/api/lists/${id}`,
    contacts: (id: number) => `/api/lists/${id}/contacts`,
  },

  // Templates
  templates: {
    list: '/api/templates',
    detail: (id: number) => `/api/templates/${id}`,
    create: '/api/templates',
    update: (id: number) => `/api/templates/${id}`,
    delete: (id: number) => `/api/templates/${id}`,
    render: (id: number) => `/api/templates/${id}/render`,
    stats: (id: number) => `/api/templates/${id}/stats`,
  },

  // Automations
  automations: {
    list: '/api/automations',
    detail: (type: string) => `/api/automations/${type}`,
    update: (type: string) => `/api/automations/${type}`,
    stats: (type: string) => `/api/automations/${type}/stats`,
  },

  nfc: {
    me: '/api/me/nfc',
    rotate: '/api/me/nfc/rotate',
  },

  publicLinks: {
    me: '/api/me/public-links',
    rotate: '/api/me/public-links/rotate',
    joinToken: '/api/retail/join-token',
  },
  branding: '/api/branding',
  joinBranding: '/api/retail/branding',

  // Public (no auth)
  public: {
    // Tracking
    offer: (trackingId: string) => `/tracking/offer/${trackingId}`,
    redeemStatus: (trackingId: string) => `/tracking/redeem/${trackingId}`,
    nfcInfo: (token: string) => `/public/nfc/${token}`,
    nfcSubmit: (token: string) => `/public/nfc/${token}/submit`,
    joinInfo: (token: string) => `/public/join/${token}`,
    joinSubmit: (token: string) => `/public/join/${token}`,
    // Unsubscribe/Resubscribe
    unsubscribeRedirect: (token: string) => `/api/contacts/unsubscribe/${token}`,
    preferences: (pageToken: string) => `/api/contacts/preferences/${pageToken}`,
    unsubscribe: '/api/contacts/unsubscribe',
    resubscribeRedirect: (token: string) => `/api/contacts/resubscribe/${token}`,
    resubscribe: '/api/contacts/resubscribe',
  },
};
