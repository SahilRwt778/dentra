jest.mock('@dentra/video/src/CallChat', () => ({ CallChat: () => null }));
import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import {
  AccessibilityInfo,
  AppState,
  BackHandler,
  DeviceEventEmitter,
  NativeModules,
  Pressable,
  Text,
  PermissionsAndroid,
  Platform,
  StyleSheet,
  View,
  type AppStateStatus,
} from 'react-native';
import { testVideoCredentials } from '../test-utils/video';
import { VideoCallPanel } from '../src/screens/VideoScreen';
import { MovableCallWindow } from '../src/video/MovableCallWindow';
import {
  VideoCallProvider,
  useVideoCall,
} from '../src/video/video-call-provider';
import { Button } from '../src/components/ui';
import type {
  VideoSession,
  VideoStatus,
} from '../src/api/generated/patient-api';

const mockGetToken = jest.fn(),
  mockRefetch = jest.fn(),
  mockAudioStart = jest.fn(),
  mockAudioStop = jest.fn();
let mockBack!: Parameters<typeof BackHandler.addEventListener>[1];
type CameraPublication = { isMuted: boolean; track?: object };
let mockTracks: {
  participant: { identity: string; isLocal: boolean };
  publication: CameraPublication;
}[];
let mockRemotes: { identity: string; cameraPublication?: CameraPublication }[];
const MockVideo = (props: object) => <View {...props} />;
const mockMute = jest.fn(),
  mockCamera = jest.fn();
let mockScope: string | null, mockStatus: VideoStatus, mockError: unknown;
const MockRoom = ({ children, ...props }: React.PropsWithChildren<object>) => (
  <View {...props}>{children}</View>
);
const mockSdk = {
  VideoRoom: MockRoom,
  VideoView: MockVideo,
  requestPermission: jest.fn().mockResolvedValue(true),
  AudioSession: {
    startAudioSession: mockAudioStart,
    stopAudioSession: mockAudioStop,
  },
  useMeeting: () => ({
    connection: 'connected',
    remotePresent: mockRemotes.some(remote => remote.identity === 'dentist'),
    remoteCamera: mockRemotes.some(
      remote => remote.cameraPublication && !remote.cameraPublication.isMuted,
    ),
    remoteCameraTrack: mockTracks.some(
      track =>
        track.participant.identity === 'dentist' &&
        !track.publication.isMuted &&
        track.publication.track,
    )
      ? 2
      : null,
    localCameraTrack: mockTracks.some(track => track.participant.isLocal) ? 1 : null,
    microphone: true,
    camera: true,
    setMicrophoneEnabled: mockMute,
    setCameraEnabled: mockCamera,
    switchCamera: jest.fn().mockResolvedValue(undefined),
  }),
};
jest.mock('../src/video/native-video', () => ({ nativeVideo: () => mockSdk }));
jest.mock('../src/notifications/push-session', () => ({
  currentPushSession: () => (mockScope ? { key: mockScope } : null),
}));
jest.mock('@react-navigation/native', () => ({ usePreventRemove: jest.fn() }));
jest.mock('../src/api/video', () => ({
  useVideoStatusQuery: () => ({
    currentData: mockStatus,
    error: mockError,
    refetch: mockRefetch,
    isLoading: false,
  }),
  joinVideo: (...args: unknown[]) => mockGetToken(...args).unwrap(),
}));
const permissionResult = (
  microphone: 'granted' | 'denied' = 'granted',
  camera: 'granted' | 'denied' = 'granted',
) =>
  ({
    'android.permission.RECORD_AUDIO': microphone,
    'android.permission.CAMERA': camera,
  } as Awaited<ReturnType<typeof PermissionsAndroid.requestMultiple>>);
