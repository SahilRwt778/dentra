import {
  PermissionsAndroid,
  Platform,
  TurboModuleRegistry,
} from 'react-native';
import { CHAT_ATTACHMENT_LIMIT, type ChatFile } from '@dentra/call-core';

export type ChatAttachmentSource = 'photos' | 'camera' | 'file';

export async function pickChatFiles(
  source: ChatAttachmentSource,
  limit = CHAT_ATTACHMENT_LIMIT,
): Promise<ChatFile[]> {
  const maximum = Math.max(1, Math.min(CHAT_ATTACHMENT_LIMIT, limit));
  let files: ChatFile[] = [];
  if (source === 'photos' || source === 'camera') {
    if (!TurboModuleRegistry.get('ImagePicker'))
      throw new Error('Update the app to share photos.');
    if (source === 'camera' && Platform.OS === 'android') {
      const permission = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.CAMERA,
      );
      if (permission !== PermissionsAndroid.RESULTS.GRANTED)
        throw new Error(
          'Allow camera access in your phone settings to take a photo.',
        );
    }
    const { launchCamera, launchImageLibrary } =
      require('react-native-image-picker') as typeof import('react-native-image-picker');
    const options = {
      mediaType: 'photo' as const,
      quality: 0.8 as const,
      maxWidth: 2400,
      maxHeight: 2400,
      assetRepresentationMode: 'compatible' as const,
      includeExtra: false,
    };
    const result =
      source === 'camera'
        ? await launchCamera({
            ...options,
            cameraType: 'back',
            saveToPhotos: false,
          })
        : await launchImageLibrary({ ...options, selectionLimit: maximum });
    if (result.didCancel) return [];
    if (result.errorCode)
      throw new Error(
        result.errorCode === 'camera_unavailable'
          ? 'No camera is available on this device. Choose a photo from Gallery.'
          : 'Could not open the camera or gallery. Check permissions and try again.',
      );
    files = (result.assets ?? []).flatMap(item =>
      item.uri
        ? [
            {
              uri: item.uri,
              name: item.fileName ?? 'Photo.jpg',
              type: item.type ?? 'image/jpeg',
              size: item.fileSize,
            },
          ]
        : [],
    );
  } else {
    if (!TurboModuleRegistry.get('RNDocumentPicker'))
      throw new Error('Update the app to share files.');
    const { pick, types, isErrorWithCode, errorCodes } =
      require('@react-native-documents/picker') as typeof import('@react-native-documents/picker');
    try {
      const selected = await pick({
        type: ['image/jpeg', 'image/png', types.pdf],
        allowMultiSelection: maximum > 1,
        mode: 'import',
      });
      if (selected.some(item => !item.hasRequestedType))
        throw new Error('Choose a JPEG/PNG photo or PDF report.');
      files = selected.flatMap(item =>
        item.uri
          ? [
              {
                uri: item.uri,
                name: item.name ?? 'Report.pdf',
                type:
                  item.type ??
                  (item.name?.match(/\.png$/i)
                    ? 'image/png'
                    : item.name?.match(/\.jpe?g$/i)
                    ? 'image/jpeg'
                    : 'application/pdf'),
                size: item.size,
              },
            ]
          : [],
      );
    } catch (error) {
      if (
        !isErrorWithCode(error) ||
        error.code !== errorCodes.OPERATION_CANCELED
      )
        throw error;
    }
  }
  if (files.length > maximum)
    throw new Error(`Choose up to ${maximum} attachments at a time.`);
  if (
    files.some(
      file =>
        !['image/jpeg', 'image/png', 'application/pdf'].includes(file.type) ||
        (file.size != null && (file.size <= 0 || file.size > 10 * 1024 * 1024)),
    )
  )
    throw new Error('Choose a JPEG/PNG photo or PDF no larger than 10 MB.');
  return files;
}

/** Retained for callers that need exactly one photo. */
export async function pickChatFile(
  source: ChatAttachmentSource,
): Promise<ChatFile | undefined> {
  return (await pickChatFiles(source, 1))[0];
}
