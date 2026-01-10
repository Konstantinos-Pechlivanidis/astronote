import shopifyApi from './axios';
/**
 * Settings Type Definitions
 */
export interface Settings {
  shopId: string;
  shopDomain: string;
  shopName: string;
  credits: number;
  createdAt: string;
  updatedAt: string;
  senderId: string; // senderNumber or senderName
  senderNumber?: string | null;
  senderName?: string | null;
  timezone: string;
  currency: string;
  baseUrl?: string | null; // Per-tenant base URL override (for public links)
  recentTransactions?: Array<{
    id: string;
    creditsAdded: number;
    amount: number;
    currency: string;
    packageType: string;
    status: string;
    createdAt: string;
  }>;
  usageGuide?: {
    title: string;
    sections: Array<{
      title: string;
      content: string;
    }>;
  };
}

export interface AccountInfo {
  shopId: string;
  shopDomain: string;
  shopName: string;
  credits: number;
  createdAt: string;
  updatedAt: string;
  settings: {
    senderId: string;
    timezone: string;
    currency: string;
  };
  usage: {
    totalContacts: number;
    totalCampaigns: number;
    totalAutomations: number;
    totalMessages: number;
  };
}

export interface UpdateSettingsRequest {
  senderId?: string;
  senderNumber?: string;
  senderName?: string;
  timezone?: string;
  currency?: string;
  baseUrl?: string | null; // Optional: Per-tenant base URL override
}

/**
 * Settings API Functions
 */
export const settingsApi = {
  /**
   * Get settings
   */
  getSettings: async (): Promise<Settings> => {
    const response = await shopifyApi.get<Settings>('/settings');
    // Response interceptor already extracts data
    return response as unknown as Settings;
  },

  /**
   * Get account info
   */
  getAccountInfo: async (): Promise<AccountInfo> => {
    const response = await shopifyApi.get<AccountInfo>('/settings/account');
    // Response interceptor already extracts data
    return response as unknown as AccountInfo;
  },

  /**
   * Update settings
   */
  updateSettings: async (data: UpdateSettingsRequest): Promise<Settings> => {
    const response = await shopifyApi.put<Settings>('/settings', data);
    // Response interceptor already extracts data
    return response as unknown as Settings;
  },

  /**
   * Update sender number (legacy endpoint)
   */
  updateSenderNumber: async (senderNumber: string): Promise<{ senderNumber: string; updatedAt: string }> => {
    const response = await shopifyApi.put<{ senderNumber: string; updatedAt: string }>('/settings/sender', {
      senderNumber,
    });
    // Response interceptor already extracts data
    return response as unknown as { senderNumber: string; updatedAt: string };
  },
};

