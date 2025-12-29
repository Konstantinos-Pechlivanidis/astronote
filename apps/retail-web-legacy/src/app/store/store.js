import { configureStore } from '@reduxjs/toolkit';
import uiSlice from './uiSlice';

export const store = configureStore({
  reducer: {
    ui: uiSlice,
  },
});

