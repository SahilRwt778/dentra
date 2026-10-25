jest.mock('@dentra/video/src/CallChat', () => ({ CallChat: () => null }));
import { createStoreHarness } from '../test-utils/store';
import React, { useEffect } from 'react';
import {
  AccessibilityInfo,
  Alert,
  AppState,
  BackHandler,
  DeviceEventEmitter,
  NativeModules,
  PermissionsAndroid,
  Platform,
  StyleSheet,
  Text,
  View,
  type AppStateStatus,
} from 'react-native';
import Renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { testVideoCredentials } from '../test-utils/video';
import {
  VideoCallProvider,
  useVideoCall,
} from '../src/features/video/VideoCallProvider';
import { VideoCallPanel } from '../src/features/video/VideoCallPanel';
import { MovableCallWindow } from '../src/features/video/MovableCallWindow';
import { CallControl } from '../src/features/video/CallControl';
import { Button } from '../src/components/ui/Button';
import { session } from '../src/features/auth/session';
import { api } from '../src/api/client';
import type {
  Appointment,
  VideoSession,
  VideoStatus,
} from '../src/common/types/api';

const mockAudioStart = jest.fn().mockResolvedValue(undefined);
const mockAudioStop = jest.fn().mockResolvedValue(undefined);
const mockMute = jest.fn().mockResolvedValue(undefined);
const mockCamera = jest.fn().mockResolvedValue(undefined);
const mockRestart = jest.fn().mockResolvedValue(undefined);
const mockRoomMount = jest.fn();
const mockRoomUnmount = jest.fn();
const mockPermission = jest.fn().mockResolvedValue(true);
let mockSdkAvailable = true;
let mockScreenReader = false;
let mockTracks: {
  participant: { identity: string; isLocal: boolean };
  publication: { isMuted: boolean };
}[];
function MockRoom({
  children,
  ...props
}: React.PropsWithChildren<Record<string, unknown>>) {
  useEffect(() => {
    mockRoomMount();
    return () => {
      mockRoomUnmount();
    };
  }, []);
  return <View {...props}>{children}</View>;
}
function MockVideo(props: Record<string, unknown>) {
  return <View {...props} />;
}
const mockSdk = {
  VideoRoom: MockRoom,
  VideoView: MockVideo,
  AudioSession: {
    startAudioSession: mockAudioStart,
    stopAudioSession: mockAudioStop,
  },
  useMeeting: () => ({
    connection: 'connected',
    remotePresent: mockTracks.some(track => !track.participant.isLocal),
    remoteCamera: mockTracks.some(
      track => !track.participant.isLocal && !track.publication.isMuted,
    ),
    remoteCameraTrack: mockTracks.some(
      track => !track.participant.isLocal && !track.publication.isMuted,
    )
      ? 2
      : null,
    localCameraTrack: mockTracks.some(track => track.participant.isLocal) ? 1 : null,
    microphone: true,
    camera: true,
    setMicrophoneEnabled: mockMute,
    setCameraEnabled: mockCamera,
    switchCamera: mockRestart,
  }),
};
jest.mock('../src/common/services/native-video', () => ({
  getVideoSdk: () => (mockSdkAvailable ? mockSdk : null),
}));
jest.mock('@dentra/video', () => ({
  requestPermission: (...args: unknown[]) => mockPermission(...args),
}));
let video: ReturnType<typeof useVideoCall>;
function Probe() {
  video = useVideoCall();
  return null;
}
let tree: ReactTestRenderer;
let state: ReturnType<typeof createStoreHarness>;
let back: () => boolean | null | undefined;
let listeners: Set<(state: AppStateStatus) => void>;
let status: VideoStatus;
let appointment: Appointment;
let requests: InternalAxiosRequestConfig[];
let tokenNumber: number;
const platform = Platform.OS;
const stateDescriptor = Object.getOwnPropertyDescriptor(
  AppState,
  'currentState',
);
function reply(config: InternalAxiosRequestConfig, data: unknown, code = 200) {
  return { config, data, status: code, statusText: String(code), headers: {} };
}
function credentials(): VideoSession {
  return {
    ...testVideoCredentials('dentist', ++tokenNumber),
    roomName: 'private-room-one',
    role: 'dentist',
    issuedAt: new Date().toISOString(),
    closesAt: new Date(Date.now() + 600000).toISOString(),
  };
}
function permissionResult(
  camera: 'granted' | 'denied' = 'granted',
  microphone: 'granted' | 'denied' = 'granted',
) {
  return {
    'android.permission.CAMERA': camera,
    'android.permission.RECORD_AUDIO': microphone,
  } as Awaited<ReturnType<typeof PermissionsAndroid.requestMultiple>>;
}

