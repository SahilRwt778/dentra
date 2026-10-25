import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import type { SupabaseFileStorage } from '@common/storage/supabase-file-storage';
import { DentistDocumentsStorage } from './documents.storage';

const dentistId = randomUUID();
const bytes = Buffer.from('%PDF-1.4\nSynthetic private document\n%%EOF');
const cloud = {
  isEnabled: () => true,
  save: jest.fn(),
  read: jest.fn(),
  remove: jest.fn(),
};
let storage: DentistDocumentsStorage;
beforeEach(() => {
  jest.clearAllMocks();
  cloud.save.mockResolvedValue(undefined);
  cloud.read.mockResolvedValue(bytes);
  cloud.remove.mockResolvedValue(undefined);
  storage = new DentistDocumentsStorage(
    new ConfigService(),
    cloud as unknown as SupabaseFileStorage
  );
});
test('uses unique version keys and byte-detected MIME types without trusting the filename', async () => {
  const first = await storage.save(dentistId, 'degree', bytes);
  const second = await storage.save(dentistId, 'degree', bytes);
  expect(first).not.toBe(second);
  expect(first).toMatch(
    new RegExp(`^/uploads/dentists/${dentistId}/degree-[a-f0-9-]+\\.pdf$`)
  );
  expect(cloud.save).toHaveBeenCalledWith(
    first.slice('/uploads/'.length),
    bytes,
    'application/pdf'
  );
  await expect(storage.read(dentistId, first)).resolves.toMatchObject({
    bytes,
    mimeType: 'application/pdf',
  });
});
test('blocks cross-dentist references and path traversal before contacting storage', async () => {
  await expect(
    storage.read(dentistId, `/uploads/dentists/${randomUUID()}/degree.pdf`)
  ).rejects.toThrow('Invalid private document reference');
  await expect(
    storage.read(dentistId, `/uploads/dentists/${dentistId}/../degree.pdf`)
  ).rejects.toThrow('Invalid private document reference');
  expect(cloud.read).not.toHaveBeenCalled();
});
test('keeps legacy document references readable and rejects unsupported new upload bytes', async () => {
  await expect(
    storage.read(dentistId, `/uploads/dentists/${dentistId}/degree.pdf`)
  ).resolves.toMatchObject({ bytes });
  await expect(
    storage.save(dentistId, 'degree', Buffer.from('<html>not a PDF</html>'))
  ).rejects.toThrow('Choose a JPEG/PNG photo or PDF report');
  expect(cloud.save).not.toHaveBeenCalled();
});
