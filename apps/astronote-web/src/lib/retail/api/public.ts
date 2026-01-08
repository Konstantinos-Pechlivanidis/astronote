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

export interface NfcInfoResponse {
  ok: boolean
  storeName?: string
  tagLabel?: string
  phoneDefaultCountry?: string
  gdprConsentVersion?: string
  publicBaseUrl?: string
}

export interface NfcSubmitResponse {
  ok: boolean
  contactId: number
  phone: string
  status: string
}

export interface JoinInfoResponse {
  ok: boolean
  active?: boolean
  storeName?: string
  branding: {
    storeName: string
    storeDisplayName?: string
    logoUrl?: string | null
    ogImageUrl?: string | null
    primaryColor?: string | null
    secondaryColor?: string | null
    backgroundColor?: string | null
    textColor?: string | null
    accentColor?: string | null
    headline?: string | null
    headlineOverride?: string | null
    subheadline?: string | null
    benefits?: string[] | null
    benefitsOverride?: string[] | null
    incentiveText?: string | null
    legalText?: string | null
    privacyUrl?: string | null
    termsUrl?: string | null
    merchantBlurb?: string | null
    extraTextBox?: string | null
    pageTitle?: string | null
    pageDescription?: string | null
    websiteUrl?: string | null
    facebookUrl?: string | null
    instagramUrl?: string | null
    rotateEnabled?: boolean | null
    showPoweredBy?: boolean | null
  }
  defaults: { phoneCountryCode: string }
  publicBase: string
}

export interface JoinSubmitResponse {
  ok: boolean
  status: string
  contactId: number
  phone: string
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

  getNfcInfo: (token: string) =>
    publicClient.get<NfcInfoResponse>(endpoints.public.nfcInfo(token)),

  submitNfc: (token: string, payload: any) =>
    publicClient.post<NfcSubmitResponse>(endpoints.public.nfcSubmit(token), payload),

  getJoinInfo: (token: string) =>
    publicClient.get<JoinInfoResponse>(endpoints.public.joinInfo(token)),

  submitJoin: (token: string, payload: any) =>
    publicClient.post<JoinSubmitResponse>(endpoints.public.joinSubmit(token), payload),
};
