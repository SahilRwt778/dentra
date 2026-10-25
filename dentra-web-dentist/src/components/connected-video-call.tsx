import { CallChat } from './call-chat';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Camera,
  CameraOff,
  Mic,
  MicOff,
  PhoneOff,
  Video,
  MonitorUp,
  MessageCircle,
} from 'lucide-react';
import { useVideoRoom, type VideoSource } from '@dentra/call-core';
import { Track } from 'livekit-client';
import type { ActiveVideoCall } from './video-call-context';

/** The LiveKit connection and audio stay above the router; only the visual stage moves. */
export default function ConnectedVideoCall({
  call,
  target,
  end,
  report,
}: {
  call: ActiveVideoCall;
  target: HTMLElement | null;
  end: (call: ActiveVideoCall, message?: string) => void;
  report: (message: string) => void;
}) {
  const [chatOpen, setChatOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const callState = useVideoRoom(call.session, call.microphone, call.camera, {
    onDisconnected: () =>
      end(
        call,
        'The call disconnected. Rejoin while the consultation is available.'
      ),
    onError: () =>
      end(
        call,
        'Could not connect to the video meeting. Check your connection and try again.'
      ),
    onMediaDeviceFailure: () =>
      report(
        'Your camera or microphone is unavailable. Check browser permissions or continue with it off.'
      ),
  });
  const {
    room,
    connection,
    remotePresent,
    camera,
    microphone,
    screenSharing: sharing,
  } = callState;
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  async function change(action: () => Promise<void>) {
    if (!room || lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      await action();
    } catch {
      report(
        'Could not update call controls. Check browser permissions and try again.'
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const status =
    connection !== 'connected'
      ? connection === 'reconnecting'
        ? 'Reconnecting…'
        : 'Connecting…'
      : remotePresent
      ? 'Patient connected'
      : 'Waiting for the patient';
  const contentTile = callState.remoteScreenTrack;
  const stageTile = contentTile ?? callState.remoteCameraTrack;
  return (
    <>
      <RemoteAudio
        track={
          room?.remoteParticipants
            .values()
            .next()
            .value?.getTrackPublication(Track.Source.Microphone)?.track
        }
      />
      <CallChat
        appointmentId={call.appointmentId}
        target={target}
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        onUnread={setUnread}
      />
      {target &&
        createPortal(
          <div className="consult-live-room">
            <div className="consult-call">
              <div className="consult-call-stage">
                {stageTile ? (
                  <LiveVideo
                    source={stageTile}
                    className={
                      contentTile
                        ? 'consult-call-remote consult-screen-content'
                        : 'consult-call-remote'
                    }
                  />
                ) : (
                  <div className="consult-call-placeholder">
                    <Video size={38} />
                    <b>
                      {connection !== 'connected' || !remotePresent
                        ? status
                        : 'Patient camera is off'}
                    </b>
                    <span className="small">
                      The room is private to you and this patient.
                    </span>
                  </div>
                )}
                <div className="consult-call-self">
                  {camera && callState.localCameraTrack ? (
                    <LiveVideo source={callState.localCameraTrack} />
                  ) : (
                    <span>{camera ? 'Starting camera…' : 'Camera off'}</span>
                  )}
                  <b>You</b>
                </div>
              </div>
              <p className="consult-connection-status" aria-live="polite">
                {sharing
                  ? 'Sharing your screen · '
                  : contentTile
                  ? 'Patient is sharing their screen · '
                  : ''}
                {status}
              </p>
              <div className="row video-options consult-call-controls">
                <button
                  type="button"
                  className="btn"
                  disabled={busy || connection !== 'connected'}
                  aria-label={
                    microphone ? 'Mute microphone' : 'Unmute microphone'
                  }
                  onClick={() =>
                    void change(async () => {
                      await room!.localParticipant.setMicrophoneEnabled(
                        !microphone
                      );
                    })
                  }
                >
                  {microphone ? <Mic size={18} /> : <MicOff size={18} />}
                  {microphone ? 'Mute' : 'Unmute'}
                </button>
                <button
                  type="button"
                  className="btn"
                  disabled={busy || connection !== 'connected'}
                  aria-label={camera ? 'Turn camera off' : 'Turn camera on'}
                  onClick={() =>
                    void change(async () => {
                      await room!.localParticipant.setCameraEnabled(!camera);
                    })
                  }
                >
                  {camera ? <Camera size={18} /> : <CameraOff size={18} />}
                  Camera {camera ? 'on' : 'off'}
                </button>
                <button
                  type="button"
                  className="btn"
                  disabled={busy || !room || connection !== 'connected'}
                  aria-label={sharing ? 'Stop sharing screen' : 'Share screen'}
                  onClick={() =>
                    void change(async () => {
                      await room!.localParticipant.setScreenShareEnabled(
                        !sharing,
                        { audio: false }
                      );
                    })
                  }
                >
                  <MonitorUp size={18} />
                  {sharing ? 'Stop sharing' : 'Share screen'}
                </button>
                <button
                  type="button"
                  className="btn"
                  aria-label="Open call chat"
                  onClick={() => setChatOpen(true)}
                >
                  <MessageCircle size={18} />
                  Chat{unread ? ` (${unread})` : ''}
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={() => end(call)}
                >
                  <PhoneOff size={18} />
                  Leave call
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    void room
                      ?.startAudio()
                      .catch(() =>
                        report('Use your browser controls to allow call audio.')
                      );
                  }}
                >
                  Enable call audio
                </button>
              </div>
            </div>
          </div>,
          target
        )}
    </>
  );
}

function LiveVideo({
  source,
  className,
}: {
  source: VideoSource;
  className?: string;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const track = source.publication.track;
  useEffect(() => {
    const element = video.current;
    if (!element || !track) return;
    track.attach(element);
    return () => {
      track.detach(element);
    };
  }, [track]);
  return <video ref={video} className={className} autoPlay playsInline muted />;
}

function RemoteAudio({
  track,
}: {
  track: import('livekit-client').Track | undefined;
}) {
  const audio = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    const element = audio.current;
    if (!element || !track) return;
    track.attach(element);
    return () => {
      track.detach(element);
    };
  }, [track]);
  return <audio ref={audio} autoPlay />;
}
