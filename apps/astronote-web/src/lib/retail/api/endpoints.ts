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
    packages: '/api/billing/packages',
    transactions: '/api/billing/transactions',
    purchases: '/api/billing/purchases',
    purchase: '/api/billing/purchase',
    topup: '/api/billing/topup',
  },

  // Subscriptions
  subscriptions: {
    current: '/api/subscriptions/current',
    subscribe: '/api/subscriptions/subscribe',
    update: '/api/subscriptions/update',
    cancel: '/api/subscriptions/cancel',
    portal: '/api/subscriptions/portal',
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

  // Public (no auth)
  public: {
    // Tracking
    offer: (trackingId: string) => `/tracking/offer/${trackingId}`,
    redeemStatus: (trackingId: string) => `/tracking/redeem/${trackingId}`,
    // Unsubscribe/Resubscribe
    unsubscribeRedirect: (token: string) => `/api/contacts/unsubscribe/${token}`,
    preferences: (pageToken: string) => `/api/contacts/preferences/${pageToken}`,
    unsubscribe: '/api/contacts/unsubscribe',
    resubscribeRedirect: (token: string) => `/api/contacts/resubscribe/${token}`,
    resubscribe: '/api/contacts/resubscribe',
  },
};

