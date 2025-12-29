import { configureStore } from '@reduxjs/toolkit';
import authReducer from './authSlice';
import uiReducer from './uiSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    ui: uiReducer,
  },
});

// Persist auth tokens to localStorage
store.subscribe(() => {
  const { retailToken, shopifyToken } = store.getState().auth;
  if (retailToken) {
    localStorage.setItem('retail_auth_token', retailToken);
  } else {
    localStorage.removeItem('retail_auth_token');
  }
  if (shopifyToken) {
    localStorage.setItem('shopify_auth_token', shopifyToken);
  } else {
    localStorage.removeItem('shopify_auth_token');
  }
  // Legacy support
  if (shopifyToken) {
    localStorage.setItem('auth_token', shopifyToken);
  }
});

// Load tokens from localStorage on init
const savedRetailToken = localStorage.getItem('retail_auth_token');
if (savedRetailToken) {
  store.dispatch({ type: 'auth/setRetailToken', payload: savedRetailToken });
}

const savedShopifyToken = localStorage.getItem('shopify_auth_token') || localStorage.getItem('auth_token');
if (savedShopifyToken) {
  store.dispatch({ type: 'auth/setShopifyToken', payload: savedShopifyToken });
}

