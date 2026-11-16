import React, { useRef, useState } from 'react';
import {
  Image,
  PermissionsAndroid,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TurboModuleRegistry,
  View,
} from 'react-native';
import { Camera, Images, UserRound, X } from 'lucide-react-native';

export type ProfilePhoto = {
  uri: string;
  name: string;
  type: string;
  size?: number;
};

/** Selection stays local until the registration form is submitted. */
export function ProfilePhotoField({
  value,
  onChange,
  disabled = false,
  existingUrl,
}: {
  value: ProfilePhoto | null;
  onChange: (photo: ProfilePhoto | null) => void;
  disabled?: boolean;
  existingUrl?: string | null;
}) {
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string>();
  const lock = useRef(false);
  async function choose(source: 'camera' | 'gallery') {
    if (disabled || lock.current) return;
    lock.current = true;
    setPicking(true);
    setError(undefined);
    try {
      if (!TurboModuleRegistry.get('ImagePicker'))
        throw new Error(
          'Update and reinstall the app to enable profile photos.',
        );
      if (source === 'camera' && Platform.OS === 'android') {
        const permission = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
        );
        if (permission !== PermissionsAndroid.RESULTS.GRANTED)
          throw new Error(
            'Allow camera access in Settings, or choose a photo from your gallery.',
          );
      }
      const { launchCamera, launchImageLibrary } =
        require('react-native-image-picker') as typeof import('react-native-image-picker');
      const options = {
        mediaType: 'photo' as const,
        quality: 0.8 as const,
        maxWidth: 512,
        maxHeight: 512,
        assetRepresentationMode: 'compatible' as const,
        includeExtra: false,
        selectionLimit: 1,
      };
      const result =
        source === 'camera'
          ? await launchCamera({
              ...options,
              cameraType: 'front',
              saveToPhotos: false,
            })
          : await launchImageLibrary(options);
      if (result.didCancel) return;
      if (result.errorCode)
        throw new Error(
          result.errorCode === 'camera_unavailable'
            ? 'No camera is available. Choose a photo from your gallery.'
            : 'Could not open photos. Check camera/photo permissions in Settings and try again.',
        );
      const asset = result.assets?.[0];
      if (!asset?.uri)
        throw new Error('Could not read that photo. Please choose another.');
      if (
        !['image/jpeg', 'image/png'].includes(asset.type ?? '') ||
        (asset.fileSize != null &&
          (asset.fileSize <= 0 || asset.fileSize > 5 * 1024 * 1024))
      )
        throw new Error('Choose a JPEG or PNG photo up to 5 MB.');
      onChange({
        uri: asset.uri,
        name: asset.fileName || 'Profile.jpg',
        type: asset.type!,
        size: asset.fileSize,
      });
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : 'Could not select a profile photo.',
      );
    } finally {
      lock.current = false;
      setPicking(false);
    }
  }
  const uri = value?.uri || existingUrl;
  return (
    <View style={styles.field}>
      <Text style={styles.label}>Profile photo (optional)</Text>
      <View style={styles.row}>
        <View style={styles.preview}>
          {uri ? (
            <Image
              source={{ uri }}
              style={styles.image}
              accessibilityLabel="Profile photo preview"
            />
          ) : (
            <UserRound size={36} color="#0D7870" />
          )}
          {value && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Remove selected profile photo"
              disabled={disabled || picking}
              onPress={() => {
                onChange(null);
                setError(undefined);
              }}
              style={styles.remove}
              hitSlop={6}
            >
              <X size={17} color="#FFFFFF" />
            </Pressable>
          )}
        </View>
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Choose profile photo from gallery"
            disabled={disabled || picking}
            onPress={() => {
              choose('gallery');
            }}
            style={styles.button}
          >
            <Images size={18} color="#0D7870" />
            <Text style={styles.buttonText}>Choose photo</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Take profile photo"
            disabled={disabled || picking}
            onPress={() => {
              choose('camera');
            }}
            style={styles.button}
          >
            <Camera size={18} color="#0D7870" />
            <Text style={styles.buttonText}>Take photo</Text>
          </Pressable>
        </View>
      </View>
      <Text style={styles.hint}>
        {picking ? 'Opening photos…' : 'JPEG or PNG · Up to 5 MB'}
      </Text>
      {!!error && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  field: { gap: 12 },
  label: { color: '#122B39', fontSize: 14, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  preview: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#DCF0ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: { width: 96, height: 96, borderRadius: 48 },
  remove: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#C8322D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: { gap: 8, flexShrink: 1 },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#D6E3E5',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  buttonText: { color: '#0D7870', fontSize: 14, fontWeight: '600' },
  hint: { color: '#5D7280', fontSize: 12 },
  error: { color: '#C8322D', fontSize: 13 },
});
