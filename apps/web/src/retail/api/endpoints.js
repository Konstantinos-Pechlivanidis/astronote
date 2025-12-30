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
    // topupCalculate removed - endpoint deprecated, use credit packs instead
  },
  
  // Subscriptions
  subscriptions: {
    current: '/api/subscriptions/current',
    subscribe: '/api/subscriptions/subscribe',
    update: '/api/subscriptions/update',
    cancel: '/api/subscriptions/cancel',
    portal: '/api/subscriptions/portal',
  },
  
  // Automations
  automations: {
    list: '/api/automations',
    detail: (type) => `/api/automations/${type}`,
    update: (type) => `/api/automations/${type}`,
    stats: (type) => `/api/automations/${type}/stats`,
  },
  
  // Campaigns
  campaigns: {
    list: '/api/campaigns',
    detail: (id) => `/api/campaigns/${id}`,
    create: '/api/campaigns',
    update: (id) => `/api/campaigns/${id}`,
    enqueue: (id) => `/api/campaigns/${id}/enqueue`,
    schedule: (id) => `/api/campaigns/${id}/schedule`,
    unschedule: (id) => `/api/campaigns/${id}/unschedule`,
    status: (id) => `/api/campaigns/${id}/status`,
    stats: (id) => `/api/campaigns/${id}/stats`,
    preview: (id) => `/api/campaigns/${id}/preview`,
    previewAudience: '/api/campaigns/preview-audience',
  },
  
  // Contacts
  contacts: {
    list: '/api/contacts',
    detail: (id) => `/api/contacts/${id}`,
    create: '/api/contacts',
    update: (id) => `/api/contacts/${id}`,
    delete: (id) => `/api/contacts/${id}`,
    import: '/api/contacts/import',
    importStatus: (jobId) => `/api/contacts/import/${jobId}`,
    importTemplate: '/api/contacts/import/template',
  },
  
  // Lists (read-only, system-generated)
  lists: {
    list: '/api/lists',
    detail: (id) => `/api/lists/${id}`,
    contacts: (id) => `/api/lists/${id}/contacts`,
  },
  
  // Templates (system + user templates)
  templates: {
    list: '/api/templates',
    detail: (id) => `/api/templates/${id}`,
    create: '/api/templates',
    update: (id) => `/api/templates/${id}`,
    delete: (id) => `/api/templates/${id}`,
    render: (id) => `/api/templates/${id}/render`,
    stats: (id) => `/api/templates/${id}/stats`,
  },
  
  // Public (no auth)
  public: {
    // Tracking
    offer: (trackingId) => `/tracking/offer/${trackingId}`,
    redeemStatus: (trackingId) => `/tracking/redeem/${trackingId}`,
    // Unsubscribe/Resubscribe
    unsubscribeRedirect: (token) => `/api/contacts/unsubscribe/${token}`,
    preferences: (pageToken) => `/api/contacts/preferences/${pageToken}`,
    unsubscribe: '/api/contacts/unsubscribe',
    resubscribeRedirect: (token) => `/api/contacts/resubscribe/${token}`,
    resubscribe: '/api/contacts/resubscribe',
    // NFC
    nfcConfig: (publicId) => `/nfc/${publicId}/config`,
    nfcSubmit: (publicId) => `/nfc/${publicId}/submit`,
    // Conversion
    conversionConfig: (tagPublicId) => `/api/conversion/${tagPublicId}`,
    conversionSubmit: (tagPublicId) => `/api/conversion/${tagPublicId}`,
  },
};

