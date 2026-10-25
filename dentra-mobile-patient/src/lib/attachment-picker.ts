import { PermissionsAndroid, Platform } from 'react-native';
import { requireNativeModule } from './native-modules';

export type AttachmentSource = 'camera' | 'photos' | 'report';
export type LocalAttachment = {
  uri: string;
  name: string;
  type: string;
  size?: number | null;
};
export const MAX_ATTACHMENTS = 8;
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

export async function pickAttachments(
  source: AttachmentSource,
  remaining: number,
): Promise<LocalAttachment[]> {
  if (remaining <= 0)
    throw new Error('You can attach up to eight files to a booking.');
  if (source === 'report') {
    requireNativeModule('RNDocumentPicker');
    // Load after the availability check: this package enforces native linking at import.
    const { errorCodes, isErrorWithCode, pick, types } =
      require('@react-native-documents/picker') as typeof import('@react-native-documents/picker');
    try {
      const files = await pick({
        type: [types.pdf],
        allowMultiSelection: true,
        mode: 'import',
      });
      if (files.some(file => !file.hasRequestedType))
        throw new Error('Choose a PDF report.');
      return validate(
        files.map(file => ({
          uri: file.uri,
          name: file.name || 'Report.pdf',
          type: 'application/pdf',
          size: file.size,
        })),
        remaining,
      );
    } catch (error) {
      if (
        isErrorWithCode(error) &&
        error.code === errorCodes.OPERATION_CANCELED
      )
        return [];
      throw error;
    }
  }
  requireNativeModule('ImagePicker');
  if (source === 'camera' && Platform.OS === 'android') {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.CAMERA,
    );
    if (granted !== PermissionsAndroid.RESULTS.GRANTED)
      throw new Error(
        'Allow camera access in your phone settings to take a photo. You can also choose an existing photo.',
      );
  }
  const options = {
    mediaType: 'photo' as const,
    quality: 0.8 as const,
    maxWidth: 2400,
    maxHeight: 2400,
    assetRepresentationMode: 'compatible' as const,
    selectionLimit: remaining,
    includeExtra: false,
  };
  const { launchCamera, launchImageLibrary } =
    require('react-native-image-picker') as typeof import('react-native-image-picker');
  const result =
    source === 'camera'
      ? await launchCamera(options)
      : await launchImageLibrary(options);
  if (result.didCancel) return [];
  if (result.errorCode)
    throw new Error(
      result.errorCode === 'permission'
        ? 'Allow photo or camera access in your phone settings.'
        : 'Could not open the camera or photo library. Please try again.',
    );
  return validate(
    (result.assets ?? []).map(asset => ({
      uri: asset.uri || '',
      name: asset.fileName || 'Photo.jpg',
      type: asset.type || 'image/jpeg',
      size: asset.fileSize,
    })),
    remaining,
  );
}

function validate(files: LocalAttachment[], remaining: number) {
  if (files.length > remaining)
    throw new Error(
      `Choose at most ${remaining} more file${remaining === 1 ? '' : 's'}.`,
    );
  if (
    files.some(
      file =>
        !file.uri ||
        !['image/jpeg', 'image/png', 'application/pdf'].includes(file.type),
    )
  )
    throw new Error('Choose JPEG/PNG photos or PDF reports.');
  if (
    files.some(
      file =>
        file.size != null && (file.size <= 0 || file.size > MAX_FILE_BYTES),
    )
  )
    throw new Error('Each file must be no larger than 10 MB.');
  return files;
}
