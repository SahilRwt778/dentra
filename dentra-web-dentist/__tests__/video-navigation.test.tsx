vi.mock('../src/components/call-chat', () => ({ CallChat: () => null }));
import React, { useEffect } from 'react';
import Renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, afterEach, expect, test, vi } from 'vitest';
import ConnectedVideoCall from '../src/components/connected-video-call';
import { VideoCallProvider } from '../src/components/video-call-provider';
import { VideoConsultation } from '../src/components/video-consultation';
import { useVideoCall } from '../src/components/video-call-context';

const mocks = vi.hoisted(() => ({
  token: '',
  status: {} as Record<string, unknown>,
  error: undefined as unknown,
  getToken: vi.fn(),
  navigate: vi.fn(),
  toast: vi.fn(),
  mounted: vi.fn(),
  unmounted: vi.fn(),
  portalTargets: [] as unknown[],
  room: undefined as any,
  shareStarted: vi.fn(),
  shareStopped: vi.fn(),
  subscribers: new Set<() => void>(),
}));
vi.mock('react-router-dom', () => ({ useNavigate: () => mocks.navigate }));
vi.mock('sonner', () => ({ toast: { info: mocks.toast } }));
vi.mock('@/store/store', () => ({
  store: {
    getState: () => ({ auth: { accessToken: mocks.token } }),
    subscribe: (listener: () => void) => {
      mocks.subscribers.add(listener);
      return () => mocks.subscribers.delete(listener);
    },
  },
}));
vi.mock('@/api/generated-api', () => ({
  useGetAppointmentsByAppointmentIdVideoQuery: (
    _arg: unknown,
    options: { skip?: boolean }
  ) => ({
    currentData: options.skip ? undefined : mocks.status,
    error: mocks.error,
    refetch: vi.fn(),
  }),
}));
vi.mock('@/api/video-session', () => ({
  joinVideo: (...args: unknown[]) => mocks.getToken(...args).unwrap(),
}));
vi.mock('react-dom', () => ({
  createPortal: (children: React.ReactNode, target: unknown) => {
    mocks.portalTargets.push(target);
    return children;
  },
}));
vi.mock('../src/components/consultation-workspace', () => ({
  ConsultationWorkspace: ({
    call,
    floating,
    onExpand,
  }: {
    call: React.ReactNode;
    floating?: boolean;
    onExpand?: () => void;
  }) => (
    <section data-floating={!!floating}>
      {call}
      <button onClick={onExpand}>Return to consultation</button>
    </section>
  ),
}));
vi.mock('livekit-client', () => ({
  ConnectionState: {
    Connecting: 'connecting',
    Connected: 'connected',
    Reconnecting: 'reconnecting',
    SignalReconnecting: 'signalReconnecting',
  },
  RoomEvent: Object.fromEntries(
    [
      'ConnectionStateChanged',
      'ParticipantConnected',
      'ParticipantDisconnected',
      'TrackSubscribed',
      'TrackUnsubscribed',
      'TrackPublished',
      'TrackUnpublished',
      'TrackMuted',
      'TrackUnmuted',
      'LocalTrackPublished',
      'LocalTrackUnpublished',
      'Disconnected',
    ].map((key) => [key, key])
  ),
  Track: {
    Source: {
      Camera: 'camera',
      Microphone: 'microphone',
      ScreenShare: 'screen',
    },
  },
  Room: class {
    state = 'connecting';
    remoteParticipants = new Map();
    handlers = new Map<string, Set<(...args: any[]) => void>>();
    localParticipant = {
      isCameraEnabled: false,
      isMicrophoneEnabled: false,
      isScreenShareEnabled: false,
      getTrackPublication: () => undefined,
      setMicrophoneEnabled: async (enabled: boolean) => {
        this.localParticipant.isMicrophoneEnabled = enabled;
        this.emit('LocalTrackPublished');
      },
      setCameraEnabled: async (enabled: boolean) => {
        this.localParticipant.isCameraEnabled = enabled;
        this.emit('LocalTrackPublished');
      },
      setScreenShareEnabled: async (enabled: boolean) => {
        this.localParticipant.isScreenShareEnabled = enabled;
        if (enabled) mocks.shareStarted();
        else mocks.shareStopped();
        this.emit('LocalTrackPublished');
      },
    };
    constructor() {
      mocks.mounted();
      mocks.room = this;
    }
    on(event: string, callback: (...args: any[]) => void) {
      if (!this.handlers.has(event)) this.handlers.set(event, new Set());
      this.handlers.get(event)!.add(callback);
      return this;
    }
    off(event: string, callback: (...args: any[]) => void) {
      this.handlers.get(event)?.delete(callback);
      return this;
    }
    emit(event: string) {
      this.handlers.get(event)?.forEach((callback) => callback());
    }
    async connect() {
      this.state = 'connected';
      this.emit('ConnectionStateChanged');
    }
    async disconnect() {
      mocks.unmounted();
    }
    async startAudio() {}
  },
}));

