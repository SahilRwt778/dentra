import BlobUtil from 'react-native-blob-util';
import { Platform } from 'react-native';
import uuid from 'react-native-uuid';
import type { PatientFile } from '@/api/types';
import { hasNativeModule, requireNativeModule } from './native-modules';

function privateDirectory() {
  return `${BlobUtil.fs.dirs.CacheDir}/dentra-patient-files`;
}
const pending = new Set<Promise<unknown>>();
let generation = 0;

/** Called on logout and startup. Only this feature's private cache is removed. */
export async function clearPrivateFiles() {
  generation++;
  if (!hasNativeModule('ReactNativeBlobUtil')) return;
  await Promise.allSettled([...pending]);
  const directory = privateDirectory();
  if (await BlobUtil.fs.exists(directory)) await BlobUtil.fs.unlink(directory);
}

export async function cachePrivateFile(
  base64: string,
  file: Pick<PatientFile, 'name' | 'mimeType'>,
  stillSignedIn: () => boolean,
) {
  requireNativeModule('ReactNativeBlobUtil');
  const directory = privateDirectory();
  const version = generation;
  const operation = (async () => {
    if (!stillSignedIn())
      throw new Error('Please sign in again to open this file.');
    if (!(await BlobUtil.fs.exists(directory)))
      await BlobUtil.fs.mkdir(directory).catch(async error => {
        if (!(await BlobUtil.fs.exists(directory))) throw error;
      });
    const extension =
      file.mimeType === 'application/pdf'
        ? 'pdf'
        : file.mimeType === 'image/png'
        ? 'png'
        : 'jpg';
    const path = `${directory}/${String(uuid.v4())}.${extension}`;
    await BlobUtil.fs.writeFile(path, base64, 'base64');
    if (version !== generation || !stillSignedIn()) {
      await BlobUtil.fs.unlink(path).catch(() => undefined);
      throw new Error('Please sign in again to open this file.');
    }
    return path;
  })();
  pending.add(operation);
  try {
    return await operation;
  } finally {
    pending.delete(operation);
  }
}

export async function openPrivateFile(path: string, mime: string) {
  requireNativeModule('ReactNativeBlobUtil');
  if (Platform.OS === 'android')
    await BlobUtil.android.actionViewIntent(path, mime);
  else await BlobUtil.ios.openDocument(path);
}