const props = {
  appointmentId: 'appointment',
  minimized: false,
  onMinimize: jest.fn(),
  onExpand: jest.fn(),
  onClose: jest.fn(),
};
const session = (): VideoSession => ({
  ...testVideoCredentials('patient'),
  roomName: 'opaque-room',
  role: 'patient',
  issuedAt: new Date().toISOString(),
  closesAt: new Date(Date.now() + 600000).toISOString(),
});
let tree: Renderer.ReactTestRenderer;
beforeEach(() => {
  jest.clearAllMocks();
  mockTracks = [];
  mockRemotes = [];
  jest
    .spyOn(BackHandler, 'addEventListener')
    .mockImplementation((_event, handler) => {
      mockBack = handler;
      return { remove: jest.fn() };
    });
  jest
    .spyOn(AccessibilityInfo, 'isScreenReaderEnabled')
    .mockResolvedValue(false);
  mockScope = 'patient:session';
  mockError = undefined;
  mockStatus = {
    available: true,
    canJoin: true,
    reason: 'ready',
    roomName: null,
    opensAt: new Date(Date.now() - 60000).toISOString(),
    closesAt: new Date(Date.now() + 600000).toISOString(),
    serverNow: new Date(Date.now() - 1000).toISOString(),
  };
  Object.defineProperty(Platform, 'OS', {
    configurable: true,
    value: 'android',
  });
  jest
    .spyOn(PermissionsAndroid, 'requestMultiple')
    .mockResolvedValue(permissionResult());
  mockAudioStart.mockResolvedValue(undefined);
  mockAudioStop.mockResolvedValue(undefined);
  mockGetToken.mockImplementation(() => ({
    unwrap: () => Promise.resolve(session()),
  }));
});
afterEach(async () => {
  await act(async () => tree?.unmount());
  jest.restoreAllMocks();
  jest.useRealTimers();
});
async function render() {
  await act(async () => {
    tree = Renderer.create(<VideoCallPanel {...props} />);
  });
}
async function join() {
  await act(async () =>
    tree.root
      .findAllByType(Button)
      .find(button => button.props.title === 'Join video call')!
      .props.onPress(),
  );
}

test('the lobby never requests media permission or tokens before an explicit join and respects the server window', async () => {
  mockStatus = { ...mockStatus, canJoin: false, reason: 'too_early' };
  await render();
  expect(tree.root.findByType(Button).props.disabled).toBe(true);
  expect(PermissionsAndroid.requestMultiple).not.toHaveBeenCalled();
  expect(mockGetToken).not.toHaveBeenCalled();
});
test('microphone denial leaves the user in the lobby with a settings action and no call token', async () => {
  jest
    .mocked(PermissionsAndroid.requestMultiple)
    .mockResolvedValue(permissionResult('denied'));
  await render();
  await join();
  expect(mockGetToken).not.toHaveBeenCalled();
  expect(tree.root.findAllByType(MockRoom)).toHaveLength(0);
  expect(
    tree.root
      .findAllByType(Button)
      .some(button => button.props.title === 'Open device settings'),
  ).toBe(true);
});
test('camera denial can join with audio only; leaving and unmounting release the audio session', async () => {
  jest
    .mocked(PermissionsAndroid.requestMultiple)
    .mockResolvedValue(permissionResult('granted', 'denied'));
  await render();
  await join();
  expect(tree.root.findByType(MockRoom).props.video).toBe(false);
  expect(tree.root.findByType(MockRoom).props.audio).toBe(true);
  expect(mockAudioStart).toHaveBeenCalledTimes(1);
  expect(mockAudioStop).not.toHaveBeenCalled();
  await act(async () =>
    tree.root.findByProps({ accessibilityLabel: 'Leave call' }).props.onPress(),
  );
  expect(tree.root.findAllByType(MockRoom)).toHaveLength(0);
  expect(mockAudioStop).toHaveBeenCalled();
});
test('an account switch during token acquisition never opens the old patient room', async () => {
  let finish!: (value: VideoSession) => void;
  mockGetToken.mockReturnValue({
    unwrap: () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  });
  await render();
  await join();
  mockScope = 'other-patient:session';
  await act(async () => finish(session()));
  expect(tree.root.findAllByType(MockRoom)).toHaveLength(0);
  expect(mockAudioStart).not.toHaveBeenCalled();
});
test('Home preserves the room and audio; server cancellation still closes the call', async () => {
  let appState!: (value: AppStateStatus) => void;
  jest
    .spyOn(AppState, 'addEventListener')
    .mockImplementation((_event, callback) => {
      appState = callback;
      return { remove: jest.fn() };
    });
  await render();
  await join();
  const room = tree.root.findByType(MockRoom);
  const onError = room.props.onError;
  await act(async () => appState('background'));
  expect(tree.root.findByType(MockRoom)).toBe(room);
  expect(props.onMinimize).not.toHaveBeenCalled();
  expect(mockAudioStop).not.toHaveBeenCalled();
  await act(async () => appState('active'));
  expect(tree.root.findByType(MockRoom).props.onError).toBe(onError);
  expect(mockGetToken).toHaveBeenCalledTimes(1);
  mockStatus = {
    ...mockStatus,
    canJoin: false,
    reason: 'closed',
    serverNow: new Date(Date.now() + 1000).toISOString(),
  };
  await act(async () => tree.update(<VideoCallPanel {...props} />));
  expect(tree.root.findAllByType(MockRoom)).toHaveLength(0);
});

