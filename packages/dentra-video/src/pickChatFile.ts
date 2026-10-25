import { TurboModuleRegistry } from 'react-native';
import type { ChatFile } from '@dentra/call-core';

export async function pickChatFile(
  source: 'photos' | 'file'
): Promise<ChatFile | undefined> {
  let file: ChatFile | undefined;
  if (source === 'photos') {
    if (!TurboModuleRegistry.get('ImagePicker'))
      throw new Error('Update the app to choose photos.');
    const { launchImageLibrary } =
      require('react-native-image-picker') as typeof import('react-native-image-picker');
    const result = await launchImageLibrary({
      mediaType: 'photo',
      selectionLimit: 1,
      quality: 0.8,
      maxWidth: 2400,
      maxHeight: 2400,
      assetRepresentationMode: 'compatible',
    });
    if (result.didCancel) return;
    if (result.errorCode)
      throw new Error(
        'Could not open the photo library. Check permissions and try again.'
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
      throw new Error('Update the app to choose PDF files.');
    const { pick, types, isErrorWithCode, errorCodes } =
      require('@react-native-documents/picker') as typeof import('@react-native-documents/picker');
    try {
      const [item] = await pick({
        type: [types.pdf],
        allowMultiSelection: false,
        mode: 'import',
      });
      if (item?.uri && item.hasRequestedType)
        file = {
          uri: item.uri,
          name: item.name ?? 'Report.pdf',
          type: 'application/pdf',
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
