import {
  PermissionsAndroid,
  Platform,
  TurboModuleRegistry,
} from 'react-native';
import type { ChatFile } from '@dentra/call-core';

export type ChatAttachmentSource = 'photos' | 'camera' | 'file';

export async function pickChatFile(
  source: ChatAttachmentSource
): Promise<ChatFile | undefined> {
  let file: ChatFile | undefined;
  if (source === 'photos' || source === 'camera') {
    if (!TurboModuleRegistry.get('ImagePicker'))
      throw new Error('Update the app to share photos.');
    if (source === 'camera' && Platform.OS === 'android') {
      const permission = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.CAMERA
      );
      if (permission !== PermissionsAndroid.RESULTS.GRANTED)
        throw new Error(
          'Allow camera access in your phone settings to take a photo.'
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
        : await launchImageLibrary({ ...options, selectionLimit: 1 });
    if (result.didCancel) return;
    if (result.errorCode)
      throw new Error(
        result.errorCode === 'camera_unavailable'
          ? 'No camera is available on this device. Choose a photo from Gallery.'
          : 'Could not open the camera or gallery. Check permissions and try again.'
      );
    const item = result.assets?.[0];
    if (item?.uri)
      file = {
        uri: item.uri,
        name: item.fileName ?? 'Photo.jpg',
        type: item.type ?? 'image/jpeg',
        size: item.fileSize,
      };
  } else {
    if (!TurboModuleRegistry.get('RNDocumentPicker'))
      throw new Error('Update the app to share files.');
    const { pick, types, isErrorWithCode, errorCodes } =
      require('@react-native-documents/picker') as typeof import('@react-native-documents/picker');
    try {
      const [item] = await pick({
        type: ['image/jpeg', 'image/png', types.pdf],
        allowMultiSelection: false,
        mode: 'import',
      });
      if (item && !item.hasRequestedType)
        throw new Error('Choose a JPEG/PNG photo or PDF report.');
      if (item?.uri)
        file = {
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
        };
    } catch (error) {
      if (
        !isErrorWithCode(error) ||
        error.code !== errorCodes.OPERATION_CANCELED
      )
        throw error;
    }
  }
  if (
    file &&
    (!['image/jpeg', 'image/png', 'application/pdf'].includes(file.type) ||
      (file.size != null && (file.size <= 0 || file.size > 10 * 1024 * 1024)))
  )
    throw new Error('Choose a JPEG/PNG photo or PDF no larger than 10 MB.');
  return file;
}
