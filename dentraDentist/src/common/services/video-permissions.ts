import { PermissionsAndroid, Platform } from 'react-native';

export type MediaOptions = { camera: boolean; microphone: boolean };
export class MicrophonePermissionError extends Error {
  constructor() {
    super(
      'Allow microphone access to speak with the patient, or turn the microphone off to join muted.',
    );
  }
}

export async function requestVideoPermissions(
  options: MediaOptions,
): Promise<MediaOptions> {
  let cameraAllowed = !options.camera;
  let microphoneAllowed = !options.microphone;

  if (Platform.OS === 'android') {
    const needed = [
      ...(options.camera ? [PermissionsAndroid.PERMISSIONS.CAMERA] : []),
      ...(options.microphone
        ? [PermissionsAndroid.PERMISSIONS.RECORD_AUDIO]
        : []),
    ];
    if (needed.length) {
      const result = await PermissionsAndroid.requestMultiple(needed);
      cameraAllowed =
        !options.camera ||
        result[PermissionsAndroid.PERMISSIONS.CAMERA] ===
          PermissionsAndroid.RESULTS.GRANTED;
      microphoneAllowed =
        !options.microphone ||
        result[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] ===
          PermissionsAndroid.RESULTS.GRANTED;
    }
  } else if (Platform.OS === 'ios') {
    const { requestPermission } =
      require('@dentra/video') as typeof import('@dentra/video');
    if (options.microphone)
      microphoneAllowed = await requestPermission('microphone');
    if (options.camera) cameraAllowed = await requestPermission('camera');
  } else {
    throw new Error('Video consultations are supported on Android and iOS.');
  }

  if (!microphoneAllowed) throw new MicrophonePermissionError();
  return {
    microphone: options.microphone,
    camera: options.camera && cameraAllowed,
  };
}