async function flush() {
  for (let n = 0; n < 6; n++)
    await new Promise<void>(resolve => setImmediate(resolve));
}
async function mount() {
  await act(async () => {
    tree = Renderer.create(
      state.wrap(
        <VideoCallProvider>
          <Probe />
          <Text>Appointments remain available</Text>
        </VideoCallProvider>,
      ),
    );
    await flush();
  });
  await act(async () => {
    video.open({ appointmentId: 'visit-one', patientName: 'Patient One' });
    await flush();
  });
}
async function join() {
  await act(async () => {
    tree.root
      .findAllByType(Button)
      .find(button => button.props.title === 'Start and join video call')!
      .props.onPress();
    await flush();
  });
}
async function control(label: string) {
  await act(async () => {
    tree.root
      .findAllByType(CallControl)
      .find(button => button.props.label === label)!
      .props.onPress();
    await flush();
  });
}
function text() {
  return tree.root
    .findAllByType(Text)
    .map(node => node.props.children)
    .flat()
    .join(' ');
}
function rooms() {
  return tree.root.findAllByType(MockRoom);
}
function changeAppState(nextState: AppStateStatus) {
  Object.defineProperty(AppState, 'currentState', {
    configurable: true,
    writable: true,
    value: nextState,
  });
  listeners.forEach(listener => listener(nextState));
}

beforeEach(async () => {
  state = createStoreHarness();
  jest.clearAllMocks();
  mockSdkAvailable = true;
  mockScreenReader = false;
  mockTracks = [];
  tokenNumber = 0;
  requests = [];
  listeners = new Set();
  Object.defineProperty(Platform, 'OS', {
    configurable: true,
    value: 'android',
  });
  Object.defineProperty(AppState, 'currentState', {
    configurable: true,
    writable: true,
    value: 'active',
  });
  jest
    .spyOn(BackHandler, 'addEventListener')
    .mockImplementation((_event, handler) => {
      back = () => handler({} as never);
      return { remove: jest.fn() };
    });
  jest
    .spyOn(AppState, 'addEventListener')
    .mockImplementation((_event, handler) => {
      listeners.add(handler);
      return { remove: () => listeners.delete(handler) };
    });
  jest
    .spyOn(AccessibilityInfo, 'isScreenReaderEnabled')
    .mockImplementation(async () => mockScreenReader);
  jest
    .spyOn(PermissionsAndroid, 'requestMultiple')
    .mockResolvedValue(permissionResult('granted', 'granted'));
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  await session.signIn({
    accessToken: 'doctor-access',
    refreshToken: 'doctor-refresh',
    expiresInSeconds: 900,
  });
  appointment = {
    id: 'visit-one',
    patientId: 'patient-one',
    patientName: 'Patient One',
    patientAge: 30,
    patientGender: 'female',
    type: 'video',
    date: '2026-10-18',
    time: '10:00',
    status: 'booked',
    concern: 'Toothache',
    painScore: 5,
    swelling: false,
  };
  status = {
    available: true,
    canJoin: true,
    reason: 'ready',
    roomName: null,
    opensAt: new Date(Date.now() - 60000).toISOString(),
    closesAt: new Date(Date.now() + 600000).toISOString(),
    serverNow: new Date(Date.now() - 2000).toISOString(),
  };
  api.defaults.adapter = async config => {
    requests.push(config);
    if (config.url?.endsWith('/video')) return reply(config, { ...status });
    if (config.url?.endsWith('/video/token')) {
      const value = credentials();
      status = {
        ...status,
        roomName: value.roomName,
        serverNow: value.issuedAt,
      };
      return reply(config, value);
    }
    if (config.url?.endsWith('/start')) {
      appointment = { ...appointment, status: 'in_consult' };
      return reply(config, appointment);
    }
    return reply(config, { ...appointment });
  };
});
afterEach(async () => {
  if (tree)
    await act(async () => {
      tree.unmount();
      await flush();
    });
  state.cleanup();
  await session.clear();
  jest.restoreAllMocks();
  jest.useRealTimers();
  Object.defineProperty(Platform, 'OS', {
    configurable: true,
    value: platform,
  });
  if (stateDescriptor)
    Object.defineProperty(AppState, 'currentState', stateDescriptor);
});

