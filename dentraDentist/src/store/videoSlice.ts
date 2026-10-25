import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { sessionChanged } from './authSlice';

export type OpenCall = { appointmentId: string; patientName: string };
type VideoState = { call: OpenCall | null; minimized: boolean };
const initialState: VideoState = { call: null, minimized: false };

// Only window metadata belongs in Redux. LiveKit rooms and credentials stay in the media hook.
const videoSlice = createSlice({
  name: 'video',
  initialState,
  reducers: {
    callOpened(state, action: PayloadAction<OpenCall>) {
      if (
        state.call &&
        state.call.appointmentId !== action.payload.appointmentId
      )
        return;
      state.call = action.payload;
      state.minimized = false;
    },
    callMinimized(state) {
      if (state.call) state.minimized = true;
    },
    callExpanded(state) {
      state.minimized = false;
    },
    callClosed: () => initialState,
  },
  extraReducers: builder => {
    builder.addCase(sessionChanged, () => initialState);
  },
});
export const { callOpened, callMinimized, callExpanded, callClosed } =
  videoSlice.actions;
export const videoReducer = videoSlice.reducer;
