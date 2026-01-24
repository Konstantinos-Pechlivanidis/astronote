export const queryKeys = {
  // Auth & User
  me: ['me'],
  user: {
    profile: ['user', 'profile'],
  },
  
  // Dashboard
  dashboard: {
    kpis: ['dashboard', 'kpis'],
    balance: ['billing', 'balance'],
    recentCampaigns: ['campaigns', 'recent'],
  },
  
  // Contacts
  contacts: {
    list: (params) => ['contacts', 'list', params],
    detail: (id) => ['contacts', 'detail', id],
  },
  
  // Campaigns
  campaigns: {
    list: (params) => ['campaigns', 'list', params],
    detail: (id) => ['campaigns', 'detail', id],
    status: (id) => ['campaigns', 'status', id],
    stats: (id) => ['campaigns', 'stats', id],
    preview: (id) => ['campaigns', 'preview', id],
    previewAudience: (params) => ['campaigns', 'previewAudience', params],
  },
  
  // Billing
  billing: {
    balance: ['billing', 'balance'],
    wallet: ['billing', 'wallet'], // Alias for balance, but separate key for clarity
    packages: ['billing', 'packages'],
    topupTiers: ['billing', 'topup-tiers'],
    transactions: (params) => ['billing', 'transactions', params],
    purchases: (params) => ['billing', 'purchases', params],
    gate: ['billing', 'gate'], // Derived from balance
  },
  
  // Subscriptions
  subscriptions: {
    current: ['subscriptions', 'current'],
  },
  
  // Automations
  automations: {
    list: ['automations', 'list'],
    detail: (type) => ['automations', 'detail', type],
    stats: (type) => ['automations', 'stats', type],
  },
  
  // Lists (read-only, system-generated)
  lists: {
    system: () => ['lists', 'system'],
    list: (params) => ['lists', 'list', params],
    detail: (id) => ['lists', 'detail', id],
    contacts: (id, params) => ['lists', 'contacts', id, params],
  },
  
  // Templates (system + user templates)
  templates: {
    list: (params) => ['templates', 'list', params],
    detail: (id) => ['templates', 'detail', id],
    stats: (id) => ['templates', 'stats', id],
  },
};
