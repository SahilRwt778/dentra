import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { DentistNotification } from '../common/types/api';
import { sessionChanged } from './authSlice';

type NotificationsState = {
  initialized: boolean;
  seen: Record<string, true>;
  notice: DentistNotification | null;
  bookingVersion: number;
  walletVersion: number;
};
const initialState: NotificationsState = {
  initialized: false,
  seen: {},
  notice: null,
  bookingVersion: 0,
  walletVersion: 0,
};
const notificationsSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    inboxReceived(state, action: PayloadAction<DentistNotification[]>) {
      const fresh = state.initialized
        ? action.payload.filter(item => !state.seen[item.id])
        : [];
      action.payload.forEach(item => {
        state.seen[item.id] = true;
      });
      state.initialized = true;
      if (fresh.length) {
        if (fresh.some(item => item.type === 'appointment_booked'))
          state.bookingVersion++;
        if (fresh.some(item => item.type === 'wallet_withdrawal_updated'))
          state.walletVersion++;
        const unread = fresh.find(item => !item.readAt);
        if (unread) state.notice = unread;
      }
    },
    noticeDismissed(state) {
      state.notice = null;
    },
  },
  extraReducers: builder => {
    builder.addCase(sessionChanged, () => initialState);
  },
});
export const { inboxReceived, noticeDismissed } = notificationsSlice.actions;
export const notificationsReducer = notificationsSlice.reducer;
