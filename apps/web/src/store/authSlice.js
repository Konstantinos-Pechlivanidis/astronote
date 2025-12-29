import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  retailToken: null,
  shopifyToken: null,
  shopId: null,
  shopDomain: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setRetailToken: (state, action) => {
      state.retailToken = action.payload;
    },
    clearRetailToken: (state) => {
      state.retailToken = null;
    },
    setShopifyToken: (state, action) => {
      state.shopifyToken = action.payload;
    },
    clearShopifyToken: (state) => {
      state.shopifyToken = null;
      state.shopId = null;
      state.shopDomain = null;
    },
    setShop: (state, action) => {
      state.shopId = action.payload.shopId;
      state.shopDomain = action.payload.shopDomain;
    },
    // Legacy support
    setToken: (state, action) => {
      // Default to shopify for backward compatibility
      state.shopifyToken = action.payload;
    },
    clearToken: (state) => {
      state.shopifyToken = null;
      state.shopId = null;
      state.shopDomain = null;
    },
  },
});

export const { 
  setRetailToken, 
  clearRetailToken, 
  setShopifyToken, 
  clearShopifyToken, 
  setShop,
  setToken, // Legacy
  clearToken, // Legacy
} = authSlice.actions;
export default authSlice.reducer;

