import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import {
  PermissionsAndroid,
  Platform,
  TurboModuleRegistry,
} from 'react-native';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { pick } from '@react-native-documents/picker';
import BlobUtil from 'react-native-blob-util';
import { pickAttachments } from '../src/lib/attachment-picker';
import { cachePrivateFile, clearPrivateFiles } from '../src/lib/private-files';
import { useBookingAttachments } from '../src/hooks/use-booking-attachments';
import type { PatientFile } from '../src/api/types';
import { ATTACHMENTS_UPDATE_MESSAGE } from '../src/lib/native-modules';

const mockUpload = jest.fn(),
  mockRemove = jest.fn();
jest.mock('../src/api/files', () => ({
  useUploadPatientFile: () => mockUpload,
  useRemovePatientFile: () => mockRemove,
}));
const file: PatientFile = {
  id: 'file-1',
  name: 'Tooth.png',
  mimeType: 'image/png',
  sizeBytes: 128,
  appointmentId: null,
  createdAt: '2026-10-18T00:00:00Z',
  expiresAt: '2026-10-19T00:00:00Z',
  appointmentDate: null,
  dentistName: null,
};
const photo = {
  uri: 'file:///private/photo.png',
  fileName: 'Photo.png',
  type: 'image/png',
  fileSize: 128,
};
let tree: Renderer.ReactTestRenderer;
let attachments: ReturnType<typeof useBookingAttachments>;
function Booking() {
  attachments = useBookingAttachments();
  return null;
}
beforeEach(() => {
  jest.clearAllMocks();
  (launchImageLibrary as jest.Mock).mockResolvedValue({ assets: [photo] });
  mockUpload.mockResolvedValue(file);
  mockRemove.mockResolvedValue(undefined);
});
afterEach(async () => {
  await act(async () => tree?.unmount());
  jest.restoreAllMocks();
});