function BrowseApp() {
  const call = useVideoCall();
  const [page, setPage] = React.useState('Appointment');
  return (
    <View>
      <Text>{page}</Text>
      <Pressable
        accessibilityLabel="Open consultation"
        onPress={() => call.open('appointment')}
      />
      <Pressable
        accessibilityLabel="Browse records"
        onPress={() => setPage('Records')}
      />
      <Pressable
        accessibilityLabel="Open other consultation"
        onPress={() => call.open('another-appointment')}
      />
    </View>
  );
}
async function tap(label: string) {
  await act(async () =>
    tree.root.findByProps({ accessibilityLabel: label }).props.onPress(),
  );
}
async function phoneBack() {
  await act(async () => {
    mockBack({ type: 'hardwareBackPress', timeStamp: Date.now() });
  });
}
test('minimizing, browsing, and restoring keep one connected room and audio session', async () => {
  await act(async () => {
    tree = Renderer.create(
      <VideoCallProvider>
        <BrowseApp />
      </VideoCallProvider>,
    );
  });
  await tap('Open consultation');
  await join();
  const room = tree.root.findByType(MockRoom);
  await phoneBack();
  expect(
    tree.root.findAllByProps({ accessibilityLabel: 'Restore full-screen call' })
      .length,
  ).toBeGreaterThan(0);
  await tap('Browse records');
  expect(JSON.stringify(tree.toJSON())).toContain('Records');
  expect(tree.root.findByType(MockRoom)).toBe(room);
  expect(mockGetToken).toHaveBeenCalledTimes(1);
  expect(mockAudioStop).not.toHaveBeenCalled();
  await tap('Restore full-screen call');
  expect(tree.root.findByType(MockRoom)).toBe(room);
  await phoneBack();
  await tap('Leave call');
  expect(tree.root.findAllByType(MockRoom)).toHaveLength(0);
  expect(mockAudioStop).toHaveBeenCalledTimes(1);
  expect(tree.root.findAllByType(VideoCallPanel)).toHaveLength(0);
});

test('system PiP fills its window without app controls and closing it stops media and native service', async () => {
  await act(async () => {
    tree = Renderer.create(
      <VideoCallProvider>
        <BrowseApp />
      </VideoCallProvider>,
    );
  });
  await tap('Open consultation');
  await join();
  const room = tree.root.findByType(MockRoom);
  await phoneBack();
  await act(async () =>
    DeviceEventEmitter.emit('DentraCallBackground', {
      inPictureInPicture: true,
    }),
  );
  expect(tree.root.findByType(MockRoom)).toBe(room);
  expect(tree.root.findByType(MovableCallWindow).props.systemPip).toBe(true);
  expect(tree.root.findAllByProps({ testID: 'call-controls' })).toHaveLength(0);
  expect(tree.root.findAllByProps({ testID: 'call-top-overlay' })).toHaveLength(
    0,
  );
  await act(async () =>
    DeviceEventEmitter.emit('DentraCallBackground', {
      inPictureInPicture: false,
    }),
  );
  expect(tree.root.findByType(MockRoom)).toBe(room);
  expect(tree.root.findByType(MovableCallWindow).props.minimized).toBe(true);
  expect(
    tree.root.findAllByProps({ testID: 'call-controls' }).length,
  ).toBeGreaterThan(0);
  await act(async () =>
    DeviceEventEmitter.emit('DentraCallBackground', {
      inPictureInPicture: true,
    }),
  );
  await act(async () =>
    DeviceEventEmitter.emit('DentraCallBackground', {
      inPictureInPicture: false,
      endedReason: 'pip_closed',
    }),
  );
  expect(tree.root.findAllByType(MockRoom)).toHaveLength(0);
  expect(mockAudioStop).toHaveBeenCalled();
  expect(NativeModules.DentraCallBackground.stop).toHaveBeenCalled();
});

