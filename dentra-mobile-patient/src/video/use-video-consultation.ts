import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppState,
  BackHandler,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import { useVideoStatusQuery, joinVideo } from '@/api/video';
import type { VideoSession } from '@/api/types';
import { errorMessage } from '@/api/errors';
import { currentPushSession } from '@/notifications/push-session';
import { nativeVideo } from './native-video';
import { videoStatusText } from './video-status';
import {
  createBackgroundCall,
  listenForCallBackground,
} from './background-call';
import { createCallAudio } from './call-audio';

export type VideoCallOptions = {
  appointmentId: string;
  minimized: boolean;
  onMinimize: () => void;
  onExpand: () => void;
  onClose: () => void;
};

export function useVideoConsultation({
  appointmentId,
  minimized,
  onMinimize,
  onExpand,
  onClose,
}: VideoCallOptions) {
  const sdk = nativeVideo();
  const {
    currentData: status,
    error,
    refetch,
    isLoading,
  } = useVideoStatusQuery(appointmentId);
  const [joining, setJoining] = useState(false);
  const joiningRef = useRef(false);
  const attempt = useRef(0);
  const [session, setSession] = useState<VideoSession>();
  const activeSession = useRef<VideoSession | undefined>(undefined);
  const localDeadline = useRef(0);
  const [notice, setNotice] = useState<string>();
  const [camera, setCamera] = useState(true);
  const [microphone, setMicrophone] = useState(true);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const live = useRef(true);
  const foreground = useRef(AppState.currentState !== 'background');
  const audio = useRef<ReturnType<typeof createCallAudio> | null>(null);
  const background = useRef<ReturnType<typeof createBackgroundCall> | null>(
    null,
  );

  const cancelPendingJoin = useCallback(() => {
    attempt.current++;
    joiningRef.current = false;
  }, []);
  const stop = useCallback(
    (message?: string) => {
      cancelPendingJoin();
      activeSession.current = undefined;
      audio.current?.stop().catch(() => undefined);
      background.current?.stop().catch(() => undefined);
      audio.current = null;
      background.current = null;
      setSession(undefined);
      setJoining(false);
      setNotice(message);
    },
    [cancelPendingJoin],
  );
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
      cancelPendingJoin();
      audio.current?.stop().catch(() => undefined);
      background.current?.stop().catch(() => undefined);
    };
  }, [cancelPendingJoin]);
  useEffect(() => {
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      if (minimized) return false;
      if (session) onMinimize();
      else onClose();
      return true;
    });
    return () => listener.remove();
  }, [session, minimized, onMinimize, onClose]);
  useEffect(() => {
    if (!session && minimized) onExpand();
  }, [session, minimized, onExpand]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'background') {
        foreground.current = false;
        // Android owns the Home/PiP layout. Back owns the in-app floating window.
        if (activeSession.current) {
          if (Platform.OS !== 'android') onMinimize();
        } else stop();
      } else if (state === 'active') {
        foreground.current = true;
        if (activeSession.current && Date.now() >= localDeadline.current)
          stop('The video consultation window has ended.');
      }
    });
    return () => subscription.remove();
  }, [onMinimize, stop]);
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
    if (!session) return;
    const timer = setTimeout(
      () => stop('The video consultation window has ended.'),
      Math.max(0, localDeadline.current - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [session, stop]);
  useEffect(() => {
    if (
      session &&
      (error ||
        (status &&
          status.serverNow >= session.issuedAt &&
          (!status.canJoin || status.roomName !== session.roomName)))
    ) {
      stop(
        error
          ? 'We could not verify your appointment. Check your connection and rejoin.'
          : videoStatusText(status),
      );
    }
  }, [session, status, error, stop]);

  async function join() {
    if (!sdk || joiningRef.current) return;
    joiningRef.current = true;
    const currentAttempt = ++attempt.current;
    const scope = currentPushSession()?.key;
    const callAudio = createCallAudio(sdk);
    const backgroundCall = createBackgroundCall();
    audio.current = callAudio;
    background.current = backgroundCall;
    const isCurrent = () =>
      live.current &&
      foreground.current &&
      currentAttempt === attempt.current &&
      !!scope &&
      currentPushSession()?.key === scope;
    setJoining(true);
    setNotice(undefined);
    setPermissionDenied(false);
    try {
      let useCamera = camera;
      if (Platform.OS === 'android') {
        const needed = [
          ...(microphone ? [PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] : []),
          ...(camera ? [PermissionsAndroid.PERMISSIONS.CAMERA] : []),
        ];
        const permissions = await PermissionsAndroid.requestMultiple(needed);
        if (
          microphone &&
          permissions[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] !==
            PermissionsAndroid.RESULTS.GRANTED
        ) {
          setPermissionDenied(true);
          throw new Error(
            'Allow microphone access to speak with your dentist, or turn the microphone off to join muted.',
          );
        }
        if (
          camera &&
          permissions[PermissionsAndroid.PERMISSIONS.CAMERA] !==
            PermissionsAndroid.RESULTS.GRANTED
        ) {
          useCamera = false;
          setCamera(false);
        }
      }
      if (Platform.OS === 'ios') {
        if (microphone && !(await sdk.requestPermission('microphone'))) {
          setPermissionDenied(true);
          throw new Error(
            'Allow microphone access or turn the microphone off to join muted.',
          );
        }
        if (camera && !(await sdk.requestPermission('camera'))) {
          useCamera = false;
          setCamera(false);
        }
      }
      if (!isCurrent()) return;
      const result = await joinVideo(
        appointmentId,
        Platform.OS as 'android' | 'ios',
      );
      if (!isCurrent()) return;
      const duration =
        Date.parse(result.closesAt) - Date.parse(result.issuedAt);
      if (!Number.isFinite(duration) || duration <= 0)
        throw new Error('The video consultation window has ended.');
      const deadline = Date.now() + duration;
      await callAudio.start(isCurrent);
      await backgroundCall.start(deadline, isCurrent);
      if (!isCurrent()) return;
      localDeadline.current = deadline;
      setCamera(useCamera);
      activeSession.current = result;
      setSession(result);
    } catch (err) {
      await callAudio.stop().catch(() => undefined);
      await backgroundCall.stop().catch(() => undefined);
      if (isCurrent())
        setNotice(err instanceof Error ? err.message : errorMessage(err));
    } finally {
      if (currentAttempt === attempt.current) {
        joiningRef.current = false;
        if (live.current) setJoining(false);
      }
    }
  }
  function leave() {
    stop();
    if (minimized) onClose();
  }
  const disconnected = useCallback(
    (expected: VideoSession) => {
      if (activeSession.current === expected)
        stop(
          'You left the call. You can rejoin while your consultation is available.',
        );
    },
    [stop],
  );
  const connectionFailed = useCallback(
    (expected: VideoSession) => {
      if (activeSession.current === expected)
        stop(
          'Could not connect to the call. Check your connection and try again.',
        );
    },
    [stop],
  );
  const mediaFailed = useCallback((expected: VideoSession) => {
    if (activeSession.current === expected)
      setNotice(
        'Your camera or microphone is unavailable. Check device permissions or continue with it turned off.',
      );
  }, []);
  return {
    sdk,
    status,
    error,
    refetch,
    isLoading,
    session,
    notice,
    joining,
    camera,
    microphone,
    permissionDenied,
    setCamera,
    setMicrophone,
    join,
    leave,
    disconnected,
    connectionFailed,
    mediaFailed,
    report: setNotice,
  };
}
