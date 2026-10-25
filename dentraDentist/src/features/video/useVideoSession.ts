import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, BackHandler, Platform } from 'react-native';
import axios from 'axios';
import type { VideoSession } from '../../common/types/api';
import { getVideoSdk } from '../../common/services/native-video';
import { createVideoAudio } from '../../common/services/video-audio';
import {
  createBackgroundCall,
  listenForCallBackground,
} from '../../common/services/background-call';
import {
  MicrophonePermissionError,
  requestVideoPermissions,
  type MediaOptions,
} from '../../common/services/video-permissions';
import { errorMessage } from '../../common/utils/api-error';
import { session as authSession } from '../auth/session';
import { useVideoAvailability } from './useVideoAvailability';
import { prepareVideoSession } from './prepare-video-session';
import { videoStatusMessage } from './video-status';

type ActiveSession = VideoSession & {
  media: MediaOptions;
  localDeadline: number;
};
type Options = {
  appointmentId: string;
  minimized: boolean;
  minimize: () => void;
  expand: () => void;
  close: () => void;
};

export function useVideoSession({
  appointmentId,
  minimized,
  minimize,
  expand,
  close,
}: Options) {
  const sdk = getVideoSdk();
  const availability = useVideoAvailability(appointmentId);
  const [connection, setConnection] = useState<ActiveSession | null>(null);
  const activeConnection = useRef<ActiveSession | null>(null);
  const [joining, setJoining] = useState(false);
  const [camera, setCamera] = useState(true);
  const [microphone, setMicrophone] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const mounted = useRef(true);
  const foreground = useRef(AppState.currentState !== 'background');
  const attempt = useRef(0);
  const joiningLock = useRef(false);
  const request = useRef<AbortController | null>(null);
  const audio = useRef<ReturnType<typeof createVideoAudio> | null>(null);
  const background = useRef<ReturnType<typeof createBackgroundCall> | null>(
    null,
  );

  const cancelPendingJoin = useCallback(() => {
    attempt.current++;
    request.current?.abort();
    joiningLock.current = false;
  }, []);

  const stop = useCallback(
    (message?: string) => {
      cancelPendingJoin();
      audio.current?.stop().catch(() => {});
      audio.current = null;
      background.current?.stop().catch(() => {});
      background.current = null;
      activeConnection.current = null;
      setConnection(null);
      setJoining(false);
      setNotice(message ?? null);
    },
    [cancelPendingJoin],
  );

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      cancelPendingJoin();
      audio.current?.stop().catch(() => {});
      background.current?.stop().catch(() => {});
    };
  }, [cancelPendingJoin]);

  useEffect(() => {
    const version = authSession.getVersion();
    return authSession.subscribe(() => {
      if (version !== authSession.getVersion())
        stop('Sign in again to join this consultation.');
    });
  }, [stop]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') foreground.current = true;
      if (state === 'background') {
        foreground.current = false;
        // Android owns the Home/PiP layout. Back owns the in-app floating window.
        if (activeConnection.current) {
          if (Platform.OS !== 'android') minimize();
        } else stop(); // A pending join must never start media after the user leaves.
      }
      if (
        state === 'active' &&
        activeConnection.current &&
        Date.now() >= activeConnection.current.localDeadline
      ) {
        stop('The video consultation window has ended.');
      }
    });
    return () => subscription.remove();
  }, [stop, minimize]);

  useEffect(() => {
    const subscription = listenForCallBackground(event => {
      if (event.endedReason)
        stop(
          event.endedReason === 'deadline'
            ? 'The video consultation window has ended.'
            : 'The call has ended.',
        );
    });
    return () => subscription.remove();
  }, [stop]);

  useEffect(() => {
    const back = BackHandler.addEventListener('hardwareBackPress', () => {
      if (minimized) return false;
      if (connection) minimize();
      else close();
      return true;
    });
    return () => back.remove();
  }, [close, connection, minimize, minimized]);

  useEffect(() => {
    if (!connection && minimized) expand();
  }, [connection, expand, minimized]);

  useEffect(() => {
    if (!connection) return;
    const timer = setTimeout(
      () => stop('The video consultation window has ended.'),
      Math.max(0, connection.localDeadline - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [connection, stop]);

  useEffect(() => {
    if (!connection) return;
    if (availability.error) {
      stop(
        'Could not verify this appointment. Check your connection and rejoin.',
      );
      return;
    }
    const status = availability.data;
    if (
      status &&
      status.serverNow >= connection.issuedAt &&
      (!status.canJoin || status.roomName !== connection.roomName)
    )
      stop(videoStatusMessage(status));
  }, [availability.data, availability.error, connection, stop]);

  async function join() {
    if (!sdk || joiningLock.current) return;
    joiningLock.current = true;
    const currentAttempt = ++attempt.current;
    const account = authSession.getVersion();
    const controller = new AbortController();
    const callAudio = createVideoAudio(sdk);
    const backgroundCall = createBackgroundCall();
    request.current = controller;
    audio.current = callAudio;
    background.current = backgroundCall;
    const isCurrent = () =>
      mounted.current &&
      foreground.current &&
      !controller.signal.aborted &&
      currentAttempt === attempt.current &&
      account === authSession.getVersion() &&
      authSession.isSignedIn();
    const assertCurrent = () => {
      if (!isCurrent()) throw new axios.CanceledError('Call changed.');
    };
    setJoining(true);
    setNotice(null);
    setPermissionDenied(false);
    try {
      assertCurrent();
      const media = await requestVideoPermissions({ camera, microphone });
      assertCurrent();
      const credentials = await prepareVideoSession(
        appointmentId,
        controller.signal,
        assertCurrent,
      );
      const duration =
        Date.parse(credentials.closesAt) - Date.parse(credentials.issuedAt);
      if (!Number.isFinite(duration) || duration <= 0)
        throw new Error('The video consultation window has ended.');
      const localDeadline = Date.now() + duration;
      await callAudio.start(isCurrent);
      assertCurrent();
      await backgroundCall.start(localDeadline, isCurrent);
      assertCurrent();
      setCamera(media.camera);
      const next = { ...credentials, media, localDeadline };
      activeConnection.current = next;
      setConnection(next);
      if (camera && !media.camera)
        setNotice('Camera access was denied. You joined with your camera off.');
    } catch (error) {
      await callAudio.stop().catch(() => {});
      await backgroundCall.stop().catch(() => {});
      if (isCurrent() && !axios.isCancel(error)) {
        setPermissionDenied(error instanceof MicrophonePermissionError);
        setNotice(errorMessage(error));
      }
    } finally {
      if (currentAttempt === attempt.current) {
        joiningLock.current = false;
        if (mounted.current) setJoining(false);
      }
    }
  }

  function leave() {
    stop();
    if (minimized) close();
  }
  const disconnected = useCallback(
    (room: ActiveSession) => {
      if (activeConnection.current !== room) return;
      stop(
        'The call disconnected. You can rejoin while this appointment is available.',
      );
    },
    [stop],
  );
  const connectionFailed = useCallback(
    (room: ActiveSession) => {
      if (activeConnection.current !== room) return;
      stop(
        'Could not connect to the call. Check your connection and try again.',
      );
    },
    [stop],
  );
  const mediaFailed = useCallback((room: ActiveSession) => {
    if (activeConnection.current !== room) return;
    setNotice(
      'Your camera or microphone is unavailable. Check device permissions or continue with it turned off.',
    );
  }, []);

  return {
    sdk,
    availability,
    connection,
    joining,
    camera,
    microphone,
    setCamera,
    setMicrophone,
    notice,
    permissionDenied,
    join,
    leave,
    disconnected,
    connectionFailed,
    mediaFailed,
    report: setNotice,
  };
}
