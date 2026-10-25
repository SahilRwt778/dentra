import { TurboModuleRegistry } from 'react-native';
import type { LocalDocument } from '../types/api';

export async function chooseDocument(
  imageOnly = false,
): Promise<LocalDocument | null> {
  if (!TurboModuleRegistry.get('RNDocumentPicker'))
    throw new Error(
      'Please rebuild and install the dentist app to enable document uploads.',
    );
  const { pick, types, isErrorWithCode, errorCodes } =
    require('@react-native-documents/picker') as typeof import('@react-native-documents/picker');
  try {
    const [file] = await pick({
      type: imageOnly ? [types.images] : [types.pdf, types.images],
      allowMultiSelection: false,
      mode: 'import',
    });
    if (!file) return null;
    if (
      !file.hasRequestedType ||
      !['image/jpeg', 'image/png', 'application/pdf'].includes(file.type ?? '')
    )
      throw new Error('Choose a JPEG, PNG or PDF file.');
    if (imageOnly && file.type === 'application/pdf')
      throw new Error('Choose a JPEG or PNG photo for your selfie.');
    if (file.size !== null && (file.size <= 0 || file.size > 10 * 1024 * 1024))
      throw new Error('Choose a file no larger than 10 MB.');
    return {
      uri: file.uri,
      name:
        file.name ||
        (file.type === 'application/pdf' ? 'Document.pdf' : 'Photo.jpg'),
      type: file.type!,
      size: file.size,
    };
  } catch (error) {
    if (isErrorWithCode(error) && error.code === errorCodes.OPERATION_CANCELED)
      return null;
    throw error;
  }
}
