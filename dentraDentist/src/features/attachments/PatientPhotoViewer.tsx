import React from 'react';
import {
  Image,
  Modal,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { colors } from '../../common/theme/theme';

export type PatientPhoto = { path: string; name: string };

export function PatientPhotoViewer({
  photo,
  onClose,
  onError,
}: {
  photo: PatientPhoto | null;
  onClose: () => void;
  onError: (path: string) => void;
}) {
  return (
    <Modal
      visible={!!photo}
      animationType="fade"
      presentationStyle="fullScreen"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      {/* A native modal needs its own safe-area root, separate from the app's window. */}
      <SafeAreaProvider style={styles.background}>
        <SafeAreaView
          edges={['top', 'right', 'bottom', 'left']}
          style={styles.screen}
        >
          {photo && (
            <>
              <StatusBar barStyle="light-content" />
              <View style={styles.header}>
                <View style={styles.title}>
                  <Text style={styles.heading}>Patient photo</Text>
                  <Text
                    style={styles.filename}
                    numberOfLines={1}
                    ellipsizeMode="middle"
                  >
                    {photo.name}
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Close patient photo"
                  onPress={onClose}
                  hitSlop={4}
                  style={styles.close}
                >
                  <X size={23} color={colors.surface} />
                </Pressable>
              </View>
              <View style={styles.stage}>
                <Image
                  accessibilityLabel={photo.name}
                  source={{ uri: `file://${photo.path}` }}
                  resizeMode="contain"
                  style={StyleSheet.absoluteFill}
                  onError={() => onError(photo.path)}
                />
              </View>
            </>
          )}
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1, backgroundColor: '#0E222C' },
  screen: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 16,
  },
  title: { flex: 1, minWidth: 0, gap: 4 },
  heading: { fontSize: 17, fontWeight: '600', color: colors.surface },
  filename: { fontSize: 12, lineHeight: 18, color: '#C3D3D8' },
  close: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stage: {
    flex: 1,
    marginHorizontal: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
});