test('picker cancellation leaves the booking untouched', async () => {
  (launchImageLibrary as jest.Mock).mockResolvedValue({ didCancel: true });
  await act(async () => {
    tree = Renderer.create(<Booking />);
  });
  await act(async () => {
    await attachments.choose('photos');
  });
  expect(attachments.items).toEqual([]);
  expect(attachments.isReady).toBe(true);
  expect(mockUpload).not.toHaveBeenCalled();
});
test.each(['camera', 'photos', 'report'] as const)(
  'an older app without the %s native module shows an update message',
  async source => {
    jest.spyOn(TurboModuleRegistry, 'get').mockReturnValue(null);
    await expect(pickAttachments(source, 8)).rejects.toThrow(
      ATTACHMENTS_UPDATE_MESSAGE,
    );
    expect(launchCamera).not.toHaveBeenCalled();
    expect(launchImageLibrary).not.toHaveBeenCalled();
    expect(pick).not.toHaveBeenCalled();
  },
);
test('an older native build can clear its file cache without a module crash', async () => {
  jest.spyOn(TurboModuleRegistry, 'get').mockReturnValue(null);
  await expect(clearPrivateFiles()).resolves.toBeUndefined();
  expect(BlobUtil.fs.exists).not.toHaveBeenCalled();
  await expect(cachePrivateFile('private', file, () => true)).rejects.toThrow(
    ATTACHMENTS_UPDATE_MESSAGE,
  );
});
test('a failed upload blocks confirmation and retry reuses its original key', async () => {
  mockUpload.mockRejectedValueOnce({
    data: { message: 'Connection interrupted' },
  });
  await act(async () => {
    tree = Renderer.create(<Booking />);
  });
  await act(async () => {
    await attachments.choose('photos');
  });
  expect(attachments.isReady).toBe(false);
  expect(attachments.attachmentIds).toEqual([]);
  expect(attachments.items[0].error).toBe('Connection interrupted');
  await act(async () => {
    await attachments.retry(attachments.items[0].key);
  });
  expect(mockUpload.mock.calls[1][1]).toBe(mockUpload.mock.calls[0][1]);
  expect(attachments.isReady).toBe(true);
  expect(attachments.attachmentIds).toEqual(['file-1']);
});
test('partial batch failures retain successful files and removal frees the failed entry', async () => {
  (launchImageLibrary as jest.Mock).mockResolvedValue({
    assets: [photo, { ...photo, uri: 'file:///second.png' }],
  });
  mockUpload
    .mockResolvedValueOnce(file)
    .mockRejectedValueOnce(new Error('Offline'));
  await act(async () => {
    tree = Renderer.create(<Booking />);
  });
  await act(async () => {
    await attachments.choose('photos');
  });
  expect(attachments.attachmentIds).toEqual(['file-1']);
  expect(attachments.isReady).toBe(false);
  await act(async () => {
    await attachments.remove(attachments.items[1].key);
  });
  expect(attachments.isReady).toBe(true);
  expect(mockRemove).not.toHaveBeenCalled();
  await act(async () => {
    await attachments.remove(attachments.items[0].key);
  });
  expect(mockRemove).toHaveBeenCalledWith('file-1');
  expect(attachments.attachmentIds).toEqual([]);
});
test('an upload in progress prevents duplicate picker and upload operations', async () => {
  let finish!: (value: PatientFile) => void;
  mockUpload.mockReturnValue(
    new Promise(resolve => {
      finish = resolve;
    }),
  );
  await act(async () => {
    tree = Renderer.create(<Booking />);
  });
  let operation!: Promise<void>;
  await act(async () => {
    operation = attachments.choose('photos');
  });
  expect(attachments.isBusy).toBe(true);
  await act(async () => {
    await attachments.choose('photos');
  });
  expect(mockUpload).toHaveBeenCalledTimes(1);
  await act(async () => {
    finish(file);
    await operation;
  });
  expect(attachments.isReady).toBe(true);
});
test('file and count limits are checked before any upload', async () => {
  (launchImageLibrary as jest.Mock).mockResolvedValue({
    assets: [{ ...photo, fileSize: 10 * 1024 * 1024 + 1 }],
  });
  await expect(pickAttachments('photos', 8)).rejects.toThrow('10 MB');
  (launchImageLibrary as jest.Mock).mockResolvedValue({
    assets: [photo, photo],
  });
  await expect(pickAttachments('photos', 1)).rejects.toThrow('at most 1');
  await expect(pickAttachments('photos', 0)).rejects.toThrow('eight');
  expect(mockUpload).not.toHaveBeenCalled();
});
test('PDF selection ignores cancellation and rejects files outside the requested type', async () => {
  (pick as jest.Mock).mockRejectedValueOnce({ code: 'OPERATION_CANCELED' });
  expect(await pickAttachments('report', 8)).toEqual([]);
  (pick as jest.Mock).mockResolvedValueOnce([
    {
      uri: 'content://report',
      name: 'report.pdf',
      hasRequestedType: true,
      size: 123,
    },
  ]);
  expect(await pickAttachments('report', 8)).toEqual([
    {
      uri: 'content://report',
      name: 'report.pdf',
      type: 'application/pdf',
      size: 123,
    },
  ]);
  (pick as jest.Mock).mockResolvedValueOnce([
    { uri: 'content://other', hasRequestedType: false },
  ]);
  await expect(pickAttachments('report', 8)).rejects.toThrow('PDF');
});
test('denying Android camera permission does not open the camera', async () => {
  const original = Platform.OS;
  Object.defineProperty(Platform, 'OS', {
    configurable: true,
    value: 'android',
  });
  jest
    .spyOn(PermissionsAndroid, 'request')
    .mockResolvedValue(PermissionsAndroid.RESULTS.DENIED);
  try {
    await expect(pickAttachments('camera', 8)).rejects.toThrow(
      'Allow camera access',
    );
    expect(launchCamera).not.toHaveBeenCalled();
  } finally {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: original,
    });
  }
});
test('downloaded content is written to a private cache using its actual MIME extension', async () => {
  const path = await cachePrivateFile(
    'synthetic-base64',
    { ...file, name: 'misleading.pdf' },
    () => true,
  );
  expect(path).toMatch(/^\/test-cache\/dentra-patient-files\/.*\.png$/);
  expect(BlobUtil.fs.writeFile).toHaveBeenCalledWith(
    path,
    'synthetic-base64',
    'base64',
  );
});
test('logout during a download discards cached content instead of returning a usable path', async () => {
  let signedIn = true;
  (BlobUtil.fs.writeFile as jest.Mock).mockImplementationOnce(async () => {
    signedIn = false;
  });
  await expect(
    cachePrivateFile('private', file, () => signedIn),
  ).rejects.toThrow('sign in');
  expect(BlobUtil.fs.unlink).toHaveBeenCalled();
  (BlobUtil.fs.exists as jest.Mock).mockResolvedValueOnce(true);
  await clearPrivateFiles();
  expect(BlobUtil.fs.unlink).toHaveBeenCalledWith(
    '/test-cache/dentra-patient-files',
  );
});
