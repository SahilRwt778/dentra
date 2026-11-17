import type { Pool } from 'pg';
import { PatientsService } from '../patients/patients.service';
import type { ProfilePhotosService } from './profile-photos.service';

const id = '11111111-1111-4111-8111-111111111111';
const photos = { save: jest.fn(), removeUnused: jest.fn(), url: jest.fn() };
let failure: 'write' | 'commit' | undefined;
const query = jest.fn(async (sql: string) => {
  if (sql.includes('select p.profile_photo_url'))
    return { rows: [{ profile_photo_url: 'previous-photo' }] };
  if (sql.startsWith('update patients set')) {
    if (failure === 'write') throw new Error('Synthetic update failure');
    return { rows: [{ user_id: id, profile_photo_url: 'new-photo' }] };
  }
  if (sql === 'COMMIT' && failure === 'commit')
    throw new Error('Synthetic lost commit response');
  return { rows: [] };
});
const client = { query, release: jest.fn() };
const pool = {
  connect: async () => client,
  query: async () => ({ rows: [{ mobile: '+919999000001' }] }),
} as unknown as Pool;
const service = new PatientsService(
  pool,
  null as never,
  photos as unknown as ProfilePhotosService,
);
const image = { buffer: Buffer.from('synthetic-image') };

beforeEach(() => {
  jest.clearAllMocks();
  failure = undefined;
  photos.save.mockResolvedValue('new-photo');
  photos.removeUnused.mockResolvedValue(undefined);
});

test('deletes the previous patient image only after its replacement commits', async () => {
  await service.update(id, {}, image);
  expect(photos.save).toHaveBeenCalledWith('patient', id, image);
  expect(photos.removeUnused).toHaveBeenCalledWith(
    'patient',
    id,
    'previous-photo',
  );
  const commit =
    query.mock.invocationCallOrder[
      query.mock.calls.findIndex(([sql]) => sql === 'COMMIT')
    ];
  expect(photos.removeUnused.mock.invocationCallOrder[0]).toBeGreaterThan(
    commit,
  );
});

test('a failed patient update deletes only the new file', async () => {
  failure = 'write';
  await expect(service.update(id, {}, image)).rejects.toThrow(
    'Synthetic update failure',
  );
  expect(photos.removeUnused).toHaveBeenCalledTimes(1);
  expect(photos.removeUnused).toHaveBeenCalledWith('patient', id, 'new-photo');
  expect(query).toHaveBeenCalledWith('ROLLBACK');
});

test('a lost COMMIT response retains both images for recovery', async () => {
  failure = 'commit';
  await expect(service.update(id, {}, image)).rejects.toThrow(
    'Synthetic lost commit response',
  );
  expect(photos.removeUnused).not.toHaveBeenCalled();
});

test('rejects simultaneous removal and replacement before saving any file', async () => {
  await expect(
    service.update(id, { removeProfilePhoto: true }, image),
  ).rejects.toThrow('not both');
  expect(photos.save).not.toHaveBeenCalled();
  expect(query).not.toHaveBeenCalled();
});
