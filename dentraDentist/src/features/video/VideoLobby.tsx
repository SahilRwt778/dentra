import React from 'react';
import { Linking, ScrollView, Text, View } from 'react-native';
import { Camera, CameraOff, Mic, MicOff, Video } from 'lucide-react-native';
import { Button } from '../../components/ui/Button';
import { ErrorMessage, Loading } from '../../components/ui/Feedback';
import { CallControl } from './CallControl';
import { videoStatusMessage } from './video-status';
import { videoStyles as styles } from './video.styles';
import type { useVideoSession } from './useVideoSession';

type Props = { patientName: string; call: ReturnType<typeof useVideoSession> };
export function VideoLobby({ patientName, call }: Props) {
  const { availability } = call;
  return (
    <ScrollView contentContainerStyle={styles.lobby}>
      <View style={styles.avatar}>
        <Video size={44} color="#85D6CF" />
      </View>
      <Text style={styles.heading}>
        {call.sdk ? patientName : 'Update Dentra to join video calls'}
      </Text>
      <Text style={styles.copy}>
        {call.sdk
          ? videoStatusMessage(availability.data)
          : 'Rebuild and install the latest dentist app, then return to this appointment.'}
      </Text>
      {availability.loading && !availability.data && (
        <Loading text="Checking video availability…" />
      )}
      <Text style={styles.copy}>
        Find a quiet, well-lit place for your consultation.
      </Text>
      <View style={styles.options}>
        <CallControl
          label={
            call.microphone
              ? 'Join with microphone off'
              : 'Join with microphone on'
          }
          icon={call.microphone ? Mic : MicOff}
          active={call.microphone}
          disabled={call.joining}
          onPress={() => call.setMicrophone(value => !value)}
        />
        <CallControl
          label={call.camera ? 'Join with camera off' : 'Join with camera on'}
          icon={call.camera ? Camera : CameraOff}
          active={call.camera}
          disabled={call.joining}
          onPress={() => call.setCamera(value => !value)}
        />
      </View>
      <Button
        title="Start and join video call"
        onPress={call.join}
        loading={call.joining}
        disabled={
          !call.sdk || !availability.data?.canJoin || !!availability.error
        }
      />
      {availability.error && (
        <>
          <ErrorMessage message={availability.error} />
          <Button
            title="Check availability again"
            variant="secondary"
            loading={availability.loading}
            onPress={availability.reload}
          />
        </>
      )}
      {call.permissionDenied && (
        <Button
          title="Open device settings"
          variant="secondary"
          onPress={() => {
            Linking.openSettings().catch(() => {});
          }}
        />
      )}
    </ScrollView>
  );
}
