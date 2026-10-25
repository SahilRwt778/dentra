import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import { Provider } from 'react-redux';
import { Base64 } from 'js-base64';
import BlobUtil from 'react-native-blob-util';
import { useDownloadPatientFile } from '../src/api/files';
import { useDownloadCareDocument } from '../src/api/care-documents';
import type { PatientFile } from '../src/api/types';
import { baseApi } from '../src/api/base-api';
import { store } from '../src/store/store';
import { setAccessToken } from '../src/store/auth-slice';

const mockRefresh = jest.fn();
jest.mock('../src/auth/session', () => ({
  refreshSession: () => mockRefresh(),
}));
const file: PatientFile = {
  id: 'test-file',
  name: 'Photo.jpg',
  mimeType: 'image/jpeg',
  sizeBytes: 4,
  appointmentId: 'test-booking',
  createdAt: '',
  expiresAt: null,
  dentistName: null,
  appointmentDate: null,
};
function token(user: string, version = 1) {
  return `header.${Base64.encodeURI(
    JSON.stringify({ sub: user, sid: 'session', version }),
  )}.signature`;
}
let download: ReturnType<typeof useDownloadPatientFile>,
  downloadDocument: ReturnType<typeof useDownloadCareDocument>,
  tree: Renderer.ReactTestRenderer;
const originalFetch = globalThis.fetch,
  mockFetch = jest.fn();
function Files() {
  download = useDownloadPatientFile();
  downloadDocument = useDownloadCareDocument();
  return null;
}
beforeEach(async () => {
  jest.useFakeTimers({
    doNotFake: ['nextTick', 'queueMicrotask', 'setImmediate'],
  });
  jest.clearAllMocks();
  globalThis.fetch = mockFetch;
  store.dispatch(baseApi.util.resetApiState());
  store.dispatch(setAccessToken(token('patient')));
  await act(async () => {
    tree = Renderer.create(
      <Provider store={store}>
        <Files />
      </Provider>,
    );
  });
});
test.each(['prescription', 'visit-summary'] as const)(
  'a %s PDF uses an authenticated appointment route and the private PDF cache',
  async kind => {
    const sent: Request[] = [];
    mockFetch.mockImplementation(async (request: Request) => {
      sent.push(request);
      return new Response('%PDF-1.4\nsynthetic-test-content', {
        headers: { 'Content-Type': 'application/pdf' },
      });
    });
    let path = '';
    await act(async () => {
      path = await downloadDocument('completed-visit', kind);
    });
    expect(new URL(sent[0].url).pathname).toBe(
      `/appointments/completed-visit/${kind}/pdf`,
    );
    expect(sent[0].headers.get('Authorization')).toBe(
      `Bearer ${token('patient')}`,
    );
    expect(path).toMatch(/\.pdf$/);
    expect(BlobUtil.fs.writeFile).toHaveBeenCalledWith(
      path,
      Base64.encode('%PDF-1.4\nsynthetic-test-content'),
      'base64',
    );
  },
);
afterEach(async () => {
  await act(async () => tree?.unmount());
  await act(async () => {
    store.dispatch(baseApi.util.resetApiState());
    store.dispatch(setAccessToken(null));
    await jest.advanceTimersByTimeAsync(1000);
  });
  jest.clearAllTimers();
  jest.useRealTimers();
  globalThis.fetch = originalFetch;
});
test('private downloads use bearer authentication, refresh once, and save original bytes in private cache', async () => {
  const refreshed = token('patient', 2);
  mockRefresh.mockResolvedValue(refreshed);
  const sent: Request[] = [];
  mockFetch.mockImplementation(async (request: Request) => {
    sent.push(request);
    if (sent.length === 1)
      return new Response(JSON.stringify({ message: 'Expired' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    return new Response(new Uint8Array([255, 216, 255, 1]), {
      headers: { 'Content-Type': 'image/jpeg' },
    });
  });
  let path = '';
  await act(async () => {
    path = await download(file);
  });
  expect(sent).toHaveLength(2);
  expect(new URL(sent[0].url).pathname).toBe(
    '/patient-files/test-file/content',
  );
  expect(new URL(sent[0].url).search).toBe('');
  expect(sent[1].headers.get('Authorization')).toBe(`Bearer ${refreshed}`);
  expect(mockRefresh).toHaveBeenCalledTimes(1);
  expect(BlobUtil.fs.writeFile).toHaveBeenCalledWith(
    path,
    '/9j/AQ==',
    'base64',
  );
});
test('access errors never cache the server error body as a patient document', async () => {
  mockFetch.mockResolvedValue(
    new Response(JSON.stringify({ message: 'No such file.' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
  await act(async () => {
    await expect(download(file)).rejects.toMatchObject({
      status: 404,
      data: { message: 'No such file.' },
    });
  });
  expect(BlobUtil.fs.writeFile).not.toHaveBeenCalled();
});
test('a response that finishes after account switching is discarded', async () => {
  mockFetch.mockImplementation(async () => {
    store.dispatch(setAccessToken(token('other-patient')));
    return new Response(new Uint8Array([255, 216, 255, 1]), {
      headers: { 'Content-Type': 'image/jpeg' },
    });
  });
  await act(async () => {
    await expect(download(file)).rejects.toMatchObject({
      status: 'CUSTOM_ERROR',
    });
  });
  expect(BlobUtil.fs.writeFile).not.toHaveBeenCalled();
});
