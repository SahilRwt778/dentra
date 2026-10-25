import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { VideoCallPanel } from '@/screens/VideoScreen';
import { MovableCallWindow } from './MovableCallWindow';
import { useSystemPictureInPicture } from './background-call';

const VideoCallContext = createContext<{
  open: (appointmentId: string) => void;
} | null>(null);

/** The room belongs to the authenticated navigator, not an individual screen. */
export function VideoCallProvider({ children }: { children: ReactNode }) {
  const [appointmentId, setAppointmentId] = useState<string>();
  const [minimized, setMinimized] = useState(false);
  const systemPip = useSystemPictureInPicture();
  const minimize = useCallback(() => setMinimized(true), []);
  const expand = useCallback(() => setMinimized(false), []);
  const close = useCallback(() => {
    setAppointmentId(undefined);
    setMinimized(false);
  }, []);
  const open = useCallback(
    (id: string) => {
      if (appointmentId && appointmentId !== id) {
        Alert.alert(
          'A consultation is open',
          'Finish or leave your current consultation before opening another appointment.',
        );
        setMinimized(false);
        return;
      }
      setAppointmentId(id);
      setMinimized(false);
    },
    [appointmentId],
  );
  return (
    <VideoCallContext value={{ open }}>
      <View style={styles.root}>
        <View
          style={styles.root}
          accessibilityElementsHidden={!!appointmentId && !minimized}
          importantForAccessibility={
            appointmentId && !minimized ? 'no-hide-descendants' : 'auto'
          }
        >
          {children}
        </View>
        {appointmentId && (
          <MovableCallWindow
            key={appointmentId}
            minimized={minimized}
            systemPip={systemPip}
          >
            <VideoCallPanel
              key={appointmentId}
              appointmentId={appointmentId}
              minimized={minimized}
              systemPip={systemPip}
              onMinimize={minimize}
              onExpand={expand}
              onClose={close}
            />
          </MovableCallWindow>
        )}
      </View>
    </VideoCallContext>
  );
}

export function useVideoCall() {
  const value = useContext(VideoCallContext);
  if (!value) throw new Error('VideoCallProvider is missing');
  return value;
}
const styles = StyleSheet.create({
  root: { flex: 1 },
});
