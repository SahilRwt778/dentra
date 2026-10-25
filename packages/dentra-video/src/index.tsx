import React, { createContext, useContext, useRef } from 'react';
import {
  findNodeHandle,
  NativeModules,
  PermissionsAndroid,
  Platform,
  StyleSheet,
  View,
  type ViewProps,
} from 'react-native';
import {
  AudioSession,
  registerGlobals,
  VideoTrack,
} from '@livekit/react-native';
import {
  mediaDevices,
  ScreenCapturePickerView,
} from '@livekit/react-native-webrtc';
import { LocalVideoTrack, Track } from 'livekit-client';
import {
  useVideoRoom,
  type VideoCredentials,
  type VideoSource,
} from '@dentra/call-core';

export { AudioSession };
export type { VideoCredentials };
let registered = false;
export function initializeVideo() {
  if (registered) return;
  registerGlobals();
  registered = true;
}
export function isAvailable() {
  return (
    !!NativeModules.WebRTCModule && !!NativeModules.LivekitReactNativeModule
  );
}
export async function requestPermission(name: 'camera' | 'microphone') {
  if (Platform.OS === 'android') {
    const permission =
      name === 'camera'
        ? PermissionsAndroid.PERMISSIONS.CAMERA
        : PermissionsAndroid.PERMISSIONS.RECORD_AUDIO;
    return (
      (await PermissionsAndroid.request(permission)) ===
      PermissionsAndroid.RESULTS.GRANTED
    );
  }
  try {
    const stream = await mediaDevices.getUserMedia({
      audio: name === 'microphone',
      video: name === 'camera',
    });
    stream.getTracks().forEach((track) => track.stop());
    return true;
  } catch {
    return false;
  }
}

type MeetingContext = Omit<ReturnType<typeof useVideoRoom>, 'room'> & {
  setCameraEnabled(enabled: boolean): Promise<void>;
  setMicrophoneEnabled(enabled: boolean): Promise<void>;
  switchCamera(): Promise<void>;
  startScreenShare(): Promise<void>;
  stopScreenShare(): Promise<void>;
};
const Context = createContext<MeetingContext | null>(null);

/** Native rendering and capture controls over the shared LiveKit connection lifecycle. */
export function VideoRoom({
  session,
  audio,
  video,
  children,
  ...callbacks
}: {
  session: VideoCredentials;
  audio: boolean;
  video: boolean;
  children: React.ReactNode;
  onDisconnected(): void;
  onError(): void;
  onMediaDeviceFailure(): void;
  onScreenShareFailure?: (message: string) => void;
}) {
  const { room, ...state } = useVideoRoom(session, audio, video, callbacks);
  const picker =
    useRef<React.ComponentRef<typeof ScreenCapturePickerView>>(null);
  const front = useRef(true);
  function participant() {
    if (!room) throw new Error('Wait until the call is connected.');
    return room.localParticipant;
  }
  return (
    <Context.Provider
      value={{
        ...state,
        setCameraEnabled: async (enabled) => {
          await participant().setCameraEnabled(enabled);
        },
        setMicrophoneEnabled: async (enabled) => {
          await participant().setMicrophoneEnabled(enabled);
        },
        switchCamera: async () => {
          const track = participant().getTrackPublication(
            Track.Source.Camera
          )?.track;
          if (!(track instanceof LocalVideoTrack)) return;
          await track.restartTrack({
            facingMode: front.current ? 'environment' : 'user',
          });
          front.current = !front.current;
        },
        startScreenShare: async () => {
          if (Platform.OS === 'ios') {
            const tag = findNodeHandle(picker.current);
            if (!tag || !NativeModules.ScreenCapturePickerViewManager)
              throw new Error('Rebuild the app to enable screen sharing.');
            await NativeModules.ScreenCapturePickerViewManager.show(tag);
          }
          await participant().setScreenShareEnabled(true, { audio: false });
        },
        stopScreenShare: async () => {
          await participant().setScreenShareEnabled(false);
        },
      }}
    >
      {Platform.OS === 'ios' && (
        <View style={styles.picker}>
          <ScreenCapturePickerView ref={picker} />
        </View>
      )}
      {children}
    </Context.Provider>
  );
}
export function useMeeting() {
  const value = useContext(Context);
  if (!value) throw new Error('VideoRoom is required.');
  return value;
}
export function VideoView({
  track,
  pipEnabled = false,
  mirror = false,
  contain = false,
  style,
}: ViewProps & {
  track: VideoSource | null;
  pipEnabled?: boolean;
  mirror?: boolean;
  contain?: boolean;
}) {
  return (
    <VideoTrack
      trackRef={track ?? undefined}
      style={StyleSheet.flatten(style) ?? undefined}
      mirror={mirror}
      objectFit={contain ? 'contain' : 'cover'}
      zOrder={pipEnabled ? 0 : 1}
      iosPIP={
        pipEnabled
          ? {
              enabled: true,
              startAutomatically: true,
              preferredSize: { width: 9, height: 16 },
            }
          : undefined
      }
    />
  );
}
const styles = StyleSheet.create({
  picker: { position: 'absolute', width: 0, height: 0 },
});