let tree: ReactTestRenderer;
let call: ReturnType<typeof useVideoCall>;
let nodeNumber = 0;
function Probe() {
  const value = useVideoCall();
  useEffect(() => {
    call = value;
  }, [value]);
  return null;
}
function app(onConsultation: boolean) {
  return (
    <VideoCallProvider>
      <Probe />
      {onConsultation ? (
        <VideoConsultation
          appointmentId="visit-one"
          patientName="Test patient"
          panels={[]}
          actions={null}
        />
      ) : (
        <h1>Schedule page</h1>
      )}
    </VideoCallProvider>
  );
}
async function flush() {
  for (let n = 0; n < 8; n++)
    await new Promise((resolve) => setImmediate(resolve));
}
async function join() {
  await act(async () => {
    await call.join({
      appointmentId: 'visit-one',
      patientName: 'Test patient',
      microphone: true,
      camera: true,
    });
    await flush();
  });
  await act(async () => {
    await vi.dynamicImportSettled();
    await flush();
  });
}
beforeEach(async () => {
  vi.clearAllMocks();
  mocks.portalTargets = [];
  mocks.room = undefined;
  mocks.error = undefined;
  mocks.subscribers.clear();
  mocks.token = `x.${btoa(
    JSON.stringify({ sub: 'dentist-one', sid: 'session-one' })
  )}.x`;
  mocks.status = {
    canJoin: true,
    reason: 'ready',
    roomName: 'room-one',
    serverNow: new Date(Date.now() - 1000).toISOString(),
  };
  mocks.getToken.mockImplementation(() => ({
    unwrap: async () => ({
      provider: 'livekit',
      serverUrl: 'wss://synthetic.livekit.test',
      identity: 'synthetic-dentist',
      token: 'synthetic-call-token',
      roomName: 'room-one',
      role: 'dentist',
      issuedAt: new Date().toISOString(),
      closesAt: new Date(Date.now() + 60000).toISOString(),
    }),
  }));
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('window', {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
  await act(async () => {
    tree = Renderer.create(app(true), {
      createNodeMock: (element) =>
        element.type === 'div' ? { node: ++nodeNumber } : null,
    });
    await flush();
  });
});
afterEach(async () => {
  await act(async () => {
    tree.unmount();
    await flush();
  });
  vi.unstubAllGlobals();
});

test('navigating away and returning moves the visual target without replacing the room, token or callbacks', async () => {
  await join();
  const room = tree.root.findByType(ConnectedVideoCall);
  const onError = room.props.report;
  const onDisconnected = room.props.end;
  const routeTarget = mocks.portalTargets.at(-1);
  await act(async () => {
    tree.update(app(false));
    await flush();
  });
  expect(tree.root.findByType('h1').props.children).toBe('Schedule page');
  expect(mocks.portalTargets.at(-1)).not.toBe(routeTarget);
  expect(tree.root.findByType(ConnectedVideoCall)).toBe(room);
  expect(room.props.call.session.token).toBe('synthetic-call-token');
  expect(room.props.report).toBe(onError);
  expect(room.props.end).toBe(onDisconnected);
  await act(async () => {
    tree.update(app(true));
    await flush();
  });
  expect(tree.root.findByType(ConnectedVideoCall)).toBe(room);
  expect(mocks.mounted).toHaveBeenCalledTimes(1);
  expect(mocks.unmounted).not.toHaveBeenCalled();
  expect(mocks.getToken).toHaveBeenCalledTimes(1);
});

test('server cancellation tears down the room even when its appointment page is closed', async () => {
  await join();
  await act(async () => {
    tree.update(app(false));
    await flush();
  });
  mocks.status = {
    ...mocks.status,
    canJoin: false,
    reason: 'closed',
    serverNow: new Date(Date.now() + 1000).toISOString(),
  };
  await act(async () => {
    tree.update(app(false));
    await flush();
  });
  expect(tree.root.findAllByType(ConnectedVideoCall)).toHaveLength(0);
  expect(mocks.unmounted).toHaveBeenCalledTimes(1);
});

test('a second appointment returns to the current call instead of creating another room', async () => {
  await join();
  await act(async () =>
    call.join({
      appointmentId: 'visit-two',
      patientName: 'Other patient',
      microphone: true,
      camera: true,
    })
  );
  expect(mocks.navigate).toHaveBeenCalledWith('/consult/visit-one');
  expect(mocks.getToken).toHaveBeenCalledTimes(1);
  expect(mocks.mounted).toHaveBeenCalledTimes(1);
});

test('logout during token acquisition cannot connect an old-account call', async () => {
  let release!: (value: unknown) => void;
  mocks.getToken.mockReturnValue({
    unwrap: () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  });
  let pending!: Promise<void>;
  await act(async () => {
    pending = call.join({
      appointmentId: 'visit-one',
      patientName: 'Test patient',
      microphone: true,
      camera: true,
    });
  });
  mocks.token = '';
  await act(async () => {
    release({ token: 'old-token' });
    await pending;
    await flush();
  });
  expect(tree.root.findAllByType(ConnectedVideoCall)).toHaveLength(0);
});

function remoteParticipant() {
  const publications = new Map<string, object>();
  const remote = {
    identity: 'synthetic-patient',
    isCameraEnabled: false,
    getTrackPublication: (source: string) => publications.get(source),
  };
  mocks.room.remoteParticipants.set(remote.identity, remote);
  return { remote, publications };
}
const videoPublication = () => ({
  isMuted: false,
  track: { attach: vi.fn(), detach: vi.fn() },
});

test('LiveKit presence, incoming video and camera removal update without replacing the room', async () => {
  await join();
  const room = tree.root.findByType(ConnectedVideoCall);
  const { remote, publications } = remoteParticipant();
  await act(async () => mocks.room.emit('ParticipantConnected'));
  expect(JSON.stringify(tree.toJSON())).toContain('Patient camera is off');
  await act(async () => {
    remote.isCameraEnabled = true;
    publications.set('camera', videoPublication());
    mocks.room.emit('TrackSubscribed');
  });
  expect(tree.root.findAllByType('video')).toHaveLength(1);
  await act(async () => {
    publications.delete('camera');
    remote.isCameraEnabled = false;
    mocks.room.emit('TrackUnsubscribed');
  });
  expect(JSON.stringify(tree.toJSON())).toContain('Patient camera is off');
  expect(tree.root.findByType(ConnectedVideoCall)).toBe(room);
  expect(mocks.mounted).toHaveBeenCalledTimes(1);
});

test('screen sharing starts and stops without replacing the call, and received screens use the main stage', async () => {
  await join();
  await act(async () => {
    tree.root.findByProps({ 'aria-label': 'Share screen' }).props.onClick();
    await flush();
  });
  expect(mocks.shareStarted).toHaveBeenCalledTimes(1);
  expect(mocks.mounted).toHaveBeenCalledTimes(1);
  const { publications } = remoteParticipant();
  await act(async () => {
    tree.root
      .findByProps({ 'aria-label': 'Stop sharing screen' })
      .props.onClick();
    await flush();
    publications.set('screen', videoPublication());
    mocks.room.emit('TrackSubscribed');
  });
  expect(
    tree.root
      .findAllByType('video')
      .some((node) => node.props.className?.includes('consult-screen-content'))
  ).toBe(true);
  await act(async () => {
    publications.delete('screen');
    mocks.room.emit('TrackUnsubscribed');
  });
  expect(
    tree.root
      .findAllByType('video')
      .some((node) => node.props.className?.includes('consult-screen-content'))
  ).toBe(false);
  expect(mocks.mounted).toHaveBeenCalledTimes(1);
});