test('joins the real backend flow, starts the visit and passes short-lived credentials only to the room', async () => {
  await mount();
  await join();
  expect(
    requests.some(request => request.url === '/appointments/visit-one/start'),
  ).toBe(true);
  const tokenRequest = requests.find(
    request => request.url === '/appointments/visit-one/video/token',
  )!;
  expect(JSON.parse(tokenRequest.data)).toEqual({ platform: 'android' });
  expect(tokenRequest.headers.get('Authorization')).toBe(
    'Bearer doctor-access',
  );
  expect(rooms()[0].props).toMatchObject({
    session: {
      provider: 'livekit',
      token: 'synthetic-token-1',
    },
    audio: true,
    video: true,
  });
  expect(mockAudioStart).toHaveBeenCalledTimes(1);
  expect(text()).toContain('Waiting for the patient');
});

test('resumes an in-progress visit without starting it again', async () => {
  appointment.status = 'in_consult';
  await mount();
  await join();
  expect(rooms()).toHaveLength(1);
  expect(requests.some(request => request.url?.endsWith('/start'))).toBe(false);
});

test('does not obtain a token or start an appointment when payment becomes required', async () => {
  await mount();
  status = { ...status, canJoin: false, reason: 'payment_required' };
  await join();
  expect(rooms()).toHaveLength(0);
  expect(
    requests.some(
      request =>
        request.url?.endsWith('/start') || request.url?.endsWith('/token'),
    ),
  ).toBe(false);
  expect(text()).toContain('patient must complete payment');
});

test('microphone denial allows the dentist to choose a muted join', async () => {
  jest
    .mocked(PermissionsAndroid.requestMultiple)
    .mockResolvedValue(permissionResult('granted', 'denied'));
  await mount();
  await join();
  expect(rooms()).toHaveLength(0);
  expect(text()).toContain('Allow microphone access');
  await control('Join with microphone off');
  await join();
  expect(rooms()[0].props.audio).toBe(false);
});

test('camera denial joins audio-only instead of failing the call', async () => {
  jest
    .mocked(PermissionsAndroid.requestMultiple)
    .mockResolvedValue(permissionResult('denied', 'granted'));
  await mount();
  await join();
  expect(rooms()[0].props).toMatchObject({ audio: true, video: false });
  expect(text()).toContain('joined with your camera off');
});

test('iOS media permissions are requested and its back control keeps the room connected', async () => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
  await mount();
  await join();
  expect(mockPermission).toHaveBeenCalledWith('microphone');
  expect(
    tree.root.findAllByType(MockVideo).some(view => view.props.pipEnabled),
  ).toBe(true);
  expect(
    StyleSheet.flatten(
      tree.root.findByProps({ testID: 'video-waiting-state' }).props.style,
    ).position,
  ).toBe('absolute');
  expect(mockPermission).toHaveBeenCalledWith('camera');
  await act(async () => {
    tree.root
      .findAll(
        node =>
          node.props.accessibilityLabel ===
            'Back to appointment, keep call connected' &&
          typeof node.props.onPress === 'function',
      )[0]
      .props.onPress();
    await flush();
  });
  expect(tree.root.findByType(VideoCallPanel).props.minimized).toBe(true);
  expect(mockRoomMount).toHaveBeenCalledTimes(1);
});

test('Android Back minimizes and restoring keeps the same room and token', async () => {
  await mount();
  await join();
  const onError = rooms()[0].props.onError;
  const onDisconnected = rooms()[0].props.onDisconnected;
  await act(async () => {
    expect(back()).toBe(true);
    await flush();
  });
  expect(tree.root.findByType(VideoCallPanel).props.minimized).toBe(true);
  expect(back()).toBe(false);
  await act(async () => {
    tree.root
      .findAll(
        node =>
          node.props.accessibilityLabel === 'Expand call' &&
          typeof node.props.onPress === 'function',
      )[0]
      .props.onPress();
    await flush();
  });
  expect(tree.root.findByType(VideoCallPanel).props.minimized).toBe(false);
  expect(mockRoomMount).toHaveBeenCalledTimes(1);
  expect(rooms()[0].props.session.token).toBe('synthetic-token-1');
  expect(rooms()[0].props.onError).toBe(onError);
  expect(rooms()[0].props.onDisconnected).toBe(onDisconnected);
  expect(
    tree.root
      .findAllByType(CallControl)
      .some(button => button.props.label?.includes('Minimize')),
  ).toBe(false);
});

