import {
  PermissionsAndroid,
  Platform,
  TurboModuleRegistry,
} from 'react-native';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { pick } from '@react-native-documents/picker';
import { pickChatFile, pickChatFiles } from '@dentra/video/src/pickChatFile';

const platform = Object.getOwnPropertyDescriptor(Platform, 'OS')!;
const photo = {
  uri: 'file:///photo.jpg',
  fileName: 'Photo.jpg',
  type: 'image/jpeg',
  fileSize: 256,
};
beforeEach(() => {
  jest.clearAllMocks();
  Object.defineProperty(Platform, 'OS', {
    configurable: true,
    value: 'android',
  });
  jest.spyOn(TurboModuleRegistry, 'get').mockReturnValue({} as never);
  jest
    .spyOn(PermissionsAndroid, 'request')
    .mockResolvedValue(PermissionsAndroid.RESULTS.GRANTED);
  jest.mocked(launchCamera).mockResolvedValue({ assets: [photo] });
  jest.mocked(launchImageLibrary).mockResolvedValue({ assets: [photo] });
});
afterEach(() => {
  jest.restoreAllMocks();
  Object.defineProperty(Platform, 'OS', platform);
});

test('camera requests permission and returns a private photo without saving it to the gallery', async () => {
  await expect(pickChatFile('camera')).resolves.toMatchObject({
    uri: photo.uri,
    type: 'image/jpeg',
  });
  expect(PermissionsAndroid.request).toHaveBeenCalledWith(
    PermissionsAndroid.PERMISSIONS.CAMERA,
  );
  expect(launchCamera).toHaveBeenCalledWith(
    expect.objectContaining({ saveToPhotos: false, mediaType: 'photo' }),
  );
  expect(launchImageLibrary).not.toHaveBeenCalled();
});

test('camera permission denial does not launch the camera', async () => {
  jest
    .mocked(PermissionsAndroid.request)
    .mockResolvedValue(PermissionsAndroid.RESULTS.DENIED);
  await expect(pickChatFile('camera')).rejects.toThrow('Allow camera access');
  expect(launchCamera).not.toHaveBeenCalled();
});

test('camera cancellation leaves the draft without a replacement attachment', async () => {
  jest.mocked(launchCamera).mockResolvedValue({ didCancel: true });
  await expect(pickChatFile('camera')).resolves.toBeUndefined();
});

test('gallery selection does not request camera access', async () => {
  await expect(pickChatFile('photos')).resolves.toMatchObject({
    uri: photo.uri,
  });
  expect(PermissionsAndroid.request).not.toHaveBeenCalled();
  expect(launchCamera).not.toHaveBeenCalled();
});

test('gallery can choose three photos or only the remaining spaces in the draft', async () => {
  jest
    .mocked(launchImageLibrary)
    .mockResolvedValueOnce({
      assets: [
        photo,
        { ...photo, uri: 'file:///two.jpg' },
        { ...photo, uri: 'file:///three.jpg' },
      ],
    });
  expect(await pickChatFiles('photos')).toHaveLength(3);
  expect(launchImageLibrary).toHaveBeenLastCalledWith(
    expect.objectContaining({ selectionLimit: 3 }),
  );
  await pickChatFiles('photos', 2);
  expect(launchImageLibrary).toHaveBeenLastCalledWith(
    expect.objectContaining({ selectionLimit: 2 }),
  );
});

test('document picker supports mixed attachments and rejects a selection over three', async () => {
  const selected = [1, 2, 3].map(index => ({
    uri: `content://report-${index}`,
    name: `Report-${index}.pdf`,
    type: 'application/pdf',
    size: 128,
    hasRequestedType: true,
  }));
  (pick as jest.Mock).mockResolvedValueOnce(selected);
  expect(await pickChatFiles('file')).toHaveLength(3);
  expect(pick).toHaveBeenLastCalledWith(
    expect.objectContaining({ allowMultiSelection: true }),
  );
  (pick as jest.Mock).mockResolvedValueOnce([...selected, selected[0]]);
  await expect(pickChatFiles('file')).rejects.toThrow('up to 3');
});

test('file selection accepts PDF reports and images using the existing MIME and size limits', async () => {
  (pick as jest.Mock).mockResolvedValue([
    {
      uri: 'content://report',
      name: 'Report.pdf',
      type: 'application/pdf',
      size: 128,
      hasRequestedType: true,
    },
  ]);
  await expect(pickChatFile('file')).resolves.toMatchObject({
    type: 'application/pdf',
    name: 'Report.pdf',
  });
  (pick as jest.Mock).mockResolvedValue([
    {
      uri: 'content://photo',
      name: 'Photo.png',
      type: 'image/png',
      size: 128,
      hasRequestedType: true,
    },
  ]);
  await expect(pickChatFile('file')).resolves.toMatchObject({
    type: 'image/png',
  });
  (pick as jest.Mock).mockResolvedValue([
    {
      uri: 'content://other',
      name: 'Other.zip',
      type: 'application/zip',
      size: 128,
      hasRequestedType: false,
    },
  ]);
  await expect(pickChatFile('file')).rejects.toThrow('JPEG/PNG');
});

test('oversized photos and unsupported formats cannot enter the chat draft', async () => {
  jest
    .mocked(launchCamera)
    .mockResolvedValue({ assets: [{ ...photo, fileSize: 11 * 1024 * 1024 }] });
  await expect(pickChatFile('camera')).rejects.toThrow('10 MB');
  jest
    .mocked(launchImageLibrary)
    .mockResolvedValue({ assets: [{ ...photo, type: 'image/gif' }] });
  await expect(pickChatFile('photos')).rejects.toThrow('JPEG/PNG');
});
