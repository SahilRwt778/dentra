import React from 'react';
import Renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { useVideoRoom } from '@dentra/call-core';
import { testVideoCredentials } from '../test-utils/video';

const mockRooms: any[] = [];
jest.mock('livekit-client', () => ({
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
    ].map(key => [key, key])
  ),
  Track: { Source: { Camera: 'camera', ScreenShare: 'screen' } },
  Room: class {
    state = 'connecting';
    remoteParticipants = new Map();
    handlers = new Map<string, Set<(...args: any[]) => void>>();
    localParticipant = {
      isCameraEnabled: false,
      isMicrophoneEnabled: false,
      isScreenShareEnabled: false,
      getTrackPublication: () => undefined,
      setMicrophoneEnabled: jest.fn(async () => {
        this.localParticipant.isMicrophoneEnabled = true;
      }),
      setCameraEnabled: jest.fn(async () => {
        this.localParticipant.isCameraEnabled = true;
      }),
    };
    constructor() {
      mockRooms.push(this);
    }
    on(event: string, listener: (...args: any[]) => void) {
      if (!this.handlers.has(event)) this.handlers.set(event, new Set());
      this.handlers.get(event)!.add(listener);
      return this;
    }
    off(event: string, listener: (...args: any[]) => void) {
      this.handlers.get(event)?.delete(listener);
      return this;
    }
    emit(event: string) {
      this.handlers.get(event)?.forEach(listener => listener());
    }
    connect = jest.fn(async () => {
      this.state = 'connected';
      this.emit('ConnectionStateChanged');
    });
    disconnect = jest.fn(async () => {});
  },
}));
let tree: ReactTestRenderer;
let state: ReturnType<typeof useVideoRoom>;
const session = testVideoCredentials('dentist');
const disconnected = jest.fn(),
  failed = jest.fn(),
  mediaFailed = jest.fn();
function Probe({ rerender = 0 }: { rerender?: number }) {
  state = useVideoRoom(session, true, true, {
    onDisconnected: disconnected,
    onError: failed,
    onMediaDeviceFailure: mediaFailed,
  });
  return <React.Fragment>{rerender}</React.Fragment>;
}
beforeEach(async () => {
  mockRooms.length = 0;
  jest.clearAllMocks();
  await act(async () => {
    tree = Renderer.create(<Probe />);
  });
});
afterEach(async () => {
  await act(async () => tree.unmount());
});

test('keeps the room across visual updates and disconnects on unmount', async () => {
  const room = mockRooms[0];
  expect(room.connect).toHaveBeenCalledWith(session.serverUrl, session.token);
  await act(async () => tree.update(<Probe rerender={1} />));
  expect(mockRooms).toHaveLength(1);
  expect(room.disconnect).not.toHaveBeenCalled();
  await act(async () => tree.unmount());
  expect(room.disconnect).toHaveBeenCalledTimes(1);
});
test('remote camera mute/subscription events reflect actual publications without reconnecting', async () => {
  const room = mockRooms[0];
  const publication = { isMuted: false, track: {} };
  const peer = {
    isCameraEnabled: true,
    getTrackPublication: (source: string) =>
      source === 'camera' ? publication : undefined,
  };
  await act(async () => {
    room.remoteParticipants.set('patient', peer);
    room.emit('TrackSubscribed');
  });
  expect(state.remotePresent).toBe(true);
  expect(state.remoteCameraTrack?.publication).toBe(publication);
  await act(async () => {
    publication.isMuted = true;
    peer.isCameraEnabled = false;
    room.emit('TrackMuted');
  });
  expect(state.remoteCameraTrack).toBeNull();
  expect(state.remoteCamera).toBe(false);
  expect(state.remotePresent).toBe(true);
  expect(mockRooms).toHaveLength(1);
});
test('screen sharing remains separate from camera and microphone state', async () => {
  const room = mockRooms[0],
    camera = { isMuted: false, track: {} },
    screen = { isMuted: false, track: {} };
  await act(async () => {
    room.remoteParticipants.set('patient', {
      isCameraEnabled: true,
      getTrackPublication: (source: string) =>
        source === 'camera' ? camera : screen,
    });
    room.localParticipant.isScreenShareEnabled = true;
    room.emit('TrackSubscribed');
  });
  expect(state.remoteScreenTrack?.publication).toBe(screen);
  expect(state.remoteCameraTrack?.publication).toBe(camera);
  expect(state.microphone).toBe(true);
  expect(state.screenSharing).toBe(true);
});
test('removed listeners ignore late events from a previous room', async () => {
  const room = mockRooms[0];
  await act(async () => tree.unmount());
  room.emit('Disconnected');
  expect(disconnected).not.toHaveBeenCalled();
  expect(failed).not.toHaveBeenCalled();
});