test('iOS PiP keeps React fallback views outside its native renderer as patient video changes', async () => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
  await mount();
  await join();
  const pipVideo = tree.root
    .findAllByType(MockVideo)
    .find(view => view.props.pipEnabled)!;
  expect(pipVideo.props.pipEnabled).toBe(true);
  expect(pipVideo.props.children).toBeUndefined();
  expect(text()).toContain('Waiting for the patient');

  mockTracks = [
    {
      participant: { identity: 'patient', isLocal: false },
      publication: { isMuted: false },
    },
  ];
  await control('Mute microphone');
  expect(
    tree.root.findAllByType(MockVideo).find(view => view.props.pipEnabled),
  ).toBe(pipVideo);
  expect(pipVideo.props.track).toBe(2);
  expect(pipVideo.props.children).toBeUndefined();

  mockTracks = [{ ...mockTracks[0], publication: { isMuted: true } }];
  await control('Turn camera off');
  expect(
    tree.root.findAllByType(MockVideo).find(view => view.props.pipEnabled),
  ).toBe(pipVideo);
  expect(pipVideo.props.track).toBeNull();
  expect(pipVideo.props.children).toBeUndefined();
  expect(mockRoomMount).toHaveBeenCalledTimes(1);
});

test('leaving a minimized call releases media and does not complete the consultation', async () => {
  await mount();
  await join();
  await act(async () => {
    back();
    await flush();
  });
  await control('Leave call');
  expect(tree.root.findAllByType(VideoCallPanel)).toHaveLength(0);
  expect(mockRoomUnmount).toHaveBeenCalledTimes(1);
  expect(mockAudioStop).toHaveBeenCalled();
  expect(requests.some(request => request.url?.includes('/complete'))).toBe(
    false,
  );
});

test('Home preserves the full video layout for system PiP and returning keeps the same room, audio, token and callbacks', async () => {
  await mount();
  await join();
  const room = rooms()[0];
  const onError = room.props.onError;
  await act(async () => {
    changeAppState('background');
    await flush();
  });
  expect(rooms()[0]).toBe(room);
  expect(tree.root.findByType(VideoCallPanel).props.minimized).toBe(false);
  expect(mockAudioStop).not.toHaveBeenCalled();
  await act(async () => {
    changeAppState('active');
    await flush();
  });
  expect(rooms()[0]).toBe(room);
  expect(rooms()[0].props.onError).toBe(onError);
  expect(mockRoomMount).toHaveBeenCalledTimes(1);
  expect(
    requests.filter(request => request.url?.endsWith('/token')),
  ).toHaveLength(1);
});

test('system PiP shows only the call; closing its system window releases the room and foreground service', async () => {
  await mount();
  await join();
  const room = rooms()[0];
  expect(NativeModules.DentraCallBackground.start).toHaveBeenCalledTimes(1);
  await act(async () => {
    changeAppState('background');
    DeviceEventEmitter.emit('DentraCallBackground', {
      inPictureInPicture: true,
    });
    await flush();
  });
  expect(rooms()[0]).toBe(room);
  expect(tree.root.findByType(MovableCallWindow).props.systemPip).toBe(true);
  expect(
    tree.root.findAllByProps({ testID: 'video-call-controls' }),
  ).toHaveLength(0);
  expect(
    tree.root.findAllByProps({ testID: 'video-top-overlay' }),
  ).toHaveLength(0);
  await act(async () => {
    DeviceEventEmitter.emit('DentraCallBackground', {
      inPictureInPicture: false,
      endedReason: 'pip_closed',
    });
    await flush();
  });
  expect(rooms()).toHaveLength(0);
  expect(NativeModules.DentraCallBackground.stop).toHaveBeenCalled();
  expect(mockAudioStop).toHaveBeenCalled();
});

test('foreground service failure releases audio and does not leave a connected room', async () => {
  NativeModules.DentraCallBackground.start.mockRejectedValueOnce(
    new Error('Background calling unavailable.'),
  );
  await mount();
  await join();
  expect(rooms()).toHaveLength(0);
  expect(mockAudioStop).toHaveBeenCalled();
  expect(NativeModules.DentraCallBackground.stop).toHaveBeenCalled();
  expect(text()).toContain('Background calling unavailable');
});

test('logout while the token request is pending cannot open an old-account room', async () => {
  const normal = api.defaults.adapter as (
    config: InternalAxiosRequestConfig,
  ) => Promise<ReturnType<typeof reply>>;
  let release!: () => void;
  const pending = new Promise<void>(resolve => {
    release = resolve;
  });
  api.defaults.adapter = async config => {
    if (config.url?.endsWith('/token')) await pending;
    return normal(config);
  };
  await mount();
  await join();
  await act(async () => {
    await session.clear();
    release();
    await flush();
  });
  expect(rooms()).toHaveLength(0);
  expect(mockAudioStart).not.toHaveBeenCalled();
});

