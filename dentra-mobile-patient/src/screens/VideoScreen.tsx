import { CallChat } from '@dentra/video/src/CallChat';
import { callChat } from '@/api/call-chat';
import { useCallback, useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  StatusBar,
  Text,
  View,
} from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import {
  Camera,
  CameraOff,
  Maximize2,
  Mic,
  MicOff,
  PhoneOff,
  RefreshCw,
  Video,
} from 'lucide-react-native';
import { Button, ErrorState, Loading } from '@/components/ui';
import type { nativeVideo } from '@/video/native-video';
import { useVideoConsultation } from '@/video/use-video-consultation';
import { videoStatusText } from '@/video/video-status';
import { refreshBackgroundCall } from '@/video/background-call';

export function VideoCallPanel({
  appointmentId,
  minimized,
  systemPip = false,
  onMinimize,
  onExpand,
  onClose,
}: {
  appointmentId: string;
  minimized: boolean;
  systemPip?: boolean;
  onMinimize: () => void;
  onExpand: () => void;
  onClose: () => void;
}) {
  const call = useVideoConsultation({
    appointmentId,
    minimized,
    onMinimize,
    onExpand,
    onClose,
  });
  const { sdk } = call;
  const { session, disconnected, connectionFailed, mediaFailed } = call;
  const onDisconnected = useCallback(() => {
    if (session) disconnected(session);
  }, [session, disconnected]);
  const onError = useCallback(() => {
    if (session) connectionFailed(session);
  }, [session, connectionFailed]);
  const onMediaFailure = useCallback(() => {
    if (session) mediaFailed(session);
  }, [session, mediaFailed]);
  return (
    <SafeAreaView
      edges={call.session ? [] : ['top', 'bottom', 'left', 'right']}
      accessibilityViewIsModal={!minimized}
      style={s.root}
    >
      {call.session && !minimized && <StatusBar hidden />}
      {!call.session && (
        <View style={s.header}>
          <Text style={s.title}>Video consultation</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to appointment"
            onPress={onClose}
          >
            <Text style={s.link}>Back</Text>
          </Pressable>
        </View>
      )}
      {call.session && sdk ? (
        <sdk.VideoRoom
          session={call.session}
          audio={call.microphone}
          video={call.camera}
          onDisconnected={onDisconnected}
          onError={onError}
          onMediaDeviceFailure={onMediaFailure}
          onScreenShareFailure={call.report}
        >
          <NativeCall
            sdk={sdk}
            appointmentId={appointmentId}
            minimized={minimized}
            systemPip={systemPip}
            expand={onExpand}
            leave={call.leave}
            report={call.report}
          />
        </sdk.VideoRoom>
      ) : (
        <View style={s.lobby}>
          <View style={s.avatar}>
            <Video size={44} color="#85D6CF" />
          </View>
          <Text style={s.heading}>
            {sdk
              ? 'Ready for your consultation?'
              : 'Update Dentra to join video calls'}
          </Text>
          <Text style={s.copy}>
            {sdk
              ? videoStatusText(call.status)
              : 'Install the latest Dentra app, then return to your appointment.'}
          </Text>
          {call.isLoading ? <Loading /> : null}
          <Text style={s.copy}>
            Find a quiet, well-lit place for your consultation.
          </Text>
          <View style={s.controls}>
            <Control
              label={
                call.microphone
                  ? 'Join with microphone off'
                  : 'Join with microphone on'
              }
              on={call.microphone}
              onPress={() => call.setMicrophone(value => !value)}
              icon={call.microphone ? Mic : MicOff}
            />
            <Control
              label={
                call.camera ? 'Join with camera off' : 'Join with camera on'
              }
              on={call.camera}
              onPress={() => call.setCamera(value => !value)}
              icon={call.camera ? Camera : CameraOff}
            />
          </View>
          <Button
            title="Join video call"
            loading={call.joining}
            disabled={!sdk || !call.status?.canJoin}
            onPress={() => {
              call.join().catch(() => undefined);
            }}
          />
          {call.error && (
            <ErrorState
              message="Could not check your appointment."
              retry={call.refetch}
            />
          )}
          {call.permissionDenied && (
            <Button
              title="Open device settings"
              variant="secondary"
              onPress={() => {
                Linking.openSettings().catch(() => undefined);
              }}
            />
          )}
        </View>
      )}
      {call.notice && !minimized && !systemPip && (
        <Text
          accessibilityRole="alert"
          style={[s.notice, call.session && s.callNotice]}
        >
          {call.notice}
        </Text>
      )}
    </SafeAreaView>
  );
}
type Sdk = NonNullable<ReturnType<typeof nativeVideo>>;
function NativeCall({
  appointmentId,
  sdk,
  minimized,
  systemPip,
  expand,
  leave,
  report,
}: {
  appointmentId: string;
  sdk: Sdk;
  minimized: boolean;
  systemPip: boolean;
  expand: () => void;
  leave: () => void;
  report: (value: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const [controlsVisible, setControlsVisible] = useState(true);
  const [activity, setActivity] = useState(0);
  const [screenReader, setScreenReader] = useState(false);
  const meeting = sdk.useMeeting();
  const [chatOpen, setChatOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const displayTile = meeting.remoteScreenTrack ?? meeting.remoteCameraTrack;
  const {
    connection,
    remotePresent: dentist,
    microphone: isMicrophoneEnabled,
    camera: isCameraEnabled,
    localCameraTrack,
  } = meeting;
  useEffect(() => {
    refreshBackgroundCall();
  }, [isMicrophoneEnabled, isCameraEnabled]);
  const hasRemoteVideo = displayTile != null;
  const [front, setFront] = useState(true);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    AccessibilityInfo.isScreenReaderEnabled()
      .then(enabled => {
        if (active) setScreenReader(enabled);
      })
      .catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener(
      'screenReaderChanged',
      setScreenReader,
    );
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);
  useEffect(() => {
    // Restoring a minimized call always exposes the controls again.
    setControlsVisible(true);
  }, [minimized]);
  const showControls =
    !systemPip && (minimized || controlsVisible || screenReader);
  useEffect(() => {
    if (minimized || !controlsVisible || screenReader || busy) return;
    const timer = setTimeout(() => setControlsVisible(false), 4000);
    return () => clearTimeout(timer);
  }, [minimized, controlsVisible, screenReader, busy, activity]);
  function revealControls() {
    setControlsVisible(true);
    setActivity(value => value + 1);
  }
  async function change(action: () => Promise<unknown>) {
    if (busy) return;
    revealControls();
    setBusy(true);
    try {
      await action();
    } catch (error) {
      report(
        error instanceof Error
          ? error.message
          : 'Could not update the call controls. Please try again.',
      );
    } finally {
      setBusy(false);
    }
  }
  const heading =
    connection === 'reconnecting'
      ? 'Reconnecting…'
      : connection !== 'connected'
      ? 'Connecting…'
      : dentist
      ? 'Your dentist is here'
      : 'Waiting for your dentist';
  const videoStatus =
    connection !== 'connected' || !dentist
      ? heading
      : !meeting.remoteCamera
      ? 'Dentist camera is off'
      : 'Dentist connected. Waiting for video…';
  return (
    <View style={s.call} testID="call-stage">
      <CallChat
        appointmentId={appointmentId}
        client={callChat}
        visible={chatOpen && !minimized && !systemPip}
        onClose={() => setChatOpen(false)}
        onUnread={setUnread}
      />
      <View style={s.remote}>
        {(Platform.OS === 'ios' || hasRemoteVideo) && (
          <sdk.VideoView
            track={displayTile}
            contain={meeting.remoteScreenTrack != null}
            pipEnabled
            style={s.fill}
          />
        )}
        {!hasRemoteVideo && (
          <View testID="call-waiting-state" style={[s.remote, s.placeholder]}>
            <Text style={[s.heading, minimized && s.miniHeading]}>
              {videoStatus}
            </Text>
            {!minimized && (
              <Text style={s.copy}>
                Your room is private to you and your dentist.
              </Text>
            )}
          </View>
        )}
      </View>
      <View
        pointerEvents="none"
        testID="call-self-preview"
        style={[
          s.local,
          {
            right: Math.max(insets.right, 12),
            bottom: Math.max(insets.bottom, 12) + (showControls ? 150 : 12),
          },
          minimized && s.miniLocal,
          systemPip && s.hidden,
        ]}
      >
        {localCameraTrack != null && isCameraEnabled ? (
          <sdk.VideoView track={localCameraTrack} mirror={front} style={s.fill} />
        ) : (
          <Text style={s.copy}>
            {isCameraEnabled ? 'Starting camera…' : 'Camera off'}
          </Text>
        )}
        <Text style={s.you}>You</Text>
      </View>
      <Pressable
        testID="call-video-touch-target"
        disabled={systemPip}
        style={s.tapTarget}
        accessibilityRole="button"
        accessibilityLabel={
          minimized ? 'Restore full-screen call' : 'Show call controls'
        }
        onPress={minimized ? expand : revealControls}
      />
      {showControls && (
        <View
          pointerEvents="box-none"
          testID="call-top-overlay"
          style={[
            s.callHeader,
            {
              paddingTop: Math.max(insets.top, 12),
              paddingLeft: Math.max(insets.left, 20),
              paddingRight: Math.max(insets.right, 20),
            },
            minimized && s.miniCallHeader,
          ]}
        >
          <View pointerEvents="none" style={s.headerCopy}>
            {!minimized && <Text style={s.title}>Video consultation</Text>}
            <Text
              accessibilityLiveRegion="polite"
              style={[s.status, minimized && s.miniStatus]}
            >
              {heading}
            </Text>
          </View>
          {minimized && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Expand call"
              onPress={expand}
              style={s.layoutButton}
            >
              <Maximize2 size={20} color="#fff" />
            </Pressable>
          )}
        </View>
      )}
      {showControls && (
        <View
          testID="call-controls"
          style={[
            s.callFooter,
            {
              paddingBottom: Math.max(insets.bottom, 16),
              paddingLeft: Math.max(insets.left, 12),
              paddingRight: Math.max(insets.right, 12),
            },
            minimized && s.miniCallFooter,
          ]}
        >
          {!minimized && (
            <View style={s.collaboration}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  meeting.screenSharing ? 'Stop sharing screen' : 'Share screen'
                }
                disabled={busy}
                onPress={() =>
                  change(() =>
                    meeting.screenSharing
                      ? meeting.stopScreenShare()
                      : meeting.startScreenShare(),
                  )
                }
              >
                <Text style={s.link}>
                  {meeting.screenSharing ? 'Stop sharing' : 'Share screen'}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open call chat"
                onPress={() => setChatOpen(true)}
              >
                <Text style={s.link}>Chat{unread ? ` (${unread})` : ''}</Text>
              </Pressable>
              {meeting.remoteScreenTrack != null && (
                <Text style={s.status}>Dentist’s screen</Text>
              )}
            </View>
          )}
          <View style={[s.controls, minimized && s.miniControls]}>
            <Control
              compact={minimized}
              label={
                isMicrophoneEnabled ? 'Mute microphone' : 'Unmute microphone'
              }
              on={isMicrophoneEnabled}
              disabled={busy}
              icon={isMicrophoneEnabled ? Mic : MicOff}
              onPress={() => {
                change(() =>
                  meeting.setMicrophoneEnabled(!isMicrophoneEnabled),
                ).catch(() => undefined);
              }}
            />
            {!minimized && (
              <>
                <Control
                  label={isCameraEnabled ? 'Turn camera off' : 'Turn camera on'}
                  on={isCameraEnabled}
                  disabled={busy}
                  icon={isCameraEnabled ? Camera : CameraOff}
                  onPress={() => {
                    change(() =>
                      meeting.setCameraEnabled(!isCameraEnabled),
                    ).catch(() => undefined);
                  }}
                />
                <Control
                  label="Switch camera"
                  on
                  disabled={busy || !isCameraEnabled}
                  icon={RefreshCw}
                  onPress={() => {
                    change(async () => {
                      await meeting.switchCamera();
                      setFront(value => !value);
                    }).catch(() => undefined);
                  }}
                />
              </>
            )}
            <Control
              compact={minimized}
              label="Leave call"
              on
              icon={PhoneOff}
              danger
              onPress={leave}
            />
          </View>
          {!minimized && (
            <Text style={s.footnote}>
              {Platform.OS === 'android'
                ? 'Press your phone’s Back button to minimize the call.'
                : 'Tap the video to show the call controls.'}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}
function Control({
  label,
  on,
  icon: Icon,
  onPress,
  danger,
  disabled,
  compact,
}: {
  compact?: boolean;
  label: string;
  on: boolean;
  icon: typeof Mic;
  onPress: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        s.control,
        compact && s.compactControl,
        !on && s.off,
        danger && s.danger,
        disabled && s.disabled,
      ]}
    >
      <Icon size={23} color="#fff" />
    </Pressable>
  );
}
const s = StyleSheet.create({
  hidden: { display: 'none' },
  disabled: { opacity: 0.4 },
  root: { flex: 1, backgroundColor: '#102B39' },
  layoutButton: { padding: 10 },
  miniHeading: { fontSize: 14 },
  miniLocal: {
    width: 52,
    height: 68,
    right: 8,
    top: 46,
    bottom: undefined,
    borderRadius: 8,
  },
  miniStatus: { fontSize: 11, marginTop: 0 },
  miniControls: { paddingVertical: 6, gap: 20 },
  compactControl: { width: 42, height: 42, borderRadius: 21 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
  },
  title: { color: '#fff', fontSize: 20, fontWeight: '700' },
  link: { color: '#85D6CF', fontSize: 16 },
  lobby: { flex: 1, justifyContent: 'center', padding: 24, gap: 22 },
  avatar: {
    alignSelf: 'center',
    padding: 30,
    borderRadius: 60,
    backgroundColor: '#1B414C',
  },
  heading: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  copy: { color: '#C7D8DE', fontSize: 15, lineHeight: 23, textAlign: 'center' },
  collaboration: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 24,
    paddingTop: 12,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    paddingVertical: 18,
  },
  control: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#27636B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  off: { backgroundColor: '#52616E' },
  danger: { backgroundColor: '#C34F54' },
  notice: {
    color: '#FFE4A1',
    padding: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  callNotice: {
    position: 'absolute',
    top: 100,
    left: 12,
    right: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(16,43,57,0.9)',
  },
  call: { flex: 1 },
  tapTarget: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  callHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 16,
    backgroundColor: 'rgba(0,0,0,0.38)',
  },
  headerCopy: { flex: 1, gap: 4 },
  callFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  miniCallHeader: {
    paddingTop: 6,
    paddingBottom: 6,
    paddingLeft: 10,
    paddingRight: 6,
  },
  miniCallFooter: { paddingBottom: 6, paddingLeft: 6, paddingRight: 6 },
  remote: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#183D4A',
    borderRadius: 0,
    overflow: 'hidden',
    minHeight: 0,
  },
  fill: { width: '100%', height: '100%' },
  placeholder: { flex: 1, justifyContent: 'center', padding: 24, gap: 14 },
  local: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    height: 160,
    width: 110,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#36515B',
    justifyContent: 'center',
  },
  you: {
    position: 'absolute',
    bottom: 8,
    left: 10,
    color: '#fff',
    fontWeight: '600',
  },
  status: { color: '#E3EFF3', fontSize: 14 },
  footnote: {
    textAlign: 'center',
    color: '#C7D8DE',
    fontSize: 12,
    paddingBottom: 8,
  },
});