test('old connection callbacks after rejoining cannot end the newer room', async () => {
  await render();
  await join();
  const old = tree.root.findByType(MockRoom).props;
  await tap('Leave call');
  await join();
  const room = tree.root.findByType(MockRoom);
  await act(async () => {
    old.onDisconnected();
    old.onError(new Error('Late callback'));
  });
  expect(tree.root.findByType(MockRoom)).toBe(room);
});

test('iOS configures automatic remote PiP and keeps an overlaid waiting state when the dentist has no video', async () => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
  await render();
  await join();
  expect(
    tree.root.findAllByType(MockVideo).some(view => view.props.pipEnabled),
  ).toBe(true);
  expect(tree.root.findByType(MockVideo).props.children).toBeUndefined();
  expect(
    StyleSheet.flatten(
      tree.root.findByProps({ testID: 'call-waiting-state' }).props.style,
    ).position,
  ).toBe('absolute');
  expect(NativeModules.DentraCallBackground.start).not.toHaveBeenCalled();
});
test('Android back minimizes a full-screen call instead of disconnecting it', async () => {
  let back!: Parameters<typeof BackHandler.addEventListener>[1];
  jest
    .spyOn(BackHandler, 'addEventListener')
    .mockImplementation((_event, handler) => {
      back = handler;
      return { remove: jest.fn() };
    });
  await render();
  await join();
  await act(async () => {
    expect(back({ type: 'hardwareBackPress', timeStamp: Date.now() })).toBe(
      true,
    );
  });
  expect(props.onMinimize).toHaveBeenCalledTimes(1);
  expect(mockAudioStop).not.toHaveBeenCalled();
});
test('server cancellation also tears down a minimized room', async () => {
  await act(async () => {
    tree = Renderer.create(
      <VideoCallProvider>
        <BrowseApp />
      </VideoCallProvider>,
    );
  });
  await tap('Open consultation');
  await join();
  await phoneBack();
  mockStatus = {
    ...mockStatus,
    canJoin: false,
    reason: 'closed',
    serverNow: new Date(Date.now() + 1000).toISOString(),
  };
  await act(async () =>
    tree.update(
      <VideoCallProvider>
        <BrowseApp />
      </VideoCallProvider>,
    ),
  );
  expect(tree.root.findAllByType(MockRoom)).toHaveLength(0);
  expect(mockAudioStop).toHaveBeenCalledTimes(1);
});