test('cancellation or rescheduling closes a connected minimized call', async () => {
  jest.useFakeTimers({ doNotFake: ['setImmediate'] });
  await mount();
  await join();
  await act(async () => {
    back();
    await flush();
  });
  status = {
    ...status,
    reason: 'closed',
    canJoin: false,
    serverNow: new Date(Date.now() + 1000).toISOString(),
  };
  await act(async () => {
    await jest.advanceTimersByTimeAsync(5000);
    await flush();
  });
  expect(rooms()).toHaveLength(0);
  expect(text()).toContain('no longer available');
});

test('full-screen controls hide after four seconds and tapping the video reveals them', async () => {
  jest.useFakeTimers({ doNotFake: ['setImmediate'] });
  await mount();
  await join();
  expect(
    tree.root.findAllByProps({ testID: 'video-call-controls' }).length,
  ).toBeGreaterThan(0);
  await act(async () => {
    await jest.advanceTimersByTimeAsync(4000);
    await flush();
  });
  expect(
    tree.root.findAllByProps({ testID: 'video-call-controls' }),
  ).toHaveLength(0);
  await act(async () => {
    tree.root
      .findAll(
        node =>
          node.props.testID === 'video-touch-target' &&
          typeof node.props.onPress === 'function',
      )[0]
      .props.onPress();
    await flush();
  });
  expect(
    tree.root.findAllByProps({ testID: 'video-call-controls' }).length,
  ).toBeGreaterThan(0);
});

test('controls stay visible for screen readers', async () => {
  mockScreenReader = true;
  jest.useFakeTimers({ doNotFake: ['setImmediate'] });
  await mount();
  await join();
  await act(async () => {
    await jest.advanceTimersByTimeAsync(6000);
    await flush();
  });
  expect(
    tree.root.findAllByProps({ testID: 'video-call-controls' }).length,
  ).toBeGreaterThan(0);
});

test('camera switching and mute controls call the active participant', async () => {
  await mount();
  await join();
  await control('Mute microphone');
  await control('Turn camera off');
  await control('Switch camera');
  expect(mockMute).toHaveBeenCalledWith(false);
  expect(mockCamera).toHaveBeenCalledWith(false);
  expect(mockRestart).toHaveBeenCalledTimes(1);
});

test('late callbacks from an older connection do not tear down a rejoined room', async () => {
  await mount();
  await join();
  const oldDisconnected = rooms()[0].props.onDisconnected;
  await control('Leave call');
  await join();
  await act(async () => {
    oldDisconnected();
    await flush();
  });
  expect(rooms()).toHaveLength(1);
  expect(rooms()[0].props.session.token).toBe('synthetic-token-2');
});

test('only one appointment can own the call at a time', async () => {
  await mount();
  await join();
  await act(async () => {
    video.open({ appointmentId: 'visit-two', patientName: 'Patient Two' });
    await flush();
  });
  expect(Alert.alert).toHaveBeenCalled();
  expect(video.appointmentId).toBe('visit-one');
  expect(mockRoomMount).toHaveBeenCalledTimes(1);
});

test('an older native binary displays an update prompt and cannot join', async () => {
  mockSdkAvailable = false;
  await mount();
  expect(text()).toContain('Update Dentra to join video calls');
  expect(
    tree.root
      .findAllByType(Button)
      .find(button => button.props.title === 'Start and join video call')!.props
      .disabled,
  ).toBe(true);
});

test('can join when another dentist device already started the same appointment', async () => {
  const normal = api.defaults.adapter as (
    config: InternalAxiosRequestConfig,
  ) => Promise<ReturnType<typeof reply>>;
  api.defaults.adapter = async config => {
    if (config.url?.endsWith('/start')) {
      appointment = { ...appointment, status: 'in_consult' };
      throw new AxiosError(
        'Already started',
        undefined,
        config,
        undefined,
        reply(config, { message: 'Not ready to start.' }, 409),
      );
    }
    return normal(config);
  };
  await mount();
  await join();
  expect(rooms()).toHaveLength(1);
});

test('backgrounding during the permission prompt cancels the pending join before starting the visit', async () => {
  let allow!: (value: ReturnType<typeof permissionResult>) => void;
  jest.mocked(PermissionsAndroid.requestMultiple).mockReturnValueOnce(
    new Promise(resolve => {
      allow = resolve;
    }),
  );
  await mount();
  await join();
  await act(async () => {
    changeAppState('background');
    allow(permissionResult());
    await flush();
  });
  expect(
    requests.some(
      request =>
        request.url?.endsWith('/start') || request.url?.endsWith('/token'),
    ),
  ).toBe(false);
  expect(mockAudioStart).not.toHaveBeenCalled();
  expect(rooms()).toHaveLength(0);
});
