import { Platform, TurboModuleRegistry } from 'react-native';
import { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { encode } from 'base64-arraybuffer';
import { api } from '../src/api/client';
import { publicHttp } from '../src/api/http';
import { patientFilesApi } from '../src/api/patient-files.api';
import { session } from '../src/features/auth/session';
import {
  cachePrivateFile,
  clearPrivateFiles,
  openPrivatePdf,
} from '../src/common/services/private-files';
import type { PatientFile } from '../src/common/types/api';

const mockFiles = new Map<string, string>();
const mockFolders = new Set<string>();
const mockFs = {
  dirs: { CacheDir: '/private/test-cache' },
  exists: jest.fn(
    async (path: string) => mockFiles.has(path) || mockFolders.has(path),
  ),
  mkdir: jest.fn(async (path: string) => {
    mockFolders.add(path);
  }),
  writeFile: jest.fn(async (path: string, data: string) => {
    mockFiles.set(path, data);
  }),
  unlink: jest.fn(async (path: string) => {
    mockFiles.delete(path);
    mockFolders.delete(path);
    for (const file of mockFiles.keys())
      if (file.startsWith(`${path}/`)) mockFiles.delete(file);
  }),
};
const mockAndroidOpen = jest.fn().mockResolvedValue(true);
const mockIosOpen = jest.fn().mockResolvedValue(undefined);
jest.mock('react-native-blob-util', () => ({
  __esModule: true,
  default: {
    fs: mockFs,
    android: { actionViewIntent: mockAndroidOpen },
    ios: { openDocument: mockIosOpen },
  },
}));
const file: PatientFile = {
  id: 'file-one',
  appointmentId: 'visit-one',
  name: '../../private-patient-name.jpg',
  mimeType: 'image/jpeg',
  sizeBytes: 4,
  createdAt: '2026-10-18T10:00:00Z',
};
const bytes = new Uint8Array([255, 216, 255, 217]).buffer;
function reply(
  config: InternalAxiosRequestConfig,
  data: unknown = bytes,
  mime = file.mimeType,
  status = 200,
) {
  return {
    config,
    data,
    status,
    statusText: String(status),
    headers: { 'content-type': mime },
  };
}
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => {
    resolve = done;
  });
  return { promise, resolve };
}
let nativeSpy: jest.SpyInstance;
beforeEach(async () => {
  nativeSpy = jest
    .spyOn(TurboModuleRegistry, 'get')
    .mockReturnValue({} as never);
  await session.clear();
  jest.clearAllMocks();
  mockFs.writeFile.mockImplementation(async (path, data) => {
    mockFiles.set(path, data);
  });
  await session.signIn({
    accessToken: 'old-access',
    refreshToken: 'old-refresh',
    expiresInSeconds: 900,
  });
  api.defaults.adapter = async config => reply(config);
});
afterEach(async () => {
  await session.clear();
  nativeSpy.mockRestore();
});

test('authenticated Axios bytes are saved privately with a safe internal name', async () => {
  const requests: InternalAxiosRequestConfig[] = [];
  api.defaults.adapter = async config => {
    requests.push(config);
    return reply(config);
  };
  const path = await patientFilesApi.download(file);
  expect(requests[0].url).toBe('/patient-files/file-one/content');
  expect(requests[0].responseType).toBe('arraybuffer');
  expect(requests[0].headers.get('Authorization')).toBe('Bearer old-access');
  expect(path).toMatch(
    /^\/private\/test-cache\/dentra-dentist-files\/file-[\d-]+\.jpg$/,
  );
  expect(path).not.toContain('patient-name');
  expect(mockFiles.get(path)).toBe(encode(bytes));
  expect(mockFs.writeFile).toHaveBeenCalledWith(path, encode(bytes), 'base64');
});

