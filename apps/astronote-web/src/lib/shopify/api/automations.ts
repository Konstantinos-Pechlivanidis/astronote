import shopifyApi from './axios';
/**
 * Automation Type Definitions
 */
export type AutomationTrigger =
  | 'welcome'
  | 'abandoned_cart'
  | 'order_confirmation'
  | 'shipping_update'
  | 'delivery_confirmation'
  | 'review_request'
  | 'reorder_reminder'
  | 'birthday'
  | 'customer_inactive'
  | 'cart_abandoned'
  | 'order_placed'
  | 'order_fulfilled'
  | 'cross_sell'
  | 'upsell';

export type AutomationStatus = 'draft' | 'active' | 'paused';

export interface Automation {
  id: string;
  automationId: string;
  name: string;
  description?: string;
  trigger: AutomationTrigger;
  message: string;
  status: AutomationStatus;
  isSystemDefault: boolean;
  createdAt: string;
  updatedAt: string;
  // Backend fields (for compatibility)
  title?: string;
  triggerEvent?: AutomationTrigger;
  userMessage?: string;
  isActive?: boolean;
}

export interface AutomationStats {
  total: number;
  active: number;
  paused: number;
  messagesSent?: number;
  successRate?: number;
}

export interface AutomationVariable {
  name: string;
  description: string;
  example: string;
}

export interface AutomationVariablesResponse {
  variables: AutomationVariable[];
}

export interface CreateAutomationRequest {
  name: string;
  trigger: AutomationTrigger;
  message: string;
  status?: AutomationStatus;
  triggerConditions?: Record<string, any>;
}

export interface UpdateAutomationRequest {
  message?: string;
  status?: AutomationStatus;
  userMessage?: string;
  isActive?: boolean;
}

/**
 * Automations API Functions
 */
export const automationsApi = {
  /**
   * List all automations for the current shop
   */
  list: async (): Promise<Automation[]> => {
    const response = await shopifyApi.get<Automation[]>('/automations');
    // Response interceptor already extracts data
    return response as unknown as Automation[];
  },

  /**
   * Get automation statistics
   */
  getStats: async (): Promise<AutomationStats> => {
    const response = await shopifyApi.get<AutomationStats>('/automations/stats');
    // Response interceptor already extracts data
    return response as unknown as AutomationStats;
  },

  /**
   * Create new automation
   */
  create: async (data: CreateAutomationRequest): Promise<Automation> => {
    const response = await shopifyApi.post<Automation>('/automations', data);
    // Response interceptor already extracts data
    return response as unknown as Automation;
  },

  /**
   * Update automation
   */
  update: async (id: string, data: UpdateAutomationRequest): Promise<Automation> => {
    const response = await shopifyApi.put<Automation>(`/automations/${id}`, data);
    // Response interceptor already extracts data
    return response as unknown as Automation;
  },

  /**
   * Delete automation
   */
  delete: async (id: string): Promise<void> => {
    await shopifyApi.delete(`/automations/${id}`);
  },

  /**
   * Get available variables for a trigger type
   */
  getVariables: async (triggerType: AutomationTrigger): Promise<AutomationVariablesResponse> => {
    const response = await shopifyApi.get<AutomationVariablesResponse>(
      `/automations/variables/${triggerType}`,
    );
    // Response interceptor already extracts data
    return response as unknown as AutomationVariablesResponse;
  },
};

