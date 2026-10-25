import { CallChat } from '@dentra/video/src/CallChat';
import { callChat } from '../../api/call-chat.api';
import React, { useEffect, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Camera,
  CameraOff,
  Maximize2,
  Mic,
  MicOff,
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
  const controls = useCallControls(minimized, report);
  const heading =
    connection === 'reconnecting'
      ? 'Reconnecting…'
      : connection !== 'connected'
      ? 'Connecting…'
      : hasPatient
      ? 'Patient connected'
      : 'Waiting for the patient';
  const disabled = controls.busy || connection !== 'connected';
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
    controls.change(() => meeting.setMicrophoneEnabled(!isMicrophoneEnabled));
  }
  function toggleCamera() {
    controls.change(() => meeting.setCameraEnabled(!isCameraEnabled));
  }
  function switchCamera() {
    controls.change(async () => {
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
        onClose={() => setChatOpen(false)}
        onUnread={setUnread}
      />
      <View style={styles.remote}>
        {(Platform.OS === 'ios' || displayTile != null) && (
          <sdk.VideoView
            track={displayTile}
            contain={meeting.remoteScreenTrack != null}
            pipEnabled
            style={styles.fill}
          />
        )}
        {displayTile == null && (
          <View
            testID="video-waiting-state"
            style={[styles.remote, styles.placeholder]}
          >
            <Text style={[styles.heading, minimized && styles.miniHeading]}>
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
            bottom: Math.max(insets.bottom, 12) + (controls.visible ? 145 : 12),
          },
          minimized && styles.miniLocal,
          systemPip && styles.hidden,
        ]}
      >
        {localCameraTrack != null && isCameraEnabled ? (
          <sdk.VideoView
            track={localCameraTrack}
            mirror={frontCamera}
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
        disabled={systemPip}
        testID="video-touch-target"
        style={styles.tapTarget}
        accessibilityRole="button"
        accessibilityLabel={
          minimized ? 'Restore full-screen call' : 'Show call controls'
        }
        onPress={minimized ? expand : controls.reveal}
      />
      {controls.visible && !systemPip && (
        <>
          <View
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
              {!minimized && <Text style={styles.title}>{patientName}</Text>}
              <Text
                accessibilityLiveRegion="polite"
                style={[styles.status, minimized && styles.miniStatus]}
              >
                {heading}
              </Text>
            </View>
            {minimized && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Expand call"
                onPress={expand}
                style={styles.layoutButton}
              >
                <Maximize2 size={20} color="#FFFFFF" />
              </Pressable>
            )}
          </View>
          <View
            testID="video-call-controls"
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
            {!minimized && (
              <View style={styles.collaboration}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    sharing ? 'Stop sharing screen' : 'Share screen'
                  }
                  disabled={disabled}
                  onPress={() =>
                    controls.change(() =>
                      sharing
                        ? meeting.stopScreenShare()
                        : meeting.startScreenShare(),
                    )
                  }
                >
                  <Text style={styles.link}>
                    {sharing ? 'Stop sharing' : 'Share screen'}
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Open call chat"
                  onPress={() => setChatOpen(true)}
                >
                  <Text style={styles.link}>
                    Chat{unread ? ` (${unread})` : ''}
                  </Text>
                </Pressable>
                {meeting.remoteScreenTrack != null && (
                  <Text style={styles.status}>Patient’s screen</Text>
                )}
              </View>
            )}
            <View style={[styles.controls, minimized && styles.miniControls]}>
              <CallControl
                compact={minimized}
                label={
                  isMicrophoneEnabled ? 'Mute microphone' : 'Unmute microphone'
                }
                icon={isMicrophoneEnabled ? Mic : MicOff}
                active={isMicrophoneEnabled}
                disabled={disabled}
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
                    disabled={disabled}
                    onPress={toggleCamera}
                  />
                  <CallControl
                    label="Switch camera"
                    icon={RefreshCw}
                    disabled={disabled || !isCameraEnabled}
                    onPress={switchCamera}
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