test('expired access token refreshes through the shared Axios client for a binary download', async () => {
  publicHttp.defaults.adapter = async config =>
    reply(config, {
      accessToken: 'new-access',
      refreshToken: 'new-refresh',
      expiresInSeconds: 900,
    });
  api.defaults.adapter = async config => {
    if (config.headers.get('Authorization') === 'Bearer old-access')
      throw new AxiosError(
        'Expired',
        undefined,
        config,
        undefined,
        reply(config, {}, file.mimeType, 401),
      );
    return reply(config);
  };
  const path = await patientFilesApi.download(file);
  expect(mockFiles.get(path)).toBe(encode(bytes));
  expect(session.getAccessToken()).toBe('new-access');
});

test.each(['forbidden', 'json', 'wrong-size', 'wrong-mime'])(
  'does not write %s responses to disk',
  async reason => {
    api.defaults.adapter = async config => {
      if (reason === 'forbidden')
        throw new AxiosError(
          'Forbidden',
          undefined,
          config,
          undefined,
          reply(config, {}, file.mimeType, 403),
        );
      if (reason === 'json')
        return reply(
          config,
          new Uint8Array(
            Array.from('{"message":"error"}', char => char.charCodeAt(0)),
          ).buffer,
          'application/json' as never,
        );
      if (reason === 'wrong-size')
        return reply(config, new Uint8Array([1]).buffer);
      return reply(config, bytes, 'application/pdf' as never);
    };
    await expect(patientFilesApi.download(file)).rejects.toBeDefined();
    expect(mockFs.writeFile).not.toHaveBeenCalled();
  },
);

test('logout during a binary request prevents any old-session file from being saved', async () => {
  const started = deferred();
  const release = deferred();
  api.defaults.adapter = async config => {
    started.resolve();
    await release.promise;
    return reply(config);
  };
  const result = patientFilesApi.download(file).catch(error => error);
  await started.promise;
  await session.clear();
  release.resolve();
  expect(await result).toMatchObject({ code: 'ERR_CANCELED' });
  expect(mockFiles.size).toBe(0);
});

test('logout during a native cache write removes its output before completing cleanup', async () => {
  const started = deferred();
  const release = deferred();
  mockFs.writeFile.mockImplementationOnce(async (path, value) => {
    started.resolve();
    await release.promise;
    mockFiles.set(path, value);
  });
  const result = patientFilesApi.download(file).catch(error => error);
  await started.promise;
  const logout = session.clear();
  release.resolve();
  await logout;
  expect(await result).toBeInstanceOf(Error);
  expect(mockFiles.size).toBe(0);
});

test('a new cache write waits for an earlier cleanup instead of being deleted by it', async () => {
  const started = deferred();
  const release = deferred();
  mockFs.writeFile.mockImplementationOnce(async (path, value) => {
    started.resolve();
    await release.promise;
    mockFiles.set(path, value);
  });
  const old = cachePrivateFile('old', file, () => true).catch(error => error);
  await started.promise;
  const cleanup = clearPrivateFiles();
  const next = cachePrivateFile('new', file, () => true);
  release.resolve();
  await cleanup;
  expect(await old).toBeInstanceOf(Error);
  const path = await next;
  expect(mockFiles.get(path)).toBe('new');
  expect(mockFiles.size).toBe(1);
});

test('native PDF viewer receives only a path in private cache', async () => {
  const path = await cachePrivateFile(
    'JVBERi0=',
    { mimeType: 'application/pdf' },
    () => true,
  );
  await openPrivatePdf(path);
  if (Platform.OS === 'android')
    expect(mockAndroidOpen).toHaveBeenCalledWith(path, 'application/pdf');
  else expect(mockIosOpen).toHaveBeenCalledWith(path);
  await expect(openPrivatePdf('/outside/untrusted.pdf')).rejects.toThrow();
});

test('an older installed binary gives a rebuild message without importing a missing native module', async () => {
  nativeSpy.mockReturnValue(null);
  await expect(cachePrivateFile('bytes', file, () => true)).rejects.toThrow(
    'rebuild and install',
  );
  expect(mockFs.writeFile).not.toHaveBeenCalled();
  nativeSpy.mockReturnValue({});
});
