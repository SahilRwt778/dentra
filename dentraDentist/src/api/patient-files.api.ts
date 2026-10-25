import { encode } from 'base64-arraybuffer';
import { api } from './client';
import { session } from '../features/auth/session';
import { cachePrivateFile } from '../common/services/private-files';
import type { PatientFile } from '../common/types/api';

const MAX_BYTES = 10 * 1024 * 1024;
export const patientFilesApi = {
  async list(appointmentId: string, signal?: AbortSignal) {
    const { data } = await api.get<PatientFile[]>(
      `/appointments/${appointmentId}/attachments`,
      { signal },
    );
    return data;
  },
  async download(file: PatientFile, signal?: AbortSignal) {
    const version = session.getVersion();
    const stillSignedIn = () =>
      session.isSignedIn() &&
      version === session.getVersion() &&
      !signal?.aborted;
    const response = await api.get<ArrayBuffer>(
      `/patient-files/${file.id}/content`,
      { responseType: 'arraybuffer', timeout: 60000, signal },
    );
    const mime = String(response.headers['content-type'] ?? '')
      .split(';')[0]
      .trim()
      .toLowerCase();
    if (
      !['image/jpeg', 'image/png', 'application/pdf'].includes(file.mimeType) ||
      mime !== file.mimeType ||
      !(response.data instanceof ArrayBuffer)
    )
      throw new Error(
        'The server did not return a valid patient file. Please try again.',
      );
    if (
      !response.data.byteLength ||
      response.data.byteLength > MAX_BYTES ||
      response.data.byteLength !== file.sizeBytes
    )
      throw new Error('The file is incomplete or too large. Please try again.');
    return cachePrivateFile(encode(response.data), file, stillSignedIn);
  },
};
