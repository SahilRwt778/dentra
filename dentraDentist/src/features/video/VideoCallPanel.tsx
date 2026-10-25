import React, { useCallback } from 'react';
import { Pressable, StatusBar, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LiveVideoStage } from './LiveVideoStage';
import { VideoLobby } from './VideoLobby';
import { useVideoSession } from './useVideoSession';
import { videoStyles as styles } from './video.styles';

type Props = {
  appointmentId: string;
  patientName: string;
  minimized: boolean;
  systemPip?: boolean;
  minimize: () => void;
  expand: () => void;
  close: () => void;
};
export function VideoCallPanel(props: Props) {
  const call = useVideoSession(props);
  const { connection, sdk, disconnected, connectionFailed, mediaFailed } = call;
  const handleDisconnected = useCallback(() => {
    if (connection) disconnected(connection);
  }, [connection, disconnected]);
  const handleError = useCallback(() => {
    if (connection) connectionFailed(connection);
  }, [connection, connectionFailed]);
  const handleMediaFailure = useCallback(() => {
    if (connection) mediaFailed(connection);
  }, [connection, mediaFailed]);

  return (
    <SafeAreaView
      accessibilityViewIsModal={!props.minimized}
      edges={connection ? [] : ['top', 'bottom', 'left', 'right']}
      style={styles.root}
    >
      {connection && !props.minimized && <StatusBar hidden />}
      {!connection && (
        <View style={styles.header}>
          <Text style={styles.title}>Video consultation</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to appointment"
            onPress={props.close}
          >
            <Text style={styles.link}>Back</Text>
          </Pressable>
        </View>
      )}
      {connection && sdk ? (
        <sdk.VideoRoom
          session={connection}
          audio={connection.media.microphone}
          video={connection.media.camera}
          onDisconnected={handleDisconnected}
          onError={handleError}
          onMediaDeviceFailure={handleMediaFailure}
          onScreenShareFailure={call.report}
        >
          <LiveVideoStage
            sdk={sdk}
            appointmentId={props.appointmentId}
            patientName={props.patientName}
            minimized={props.minimized}
            systemPip={props.systemPip}
            minimize={props.minimize}
            expand={props.expand}
            leave={call.leave}
            report={call.report}
          />
        </sdk.VideoRoom>
      ) : (
        <VideoLobby patientName={props.patientName} call={call} />
      )}
      {call.notice && !props.minimized && !props.systemPip && (
        <Text
          accessibilityRole="alert"
          style={[styles.notice, !!connection && styles.callNotice]}
        >
          {call.notice}
        </Text>
      )}
    </SafeAreaView>
  );
}
