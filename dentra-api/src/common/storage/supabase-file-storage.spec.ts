import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';
import type { AppConfig } from '@config/configuration';
import { SupabaseFileStorage } from './supabase-file-storage';

const mockObjects = {
  upload: jest.fn(),
  download: jest.fn(),
  remove: jest.fn(),
};
const mockClient = {
  storage: { getBucket: jest.fn(), from: jest.fn(() => mockObjects) },
};
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockClient),
}));
const config = (provider = 'supabase') =>
  new ConfigService({
    storage: {
      provider,
      url: 'https://synthetic.supabase.co',
      secretKey: 'sb_secret_test_only',
      bucket: 'dentra-private',
    },
  }) as ConfigService<AppConfig>;
let storage: SupabaseFileStorage;
beforeEach(() => {
  jest.clearAllMocks();
  mockClient.storage.getBucket.mockResolvedValue({
    data: { public: false },
    error: null,
  });
  mockObjects.upload.mockResolvedValue({ data: {}, error: null });
  mockObjects.download.mockResolvedValue({
    data: new Blob(['private bytes']),
    error: null,
  });
  mockObjects.remove.mockResolvedValue({ data: [], error: null });
  storage = new SupabaseFileStorage(config());
});

test('uses server-only credentials without an auth session and uploads immutable objects to a verified private bucket', async () => {
  await storage.onApplicationBootstrap();
  await storage.save(
    'patients/test-id',
    Buffer.from('private bytes'),
    'image/png'
  );
  expect(createClient).toHaveBeenCalledWith(
    'https://synthetic.supabase.co',
    'sb_secret_test_only',
    expect.objectContaining({
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    })
  );
  expect(mockObjects.upload).toHaveBeenCalledWith(
    'patients/test-id',
    expect.any(Buffer),
    {
      contentType: 'image/png',
      cacheControl: '0',
      upsert: false,
    }
  );
  await expect(storage.read('patients/test-id')).resolves.toEqual(
    Buffer.from('private bytes')
  );
  expect(mockClient.storage.getBucket).toHaveBeenCalledTimes(1);
});
test('refuses a public bucket before uploading or reading private files', async () => {
  mockClient.storage.getBucket.mockResolvedValue({
    data: { public: true },
    error: null,
  });
  await expect(storage.onApplicationBootstrap()).rejects.toThrow(
    'must be private'
  );
  expect(mockObjects.upload).not.toHaveBeenCalled();
  await expect(storage.read('patients/test-id')).rejects.toThrow(
    'must be private'
  );
  expect(mockObjects.download).not.toHaveBeenCalled();
});
test('retries bucket verification after a failure and keeps provider details out of API errors', async () => {
  mockClient.storage.getBucket.mockRejectedValueOnce(
    new Error('secret request details')
  );
  await expect(storage.read('patients/test-id')).rejects.toThrow(
    'Private file storage is unavailable'
  );
  await expect(storage.read('patients/test-id')).resolves.toBeInstanceOf(
    Buffer
  );
  mockObjects.upload.mockResolvedValue({
    data: null,
    error: { message: 'secret request details' },
  });
  await expect(
    storage.save('patients/test-id', Buffer.from('bytes'), 'image/png')
  ).rejects.not.toThrow('secret request details');
});
test('maps missing objects to the existing file-not-found contract and deletes idempotently', async () => {
  mockObjects.download.mockResolvedValue({
    data: null,
    error: { status: 400, code: 'NoSuchKey' },
  });
  await expect(storage.read('patients/missing')).rejects.toMatchObject({
    code: 'ENOENT',
  });
  mockObjects.remove.mockResolvedValue({ data: null, error: { status: 404 } });
  await expect(storage.remove('patients/missing')).resolves.toBeUndefined();
});
test('rejects unsafe object keys and oversized downloaded files', async () => {
  await expect(storage.read('../private')).rejects.toThrow(
    'Invalid private storage key'
  );
  expect(mockObjects.download).not.toHaveBeenCalled();
  mockObjects.download.mockResolvedValue({
    data: { size: 11 * 1024 * 1024 },
    error: null,
  });
  await expect(storage.read('patients/large')).rejects.toThrow(
    'Private file storage is unavailable'
  );
});
test('local development does not initialize a Supabase client', () => {
  jest.mocked(createClient).mockClear();
  expect(new SupabaseFileStorage(config('local')).isEnabled()).toBe(false);
  expect(createClient).not.toHaveBeenCalled();
});
