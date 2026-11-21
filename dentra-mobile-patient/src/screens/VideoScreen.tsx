import { CallChat } from '@dentra/video/src/CallChat';
import { DismissibleNotice } from '@dentra/video/src/DismissibleNotice';
import { MovableSelfPreview } from '@dentra/video/src/MovableSelfPreview';
import { useMediaControls } from '@dentra/video/src/useMediaControls';
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
  MessageCircle,
  Mic,
  MicOff,
  MonitorOff,
  MonitorUp,
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
        <View style={call.session ? s.callNotice : undefined}>
          <DismissibleNotice
            message={call.notice}
            tone="warning"
            onDismiss={() => call.report('')}
          />
        </View>
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
  const [footerHeight, setFooterHeight] = useState(156);
  const [headerHeight, setHeaderHeight] = useState(84);
  const [previewDragging, setPreviewDragging] = useState(false);
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
  const media = useMediaControls(report);
  const { busy } = media;
  const disconnected = connection !== 'connected';
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
    !systemPip && !minimized && (controlsVisible || screenReader);
  useEffect(() => {
    if (
      minimized ||
      systemPip ||
      chatOpen ||
      previewDragging ||
      !controlsVisible ||
      screenReader ||
      busy
    )
      return;
    const timer = setTimeout(() => setControlsVisible(false), 4000);
    return () => clearTimeout(timer);
  }, [
    minimized,
    systemPip,
    chatOpen,
    previewDragging,
    controlsVisible,
    screenReader,
    busy,
    activity,
  ]);
  function revealControls() {
    setControlsVisible(true);
    setActivity(value => value + 1);
  }
  function toggleControls() {
    if (screenReader) return;
    setControlsVisible(value => !value);
    setActivity(value => value + 1);
  }
  function change(...args: Parameters<typeof media.change>) {
    revealControls();
    return media.change(...args);
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
        onClose={() => {
          setChatOpen(false);
          revealControls();
        }}
        onUnread={setUnread}
        callCamera={{
          enabled: isCameraEnabled,
          setEnabled: meeting.setCameraEnabled,
        }}
      />
      <View style={s.remote}>
        {(Platform.OS === 'ios' || hasRemoteVideo) && (
          <sdk.VideoView
            track={displayTile}
            contain
            pipEnabled
            style={s.fill}
          />
        )}
        {!hasRemoteVideo && (
          <View
            testID="call-waiting-state"
            style={[s.remote, s.placeholder, minimized && s.miniPlaceholder]}
          >
            <Text
              style={[s.heading, minimized && s.miniHeading]}
              numberOfLines={minimized ? 3 : undefined}
            >
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
      <Pressable
        testID="call-video-touch-target"
        disabled={systemPip || (!minimized && screenReader)}
        accessible={minimized || !screenReader}
        style={s.tapTarget}
        accessibilityRole="button"
        accessibilityLabel={
          minimized
            ? 'Restore full-screen call'
            : showControls
            ? 'Hide call controls'
            : 'Show call controls'
        }
        onPress={minimized ? expand : toggleControls}
      />
      <MovableSelfPreview
        testID="call-self-preview"
        hidden={minimized || systemPip}
        topInset={showControls ? headerHeight : 0}
        bottomInset={showControls ? footerHeight : 0}
        onPress={toggleControls}
        onDragChange={setPreviewDragging}
      >
        {localCameraTrack != null && isCameraEnabled ? (
          <sdk.VideoView
            track={localCameraTrack}
            mirror={front}
            contain={false}
            style={s.fill}
          />
        ) : (
          <Text style={s.copy}>
            {isCameraEnabled ? 'Starting camera…' : 'Camera off'}
          </Text>
        )}
      </MovableSelfPreview>
      {showControls && (
        <View
          pointerEvents="box-none"
          testID="call-top-overlay"
          onLayout={event => setHeaderHeight(event.nativeEvent.layout.height)}
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
              {meeting.remoteScreenTrack != null
                ? `${heading} · Dentist’s screen`
                : heading}
            </Text>
          </View>
          {!minimized && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open call chat"
              accessibilityHint={
                unread ? `${unread} unread messages` : undefined
              }
              style={s.headerAction}
              onPress={() => {
                revealControls();
                setChatOpen(true);
              }}
            >
              <MessageCircle size={23} color="#FFFFFF" />
              {unread > 0 && (
                <Text style={s.unreadBadge}>
                  {unread > 99 ? '99+' : unread}
                </Text>
              )}
            </Pressable>
          )}
        </View>
      )}
      {showControls && (
        <View
          pointerEvents="box-none"
          testID="call-controls"
          onLayout={event => {
            if (!minimized) setFooterHeight(event.nativeEvent.layout.height);
          }}
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
          <View
            pointerEvents="box-none"
            style={[s.controls, minimized && s.miniControls]}
          >
            <Control
              compact={minimized}
              label={
                isMicrophoneEnabled ? 'Mute microphone' : 'Unmute microphone'
              }
              on={isMicrophoneEnabled}
              disabled={disconnected}
              busy={media.isBusy('microphone')}
              icon={isMicrophoneEnabled ? Mic : MicOff}
              onPress={() => {
                change('microphone', () =>
                  meeting.setMicrophoneEnabled(!isMicrophoneEnabled),
                ).catch(() => undefined);
              }}
            />
            {!minimized && (
              <>
                <Control
                  label={isCameraEnabled ? 'Turn camera off' : 'Turn camera on'}
                  on={isCameraEnabled}
                  disabled={disconnected}
                  busy={media.isBusy('camera')}
                  icon={isCameraEnabled ? Camera : CameraOff}
                  onPress={() => {
                    change('camera', () =>
                      meeting.setCameraEnabled(!isCameraEnabled),
                    ).catch(() => undefined);
                  }}
                />
                <Control
                  label="Switch camera"
                  on
                  disabled={
                    disconnected || media.isBusy('camera') || !isCameraEnabled
                  }
                  icon={RefreshCw}
                  onPress={() => {
                    change('camera', async () => {
                      await meeting.switchCamera();
                      setFront(value => !value);
                    }).catch(() => undefined);
                  }}
                />
                <Control
                  label={
                    meeting.screenSharing
                      ? 'Stop sharing screen'
                      : 'Share screen'
                  }
                  on
                  selected={!!meeting.screenSharing}
                  icon={meeting.screenSharing ? MonitorOff : MonitorUp}
                  disabled={disconnected}
                  busy={media.isBusy('screenShare')}
                  onPress={() => {
                    change('screenShare', () =>
                      meeting.screenSharing
                        ? meeting.stopScreenShare()
                        : meeting.startScreenShare(),
                    ).catch(() => undefined);
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
  busy = false,
  selected,
}: {
  compact?: boolean;
  label: string;
  on: boolean;
  icon: typeof Mic;
  onPress: () => void;
  danger?: boolean;
  disabled?: boolean;
  busy?: boolean;
  selected?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled || busy, busy, selected }}
      disabled={disabled || busy}
      onPress={onPress}
      style={[
        s.control,
        compact && s.compactControl,
        !on && s.off,
        danger && s.danger,
        selected && s.sharingButton,
        disabled && s.disabled,
      ]}
    >
      <Icon size={23} color="#fff" />
    </Pressable>
  );
}
const s = StyleSheet.create({
  disabled: { opacity: 0.4 },
  root: { flex: 1, backgroundColor: '#102B39' },
  layoutButton: { padding: 10 },
  miniHeading: { fontSize: 12, lineHeight: 16 },
  miniPlaceholder: { padding: 8, gap: 0 },
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
  headerAction: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#27636B',
    borderWidth: 1,
    borderColor: '#42606A',
  },
  sharingButton: { backgroundColor: '#0D7870', borderColor: '#85D6CF' },
  unreadBadge: {
    position: 'absolute',
    right: -5,
    top: -5,
    minWidth: 19,
    height: 19,
    paddingHorizontal: 4,
    borderRadius: 10,
    backgroundColor: '#C53232',
    color: '#FFFFFF',
    fontSize: 10,
    lineHeight: 19,
    fontWeight: '700',
    textAlign: 'center',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    alignSelf: 'center',
    width: '100%',
    maxWidth: 420,
    gap: 8,
    paddingVertical: 18,
  },
  control: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#27636B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  off: { backgroundColor: '#52616E' },
  danger: { backgroundColor: '#C34F54' },
  callNotice: {
    position: 'absolute',
    top: 100,
    left: 12,
    right: 12,
    borderRadius: 12,
    overflow: 'hidden',
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
  status: { color: '#E3EFF3', fontSize: 14 },
  footnote: {
    textAlign: 'center',
    color: '#C7D8DE',
    fontSize: 12,
    paddingBottom: 8,
  },
});
