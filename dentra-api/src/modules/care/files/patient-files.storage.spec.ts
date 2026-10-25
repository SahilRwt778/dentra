import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import type { SupabaseFileStorage } from '@common/storage/supabase-file-storage';
import { PatientFilesStorage } from './patient-files.storage';

test('patient and chat object IDs use the cloud adapter and detected MIME while preserving their IDs', async () => {
  const id = randomUUID(),
    bytes = Buffer.from('%PDF-1.4\nSynthetic report\n%%EOF');
  const cloud = {
    isEnabled: () => true,
    save: jest.fn().mockResolvedValue(undefined),
    read: jest.fn().mockResolvedValue(bytes),
    remove: jest.fn().mockResolvedValue(undefined),
  };
  const storage = new PatientFilesStorage(
    new ConfigService({ patientFilesDirectory: '/unused' }),
    cloud as unknown as SupabaseFileStorage
  );
  await storage.save(id, bytes);
  expect(cloud.save).toHaveBeenCalledWith(
    `patients/${id}`,
    bytes,
    'application/pdf'
  );
  await expect(storage.read(id)).resolves.toEqual(bytes);
  await storage.remove(id);
  expect(cloud.remove).toHaveBeenCalledWith(`patients/${id}`);
  await expect(storage.save('../outside', bytes)).rejects.toThrow(
    'Invalid storage identifier'
  );
});
