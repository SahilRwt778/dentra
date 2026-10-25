import type { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import { DentistsService } from './dentists.service';
import type { DentistDocumentsStorage } from './documents.storage';

const id = randomUUID();
const previous = `/uploads/dentists/${id}/degree.pdf`;
const next = `/uploads/dentists/${id}/degree-new.pdf`;
const documents = { save: jest.fn(), remove: jest.fn() };
let fail: 'insert' | 'commit' | undefined;
const query = jest.fn(async (sql: string) => {
  if (sql.startsWith('select status'))
    return { rows: [{ status: 'draft', submitted_by: 'self' }] };
  if (sql.startsWith('select file_url'))
    return { rows: [{ file_url: previous }] };
  if (sql.includes('insert into dentist_documents')) {
    if (fail === 'insert') throw new Error('Synthetic insert failure');
    return { rows: [{ id: randomUUID(), doc_type: 'degree', file_url: next }] };
  }
  if (sql === 'COMMIT' && fail === 'commit')
    throw new Error('Synthetic lost commit response');
  return { rows: [] };
});
const client = { query, release: jest.fn() };
let service: DentistsService;
beforeEach(() => {
  fail = undefined;
  jest.clearAllMocks();
  documents.save.mockResolvedValue(next);
  documents.remove.mockResolvedValue(undefined);
  service = new DentistsService(
    { connect: async () => client } as unknown as Pool,
    null as never,
    null as never,
    null as never,
    documents as unknown as DentistDocumentsStorage
  );
});
const upload = () =>
  service.uploadDocument(id, 'degree', {
    buffer: Buffer.from('synthetic'),
    originalname: 'degree.pdf',
  });
test('removes the previous object only after the replacement commits', async () => {
  await upload();
  expect(documents.remove).toHaveBeenCalledWith(id, previous);
  const committed =
    query.mock.invocationCallOrder[
      query.mock.calls.findIndex(([sql]) => sql === 'COMMIT')
    ];
  expect(documents.remove.mock.invocationCallOrder[0]).toBeGreaterThan(
    committed
  );
});
test('a failed database write removes only the newly uploaded object', async () => {
  fail = 'insert';
  await expect(upload()).rejects.toThrow('Synthetic insert failure');
  expect(documents.remove).toHaveBeenCalledTimes(1);
  expect(documents.remove).toHaveBeenCalledWith(id, next);
});
test('an ambiguous commit result retains both versions so a saved document is never deleted', async () => {
  fail = 'commit';
  await expect(upload()).rejects.toThrow('Synthetic lost commit response');
  expect(documents.remove).not.toHaveBeenCalled();
});
