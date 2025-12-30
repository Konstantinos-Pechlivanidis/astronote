import { createSlice } from '@reduxjs/toolkit';

const uiSlice = createSlice({
  name: 'ui',
  initialState: {
    sidebarCollapsed: false,
    mobileDrawerOpen: false,
  },
  reducers: {
    toggleSidebar: (state) => {
      state.sidebarCollapsed = !state.sidebarCollapsed;
    },
    setSidebarCollapsed: (state, action) => {
      state.sidebarCollapsed = action.payload;
    },
    toggleMobileDrawer: (state) => {
      state.mobileDrawerOpen = !state.mobileDrawerOpen;
    },
    closeMobileDrawer: (state) => {
      state.mobileDrawerOpen = false;
    },
  },
});

export const { toggleSidebar, setSidebarCollapsed, toggleMobileDrawer, closeMobileDrawer } = uiSlice.actions;
export default uiSlice.reducer;

