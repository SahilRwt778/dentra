import { Platform, TurboModuleRegistry } from 'react-native';
import type { PatientFile } from '../types/api';

type BlobModule = typeof import('react-native-blob-util');
function native() {
  if (!TurboModuleRegistry.get('ReactNativeBlobUtil'))
    throw new Error(
      'Please rebuild and install the dentist app to open patient files.',
    );
  // Delay import until the native module is available in the installed binary.
  return (require('react-native-blob-util') as BlobModule).default;
}
function directory() {
  return `${native().fs.dirs.CacheDir}/dentra-dentist-files`;
}
let generation = 0;
let sequence = 0;
let cleanup: Promise<void> = Promise.resolve();
const pending = new Set<Promise<unknown>>();

export function clearPrivateFiles(): Promise<void> {
  generation++;
  if (!TurboModuleRegistry.get('ReactNativeBlobUtil')) return Promise.resolve();
  const writes = [...pending];
  const previous = cleanup;
  const work = (async () => {
    await previous.catch(() => {});
    await Promise.allSettled(writes);
    const fs = native().fs;
    const folder = directory();
    if (await fs.exists(folder)) await fs.unlink(folder);
  })();
  cleanup = work;
  return work;
}
export async function cachePrivateFile(
  base64: string,
  file: Pick<PatientFile, 'mimeType'>,
  stillSignedIn: () => boolean,
): Promise<string> {
  const version = generation;
  const precedingCleanup = cleanup;
  const work = (async () => {
    await precedingCleanup;
    if (!stillSignedIn() || version !== generation)
      throw new Error('Please sign in again to open this file.');
    const fs = native().fs;
    const folder = directory();
    if (!(await fs.exists(folder)))
      await fs.mkdir(folder).catch(async error => {
        if (!(await fs.exists(folder))) throw error;
      });
    const extension =
      file.mimeType === 'application/pdf'
        ? 'pdf'
        : file.mimeType === 'image/png'
        ? 'png'
        : 'jpg';
    // Internal names never include the patient's name or the supplied file name.
    const path = `${folder}/file-${Date.now()}-${++sequence}.${extension}`;
    await fs.writeFile(path, base64, 'base64');
    if (!stillSignedIn() || version !== generation) {
      await fs.unlink(path).catch(() => {});
      throw new Error('Please sign in again to open this file.');
    }
    return path;
  })();
  pending.add(work);
  try {
    return await work;
  } finally {
    pending.delete(work);
  }
}
export async function removePrivateFile(path: string): Promise<void> {
  if (!TurboModuleRegistry.get('ReactNativeBlobUtil')) return;
  if (!path.startsWith(`${directory()}/`) || path.includes('/../')) return;
  const fs = native().fs;
  if (await fs.exists(path)) await fs.unlink(path);
}
export async function openPrivatePdf(path: string): Promise<void> {
  const blob = native();
  if (
    !path.startsWith(`${directory()}/`) ||
    path.includes('/../') ||
    !path.endsWith('.pdf')
  )
    throw new Error('Could not open this report. Please download it again.');
  try {
    if (Platform.OS === 'android')
      await blob.android.actionViewIntent(path, 'application/pdf');
    else await blob.ios.openDocument(path);
  } catch {
    throw new Error(
      'Could not open the report. Check that a PDF viewer is installed, then try again.',
    );
  }
}