test('video fills the call area with overlaid controls and no minimize button', async () => {
  const publication = { isMuted: false, track: {} };
  mockRemotes = [{ identity: 'dentist', cameraPublication: publication }];
  mockTracks = [
    { participant: { identity: 'dentist', isLocal: false }, publication },
    { participant: { identity: 'patient', isLocal: true }, publication },
  ];
  await render();
  await join();
  expect(
    tree.root.findAllByProps({ accessibilityLabel: 'Minimize call' }),
  ).toHaveLength(0);
  expect(tree.root.findAllByType(MockVideo)).toHaveLength(2);
  expect(
    tree.root
      .findAllByType(MockVideo)
      .every(track => track.props.track === 1 || track.props.track === 2),
  ).toBe(true);
  const remote = tree.root
    .findAllByType(MockVideo)
    .find(track => track.props.track === 2)!;
  expect(StyleSheet.flatten(remote.parent!.props.style)).toMatchObject({
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  });
  expect(
    StyleSheet.flatten(
      tree.root.findByProps({ testID: 'call-controls' }).props.style,
    ).position,
  ).toBe('absolute');
  expect(
    StyleSheet.flatten(
      tree.root.findByProps({ testID: 'call-top-overlay' }).props.style,
    ).position,
  ).toBe('absolute');
});
test('controls hide after four seconds; a video tap reveals them without reconnecting the room', async () => {
  jest.useFakeTimers({ doNotFake: ['setImmediate'] });
  await render();
  await join();
  const room = tree.root.findByType(MockRoom);
  await act(async () => {
    jest.advanceTimersByTime(4000);
  });
  expect(tree.root.findAllByProps({ testID: 'call-controls' })).toHaveLength(0);
  expect(tree.root.findAllByProps({ testID: 'call-top-overlay' })).toHaveLength(
    0,
  );
  await tap('Show call controls');
  expect(
    tree.root.findAllByProps({ testID: 'call-controls' }).length,
  ).toBeGreaterThan(0);
  expect(tree.root.findByType(MockRoom)).toBe(room);
  expect(mockGetToken).toHaveBeenCalledTimes(1);
  expect(mockAudioStop).not.toHaveBeenCalled();
  await act(async () => {
    jest.advanceTimersByTime(4000);
  });
  expect(tree.root.findAllByProps({ testID: 'call-controls' })).toHaveLength(0);
  await phoneBack();
  expect(props.onMinimize).toHaveBeenCalledTimes(1);
  expect(mockAudioStop).not.toHaveBeenCalled();
});
test('using a call control restarts the hide timer', async () => {
  jest.useFakeTimers({ doNotFake: ['setImmediate'] });
  mockMute.mockResolvedValue(undefined);
  await render();
  await join();
  await act(async () => {
    jest.advanceTimersByTime(3000);
  });
  await tap('Mute microphone');
  expect(mockMute).toHaveBeenCalledWith(false);
  await act(async () => {
    jest.advanceTimersByTime(3000);
  });
  expect(
    tree.root.findAllByProps({ testID: 'call-controls' }).length,
  ).toBeGreaterThan(0);
  await act(async () => {
    jest.advanceTimersByTime(1000);
  });
  expect(tree.root.findAllByProps({ testID: 'call-controls' })).toHaveLength(0);
});
test('screen-reader users keep their call controls visible', async () => {
  jest.useFakeTimers({ doNotFake: ['setImmediate'] });
  jest.mocked(AccessibilityInfo.isScreenReaderEnabled).mockResolvedValue(true);
  await render();
  await join();
  await act(async () => {
    jest.advanceTimersByTime(10000);
  });
  expect(
    tree.root.findAllByProps({ testID: 'call-controls' }).length,
  ).toBeGreaterThan(0);
});

test('an audio-only dentist is connected with camera off, rather than waiting to join or publish video', async () => {
  mockRemotes = [{ identity: 'dentist' }];
  await render();
  await join();
  expect(JSON.stringify(tree.toJSON())).toContain('Your dentist is here');
  expect(JSON.stringify(tree.toJSON())).toContain('Dentist camera is off');
  expect(JSON.stringify(tree.toJSON())).not.toContain(
    'Waiting for dentist video',
  );
  expect(tree.root.findAllByType(MockVideo)).toHaveLength(0);
});

test('camera publication, incoming video, mute and unpublish update without rejoining the room', async () => {
  let publication: CameraPublication = { isMuted: false };
  mockRemotes = [{ identity: 'dentist', cameraPublication: publication }];
  await render();
  await join();
  const room = tree.root.findByType(MockRoom);
  expect(JSON.stringify(tree.toJSON())).toContain(
    'Dentist connected. Waiting for video…',
  );
  expect(JSON.stringify(tree.toJSON())).not.toContain('Dentist camera is off');
  expect(tree.root.findAllByType(MockVideo)).toHaveLength(0);

  publication = { isMuted: false, track: {} };
  mockRemotes = [{ identity: 'dentist', cameraPublication: publication }];
  mockTracks = [
    { participant: { identity: 'dentist', isLocal: false }, publication },
  ];
  await act(async () => tree.update(<VideoCallPanel {...props} />));
  expect(tree.root.findAllByType(MockVideo)).toHaveLength(1);
  expect(
    tree.root.findAllByProps({ testID: 'call-waiting-state' }),
  ).toHaveLength(0);

  publication = { ...publication, isMuted: true };
  mockRemotes = [{ identity: 'dentist', cameraPublication: publication }];
  mockTracks = [{ ...mockTracks[0], publication }];
  await act(async () => tree.update(<VideoCallPanel {...props} />));
  expect(JSON.stringify(tree.toJSON())).toContain('Dentist camera is off');
  expect(tree.root.findAllByType(MockVideo)).toHaveLength(0);

  mockRemotes = [{ identity: 'dentist' }];
  mockTracks = [];
  await act(async () => tree.update(<VideoCallPanel {...props} />));
  expect(JSON.stringify(tree.toJSON())).toContain('Dentist camera is off');
  expect(tree.root.findByType(MockRoom)).toBe(room);
  expect(mockGetToken).toHaveBeenCalledTimes(1);
});
