import axios from 'axios';
import { endpoints } from './endpoints';

const BASE_URL = process.env.NEXT_PUBLIC_RETAIL_API_BASE_URL || 'http://localhost:3001';

// Public API client (no auth required)
const publicClient = axios.create({
  baseURL: BASE_URL,
  withCredentials: false, // Public endpoints don't need cookies
});

export interface PreferencesResponse {
  store?: {
    name: string
  }
  contact?: {
    firstName?: string
    lastNameInitial?: string
  }
}

export interface UnsubscribeRequest {
  pageToken: string
  token?: string
}

export interface UnsubscribeResponse {
  message: string
}

export interface ResubscribeRequest {
  pageToken: string
}

export interface ResubscribeResponse {
  message: string
}

export interface OfferResponse {
  storeName: string
  offerText: string
  isRedeemed: boolean
}

export interface RedeemStatusResponse {
  isRedeemed: boolean
  redeemedAt?: string
  storeName?: string
}

export const publicApi = {
  getPreferences: (pageToken: string) =>
    publicClient.get<PreferencesResponse>(endpoints.public.preferences(pageToken)),

  unsubscribe: (data: UnsubscribeRequest) =>
    publicClient.post<UnsubscribeResponse>(endpoints.public.unsubscribe, data),

  resubscribe: (data: ResubscribeRequest) =>
    publicClient.post<ResubscribeResponse>(endpoints.public.resubscribe, data),

  getOffer: (trackingId: string) =>
    publicClient.get<OfferResponse>(endpoints.public.offer(trackingId)),

  getRedeemStatus: (trackingId: string) =>
    publicClient.get<RedeemStatusResponse>(endpoints.public.redeemStatus(trackingId)),
};

