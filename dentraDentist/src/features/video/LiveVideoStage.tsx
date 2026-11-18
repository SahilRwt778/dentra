import { CallChat } from '@dentra/video/src/CallChat';
import { callChat } from '../../api/call-chat.api';
import React, { useEffect, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Camera,
  CameraOff,
  MessageCircle,
  Mic,
  MicOff,
  MonitorOff,
  MonitorUp,
  PhoneOff,
  RefreshCw,
} from 'lucide-react-native';
import type { VideoSdk } from '../../common/services/native-video';
import { refreshBackgroundCall } from '../../common/services/background-call';
import { CallControl } from './CallControl';
import { useCallControls } from './useCallControls';
import { videoStyles as styles } from './video.styles';

type Props = {
  sdk: VideoSdk;
  appointmentId: string;
  patientName: string;
  minimized: boolean;
  systemPip?: boolean;
  minimize: () => void;
  expand: () => void;
  leave: () => void;
  report: (message: string) => void;
};
export function LiveVideoStage({
  sdk,
  patientName,
  appointmentId,
  minimized,
  systemPip = false,
  minimize,
  expand,
  leave,
  report,
}: Props) {
  const insets = useSafeAreaInsets();
  const [chatOpen, setChatOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [footerHeight, setFooterHeight] = useState(156);
  const meeting = sdk.useMeeting();
  const {
    connection,
    remotePresent: hasPatient,
    microphone: isMicrophoneEnabled,
    camera: isCameraEnabled,
    remoteCameraTrack,
    localCameraTrack,
  } = meeting;
  const displayTile = meeting.remoteScreenTrack ?? remoteCameraTrack;
  const sharing = !!meeting.screenSharing;
  const [frontCamera, setFrontCamera] = useState(true);
  const controls = useCallControls(minimized, report, chatOpen || systemPip);
  const heading =
    connection === 'reconnecting'
      ? 'Reconnecting…'
      : connection !== 'connected'
      ? 'Connecting…'
      : hasPatient
      ? 'Patient connected'
      : 'Waiting for the patient';
  const disconnected = connection !== 'connected';
  const videoStatus =
    connection !== 'connected' || !hasPatient
      ? heading
      : !meeting.remoteCamera
      ? 'Patient camera is off'
      : 'Waiting for patient video…';
  useEffect(() => {
    refreshBackgroundCall();
  }, [isMicrophoneEnabled, isCameraEnabled]);

  function toggleMicrophone() {
    controls.change('microphone', () =>
      meeting.setMicrophoneEnabled(!isMicrophoneEnabled),
    );
  }
  function toggleCamera() {
    controls.change('camera', () => meeting.setCameraEnabled(!isCameraEnabled));
  }
  function switchCamera() {
    controls.change('camera', async () => {
      await meeting.switchCamera();
      setFrontCamera(value => !value);
    });
  }

  return (
    <View style={styles.stage} testID="video-call-stage">
      <CallChat
        appointmentId={appointmentId}
        client={callChat}
        visible={chatOpen && !minimized && !systemPip}
        onClose={() => {
          setChatOpen(false);
          controls.reveal();
        }}
        onUnread={setUnread}
        callCamera={{
          enabled: isCameraEnabled,
          setEnabled: meeting.setCameraEnabled,
        }}
      />
      <View style={styles.remote}>
        {(Platform.OS === 'ios' || displayTile != null) && (
          <sdk.VideoView
            track={displayTile}
            contain
            pipEnabled
            style={styles.fill}
          />
        )}
        {displayTile == null && (
          <View
            testID="video-waiting-state"
            style={[
              styles.remote,
              styles.placeholder,
              minimized && styles.miniPlaceholder,
            ]}
          >
            <Text
              style={[styles.heading, minimized && styles.miniHeading]}
              numberOfLines={minimized ? 3 : undefined}
            >
              {videoStatus}
            </Text>
            {!minimized && (
              <Text style={styles.copy}>
                {patientName} · Private video consultation
              </Text>
            )}
          </View>
        )}
      </View>
      <View
        pointerEvents="none"
        testID="video-self-preview"
        style={[
          styles.local,
          {
            right: Math.max(insets.right, 12),
            bottom: controls.visible
              ? footerHeight + 12
              : Math.max(insets.bottom, 12) + 12,
          },
          (minimized || systemPip) && styles.hidden,
        ]}
      >
        {localCameraTrack != null && isCameraEnabled ? (
          <sdk.VideoView
            track={localCameraTrack}
            mirror={frontCamera}
            contain
            style={styles.fill}
          />
        ) : (
          <Text style={styles.copy}>
            {isCameraEnabled ? 'Starting camera…' : 'Camera off'}
          </Text>
        )}
        <Text style={styles.you}>You</Text>
      </View>
      <Pressable
        disabled={systemPip || (!minimized && controls.screenReader)}
        accessible={minimized || !controls.screenReader}
        testID="video-touch-target"
        style={styles.tapTarget}
        accessibilityRole="button"
        accessibilityLabel={
          minimized
            ? 'Restore full-screen call'
            : controls.visible
            ? 'Hide call controls'
            : 'Show call controls'
        }
        onPress={minimized ? expand : controls.toggle}
      />
      {controls.visible && !minimized && !systemPip && (
        <>
          <View
            pointerEvents="box-none"
            testID="video-top-overlay"
            style={[
              styles.topOverlay,
              {
                paddingTop: Math.max(insets.top, 12),
                paddingLeft: Math.max(insets.left, 20),
                paddingRight: Math.max(insets.right, 20),
              },
              minimized && styles.miniHeader,
            ]}
          >
            {Platform.OS === 'ios' && !minimized && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Back to appointment, keep call connected"
                onPress={minimize}
                style={styles.layoutButton}
              >
                <ArrowLeft size={22} color="#FFFFFF" />
              </Pressable>
            )}
            <View pointerEvents="none" style={styles.headerCopy}>
              {!minimized && (
                <Text numberOfLines={1} style={styles.title}>
                  {patientName}
                </Text>
              )}
              <Text
                accessibilityLiveRegion="polite"
                style={[styles.status, minimized && styles.miniStatus]}
              >
                {meeting.remoteScreenTrack != null
                  ? `${heading} · Patient’s screen`
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
                style={styles.headerAction}
                onPress={() => {
                  controls.reveal();
                  setChatOpen(true);
                }}
              >
                <MessageCircle size={23} color="#FFFFFF" />
                {unread > 0 && (
                  <Text style={styles.unreadBadge}>
                    {unread > 99 ? '99+' : unread}
                  </Text>
                )}
              </Pressable>
            )}
          </View>
          <View
            pointerEvents="box-none"
            testID="video-call-controls"
            onLayout={event => {
              if (!minimized) setFooterHeight(event.nativeEvent.layout.height);
            }}
            style={[
              styles.footer,
              {
                paddingBottom: Math.max(insets.bottom, 16),
                paddingLeft: Math.max(insets.left, 12),
                paddingRight: Math.max(insets.right, 12),
              },
              minimized && styles.miniFooter,
            ]}
          >
            <View
              pointerEvents="box-none"
              style={[styles.controls, minimized && styles.miniControls]}
            >
              <CallControl
                compact={minimized}
                label={
                  isMicrophoneEnabled ? 'Mute microphone' : 'Unmute microphone'
                }
                icon={isMicrophoneEnabled ? Mic : MicOff}
                active={isMicrophoneEnabled}
                disabled={disconnected}
                busy={controls.isBusy('microphone')}
                onPress={toggleMicrophone}
              />
              {!minimized && (
                <>
                  <CallControl
                    label={
                      isCameraEnabled ? 'Turn camera off' : 'Turn camera on'
                    }
                    icon={isCameraEnabled ? Camera : CameraOff}
                    active={isCameraEnabled}
                    disabled={disconnected}
                    busy={controls.isBusy('camera')}
                    onPress={toggleCamera}
                  />
                  <CallControl
                    label="Switch camera"
                    icon={RefreshCw}
                    disabled={
                      disconnected ||
                      !isCameraEnabled ||
                      controls.isBusy('camera')
                    }
                    onPress={switchCamera}
                  />
                  <CallControl
                    label={sharing ? 'Stop sharing screen' : 'Share screen'}
                    icon={sharing ? MonitorOff : MonitorUp}
                    selected={sharing}
                    disabled={disconnected}
                    busy={controls.isBusy('screenShare')}
                    onPress={() => {
                      controls.change('screenShare', () =>
                        sharing
                          ? meeting.stopScreenShare()
                          : meeting.startScreenShare(),
                      );
                    }}
                  />
                </>
              )}
              <CallControl
                compact={minimized}
                label="Leave call"
                icon={PhoneOff}
                danger
                onPress={leave}
              />
            </View>
            {!minimized && (
              <Text style={styles.footnote}>
                {Platform.OS === 'android'
                  ? 'Press your phone’s Back button to keep the call in a small window.'
                  : 'Back to your appointment keeps the call connected.'}
              </Text>
            )}
          </View>
        </>
      )}
    </View>
  );
}
