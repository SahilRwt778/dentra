import React, { useCallback, useEffect } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { VideoCallPanel } from './VideoCallPanel';
import { MovableCallWindow } from './MovableCallWindow';
import { useSystemPictureInPicture } from '../../common/services/background-call';

import { useAppDispatch, useAppSelector, useAppStore } from '../../store/hooks';
import {
  callOpened,
  callMinimized,
  callExpanded,
  callClosed,
  type OpenCall,
} from '../../store/videoSlice';

// Hosting the room above navigation lets Back keep the same call connected.
export function VideoCallProvider({ children }: { children: React.ReactNode }) {
  const { call, minimized } = useAppSelector(state => state.video);
  const dispatch = useAppDispatch();
  const systemPip = useSystemPictureInPicture();
  const minimize = useCallback(() => {
    dispatch(callMinimized());
  }, [dispatch]);
  const expand = useCallback(() => {
    dispatch(callExpanded());
  }, [dispatch]);
  const close = useCallback(() => {
    dispatch(callClosed());
  }, [dispatch]);
  useEffect(
    () => () => {
      dispatch(callClosed());
    },
    [dispatch],
  );

  return (
    <View style={styles.root}>
      <View
        style={styles.root}
        accessibilityElementsHidden={!!call && !minimized}
        importantForAccessibility={
          call && !minimized ? 'no-hide-descendants' : 'auto'
        }
      >
        {children}
      </View>
      {call && (
        <MovableCallWindow
          key={call.appointmentId}
          minimized={minimized}
          systemPip={systemPip}
        >
          <VideoCallPanel
            key={call.appointmentId}
            {...call}
            minimized={minimized}
            systemPip={systemPip}
            minimize={minimize}
            expand={expand}
            close={close}
          />
        </MovableCallWindow>
      )}
    </View>
  );
}
export function useVideoCall() {
  const appStore = useAppStore();
  const appointmentId = useAppSelector(
    state => state.video.call?.appointmentId ?? null,
  );
  const open = useCallback(
    (next: OpenCall) => {
      const current = appStore.getState().video.call;
      if (current && current.appointmentId !== next.appointmentId) {
        Alert.alert(
          'A consultation is open',
          'Leave your current consultation before opening another appointment.',
        );
        appStore.dispatch(callExpanded());
        return;
      }
      appStore.dispatch(callOpened(next));
    },
    [appStore],
  );
  return { open, appointmentId };
}
const styles = StyleSheet.create({
  root: { flex: 1 },
});
