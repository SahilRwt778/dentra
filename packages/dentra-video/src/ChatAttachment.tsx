import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { FileText, ImageOff, Download } from 'lucide-react-native';
import {
  attachmentSize,
  useChatPhoto,
  type ChatAttachment as Attachment,
  type ChatMediaLoader,
} from '@dentra/call-core';
import { AppImage } from './AppImage';

export function ChatAttachment({
  file,
  loader,
  visible,
  opening,
  onOpen,
}: {
  file: Attachment;
  loader: ChatMediaLoader;
  visible: boolean;
  opening: boolean;
  onOpen(): void;
}) {
  const photo = useChatPhoto(loader, file, visible);
  const { width } = useWindowDimensions();
  const image = file.mimeType.startsWith('image/');
  const previewWidth = Math.min(240, width - 88);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${
        photo.error ? 'Retry photo' : image ? 'View photo' : 'Open PDF'
      }: ${file.name}`}
      accessibilityHint={
        image
          ? 'Opens a full-screen photo with zoom controls.'
          : 'Opens the document in your phone’s viewer.'
      }
      disabled={opening}
      onPress={photo.error ? photo.retry : onOpen}
      style={
        image
          ? [styles.photo, { width: previewWidth, height: previewWidth * 0.75 }]
          : styles.document
      }
    >
      {image ? (
        photo.uri ? (
          <AppImage
            source={{ uri: photo.uri }}
            objectFit="contain"
            style={styles.image}
            accessibilityLabel={file.name}
            onError={photo.fail}
          />
        ) : (
          <View style={styles.placeholder}>
            {photo.error ? (
              <ImageOff size={26} color="#547069" />
            ) : (
              <ActivityIndicator color="#0D7870" />
            )}
            <Text style={styles.hint}>
              {photo.error
                ? 'Photo unavailable · Tap to retry'
                : 'Loading photo…'}
            </Text>
          </View>
        )
      ) : (
        <>
          <View style={styles.pdf}>
            <FileText size={26} color="#BD4C47" />
            <Text style={styles.pdfLabel}>PDF</Text>
          </View>
          <View style={styles.details}>
            <Text numberOfLines={2} style={styles.name}>
              {file.name}
            </Text>
            <Text style={styles.hint}>
              PDF · {attachmentSize(file.sizeBytes)}
            </Text>
            <Text style={styles.action}>
              {opening ? 'Opening…' : 'Open document'}
            </Text>
          </View>
          {opening ? (
            <ActivityIndicator color="#0D7870" />
          ) : (
            <Download size={20} color="#0D7870" />
          )}
        </>
      )}
      {image && opening && (
        <View style={styles.progress}>
          <ActivityIndicator color="#FFFFFF" />
        </View>
      )}
    </Pressable>
  );
}
const styles = StyleSheet.create({
  photo: {
    maxWidth: '100%',
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#DCE8E5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: { width: '100%', height: '100%' },
  placeholder: { alignItems: 'center', gap: 10, padding: 14 },
  progress: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#102B3955',
    justifyContent: 'center',
    alignItems: 'center',
  },
  document: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: 250,
    maxWidth: '100%',
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#EDF3F1',
  },
  pdf: { alignItems: 'center', gap: 3 },
  pdfLabel: { color: '#BD4C47', fontSize: 10, fontWeight: '700' },
  details: { flex: 1, gap: 4 },
  name: { color: '#122B39', fontSize: 14, fontWeight: '600' },
  hint: { color: '#547069', fontSize: 11, textAlign: 'left' },
  action: { color: '#0D7870', fontSize: 12, fontWeight: '600' },
});
