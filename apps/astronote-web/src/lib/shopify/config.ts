/**
 * Shopify API Configuration
 * Environment variables for Shopify app integration
 */

export const SHOPIFY_API_BASE_URL =
  process.env.NEXT_PUBLIC_SHOPIFY_API_BASE_URL ||
  'https://astronote-shopify-backend.onrender.com';

export const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  (typeof window !== 'undefined' ? window.location.origin : 'https://astronote-web.onrender.com');

export const SHOPIFY_API_KEY = process.env.NEXT_PUBLIC_SHOPIFY_API_KEY || '';

