import shopifyApi from './axios';
import { SHOPIFY_API_BASE_URL } from '../config';
import axios from 'axios';

/**
 * Shopify Auth API
 * Token exchange, verification, and refresh
 */

export interface TokenExchangeResponse {
  token: string;
  store: {
    id: string;
    shopDomain: string;
    credits: number;
    currency: string;
  };
  expiresIn: string;
}

/**
 * Exchange Shopify session token for app JWT token
 * @param sessionToken - Shopify App Bridge session token
 * @returns Token exchange response with JWT and store info
 */
export async function exchangeShopifyToken(
  sessionToken: string,
): Promise<TokenExchangeResponse> {
  const response = await axios.post(
    `${SHOPIFY_API_BASE_URL}/auth/shopify-token`,
    { sessionToken },
    {
      headers: {
        'Content-Type': 'application/json',
      },
    },
  );

  return response.data.data;
}

/**
 * Verify app JWT token validity
 * @returns Store info if token is valid
 */
export async function verifyToken(): Promise<{
  valid: boolean;
  store: {
    id: string;
    shopDomain: string;
    credits: number;
    currency: string;
  };
}> {
  const response = await shopifyApi.get<{
    valid: boolean;
    store: {
      id: string;
      shopDomain: string;
      credits: number;
      currency: string;
    };
  }>('/auth/verify');
  // Response interceptor already extracts data
  return response as any;
}

/**
 * Refresh app JWT token
 * @returns New token and expiry
 */
export async function refreshToken(): Promise<{
  token: string;
  expiresIn: string;
}> {
  const response = await shopifyApi.post<{
    token: string;
    expiresIn: string;
  }>('/auth/refresh');
  // Response interceptor already extracts data
  return response as any;
}

