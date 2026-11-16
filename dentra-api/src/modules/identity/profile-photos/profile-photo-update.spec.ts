import type { Pool } from 'pg';
import { DentistsService } from '../dentists/dentists.service';
import type { ProfilePhotosService } from './profile-photos.service';

const id = '11111111-1111-4111-8111-111111111111';
const photos = {
  save: jest.fn(),
  removeUnused: jest.fn(),
  url: jest.fn(() => '/image'),
};
let failure: 'write' | 'commit' | undefined;
const query = jest.fn(async (sql: string) => {
  if (sql.includes('select d.profile_photo_url'))
    return {
      rows: [{ status: 'verified', profile_photo_url: 'previous-photo' }],
    };
  if (sql.startsWith('update dentists set')) {
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
  query: async () => ({ rows: [] }),
} as unknown as Pool;
const service = new DentistsService(
  pool,
  null as never,
  null as never,
  null as never,
  null as never,
  photos as unknown as ProfilePhotosService,
);
const save = () =>
  service.updateMe(id, {}, { buffer: Buffer.from('synthetic-image') });

beforeEach(() => {
  jest.clearAllMocks();
  failure = undefined;
  photos.save.mockResolvedValue('new-photo');
  photos.removeUnused.mockResolvedValue(undefined);
});
test('replaces a dentist photo before removing the previous object, after COMMIT', async () => {
  await save();
  expect(photos.removeUnused).toHaveBeenCalledWith(
    'dentist',
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
test('a failed photo update removes only the new image and preserves the previous one', async () => {
  failure = 'write';
  await expect(save()).rejects.toThrow('Synthetic update failure');
  expect(photos.removeUnused).toHaveBeenCalledTimes(1);
  expect(photos.removeUnused).toHaveBeenCalledWith('dentist', id, 'new-photo');
});
test('a lost COMMIT response retains both images', async () => {
  failure = 'commit';
  await expect(save()).rejects.toThrow('Synthetic lost commit response');
  expect(photos.removeUnused).not.toHaveBeenCalled();
});
