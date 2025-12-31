import shopifyApi from './axios';
/**
 * Discount Type Definitions
 */
export interface Discount {
  id: string;
  title: string;
  code: string;
  status: string;
  isActive: boolean;
  isExpired: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
  usageLimit?: number | null;
  discountType?: 'percentage' | 'amount' | 'free_shipping' | 'bxgy';
  value?: {
    percentage?: number;
    amount?: {
      amount: number;
      currencyCode: string;
    };
  };
}

export interface DiscountsResponse {
  discounts: Discount[];
  total: number;
}

export interface ValidateDiscountRequest {
  discountId: string;
}

export interface ValidateDiscountResponse {
  discount: Discount;
  isValid: boolean;
  canUse: boolean;
  reason: string | null;
}

/**
 * Discounts API Functions
 */
export const discountsApi = {
  /**
   * Get available discount codes
   */
  list: async (): Promise<DiscountsResponse> => {
    const response = await shopifyApi.get<DiscountsResponse>('/shopify/discounts');
    // Response interceptor already extracts data
    return response as unknown as DiscountsResponse;
  },

  /**
   * Get single discount by ID
   */
  get: async (id: string): Promise<Discount> => {
    const response = await shopifyApi.get<Discount>(`/shopify/discounts/${id}`);
    // Response interceptor already extracts data
    return response as unknown as Discount;
  },

  /**
   * Validate discount code for campaign use
   */
  validate: async (
    data: ValidateDiscountRequest,
  ): Promise<ValidateDiscountResponse> => {
    const response = await shopifyApi.post<ValidateDiscountResponse>(
      '/shopify/discounts/validate',
      data,
    );
    // Response interceptor already extracts data
    return response as unknown as ValidateDiscountResponse;
  },
};

