import React, { useState, type ReactNode } from 'react';
import {
  Keyboard,
  Modal,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import { ChatPhotoViewer } from './ChatPhotoViewer';

/** A photo opens independently of the appointment or conversation around it. */
export function ProfilePhotoPreview({
  uri,
  name = 'User',
  style,
  children,
}: {
  uri?: string | null;
  name?: string;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const [openedUri, setOpenedUri] = useState<string>();
  const visible = !!uri && openedUri === uri;

  return (
    <>
      {uri ? (
        <Pressable
          style={style}
          accessibilityRole="button"
          accessibilityLabel={`View ${name}'s profile photo`}
          accessibilityHint="Opens the full photo. Pinch to zoom."
          onPress={event => {
            event.stopPropagation();
            Keyboard.dismiss();
            setOpenedUri(uri);
          }}
        >
          {children}
        </Pressable>
      ) : (
        <View style={style}>{children}</View>
      )}
      {visible && (
        <Modal
          visible
          animationType="fade"
          presentationStyle="fullScreen"
          statusBarTranslucent
          navigationBarTranslucent
          onRequestClose={() => setOpenedUri(undefined)}
        >
          <SafeAreaProvider style={styles.screen}>
            <SafeAreaView
              style={styles.screen}
              edges={['top', 'bottom', 'left', 'right']}
            >
              <StatusBar barStyle="light-content" />
              <View style={styles.header}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Close profile photo"
                  style={styles.back}
                  onPress={event => {
                    event.stopPropagation();
                    setOpenedUri(undefined);
                  }}
                >
                  <ArrowLeft size={25} color="#FFFFFF" />
                </Pressable>
                <View style={styles.title}>
                  <Text numberOfLines={1} style={styles.name}>
                    {name}
                  </Text>
                  <Text style={styles.subtitle}>Profile photo</Text>
                </View>
              </View>
              <ChatPhotoViewer
                key={uri}
                uri={uri}
                name={`${name}'s profile photo`}
              />
            </SafeAreaView>
          </SafeAreaProvider>
        </Modal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0E222C' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  back: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { flex: 1, gap: 3 },
  name: { color: '#FFFFFF', fontSize: 18, fontWeight: '600' },
  subtitle: { color: '#BFD1D8', fontSize: 13 },
});
