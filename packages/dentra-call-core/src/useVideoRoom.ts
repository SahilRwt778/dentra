import { useEffect, useRef, useState } from 'react';
import {
  ConnectionState,
  Room,
  RoomEvent,
  Track,
  type Participant,
  type TrackPublication,
} from 'livekit-client';
import type { VideoCredentials } from './video-types';

export type VideoSource = {
  participant: Participant;
  publication: TrackPublication;
  source: Track.Source;
};
type Callbacks = {
  onDisconnected(): void;
  onError(): void;
  onMediaDeviceFailure(): void;
};

function videoSource(
  participant: Participant | undefined,
  source: Track.Source
) {
  const publication = participant?.getTrackPublication(source);
  if (!participant || !publication?.track || publication.isMuted) return null;
  return { participant, publication, source } satisfies VideoSource;
}

/** The connection stays mounted above navigation; rendering and controls never own it. */
export function useVideoRoom(
  session: VideoCredentials,
  audio: boolean,
  video: boolean,
  callbacks: Callbacks
) {
  const latest = useRef(callbacks);
  latest.current = callbacks;
  const [room, setRoom] = useState<Room | null>(null);
  const [, setRevision] = useState(0);
  useEffect(() => {
    let disposed = false;
    let connected = false;
    let ended = false;
    const current = new Room({ adaptiveStream: false, dynacast: true });
    setRoom(current);
    const update = () => {
      if (!disposed) setRevision((value) => value + 1);
    };
    const disconnected = () => {
      if (disposed || ended) return;
      ended = true;
      if (connected) latest.current.onDisconnected();
      else latest.current.onError();
    };
    const events = [
      RoomEvent.ConnectionStateChanged,
      RoomEvent.ParticipantConnected,
      RoomEvent.ParticipantDisconnected,
      RoomEvent.TrackSubscribed,
      RoomEvent.TrackUnsubscribed,
      RoomEvent.TrackPublished,
      RoomEvent.TrackUnpublished,
      RoomEvent.TrackMuted,
      RoomEvent.TrackUnmuted,
      RoomEvent.LocalTrackPublished,
      RoomEvent.LocalTrackUnpublished,
    ];
    events.forEach((event) => current.on(event, update));
    current.on(RoomEvent.Disconnected, disconnected);

    async function connect() {
      try {
        await current.connect(session.serverUrl, session.token);
        if (disposed) return;
        connected = true;
        update();
        // Device failures leave the connected consultation available for audio-only use.
        const results = await Promise.allSettled([
          audio
            ? current.localParticipant.setMicrophoneEnabled(true)
            : Promise.resolve(),
          video
            ? current.localParticipant.setCameraEnabled(true)
            : Promise.resolve(),
        ]);
        if (!disposed) {
          update();
          if (results.some((result) => result.status === 'rejected'))
            latest.current.onMediaDeviceFailure();
        }
      } catch {
        if (!disposed && !ended) {
          ended = true;
          latest.current.onError();
        }
      } finally {
        // A permission prompt or connect attempt can resolve after navigation/logout.
        if (disposed) await current.disconnect().catch(() => undefined);
      }
    }
    connect();
    return () => {
      disposed = true;
      events.forEach((event) => current.off(event, update));
      current.off(RoomEvent.Disconnected, disconnected);
      current.disconnect().catch(() => undefined);
    };
  }, [session, audio, video]);

  // Room events increment revision; SDK objects themselves are intentionally not persisted.
  const peer = room?.remoteParticipants.values().next().value as
    | Participant
    | undefined;
  return {
    room,
    connection:
      !room || room.state === ConnectionState.Connecting
        ? ('connecting' as const)
        : room.state === ConnectionState.Reconnecting ||
          room.state === ConnectionState.SignalReconnecting
        ? ('reconnecting' as const)
        : room.state === ConnectionState.Connected
        ? ('connected' as const)
        : ('disconnected' as const),
    remotePresent: !!peer,
    remoteCamera: peer?.isCameraEnabled ?? false,
    remoteCameraTrack: videoSource(peer, Track.Source.Camera),
    remoteScreenTrack: videoSource(peer, Track.Source.ScreenShare),
    localCameraTrack: videoSource(room?.localParticipant, Track.Source.Camera),
    camera: room?.localParticipant.isCameraEnabled ?? video,
    microphone: room?.localParticipant.isMicrophoneEnabled ?? audio,
    screenSharing: room?.localParticipant.isScreenShareEnabled ?? false,
  };
}
