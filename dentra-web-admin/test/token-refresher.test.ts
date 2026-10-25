import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTokenRefresher } from '../src/auth/token-refresher.ts';

const success = (accessToken = 'access-next', refreshToken = 'refresh-next') =>
  Response.json({ accessToken, refreshToken });
function fixture(request: (token: string) => Promise<Response>) {
  let token: string | null = 'refresh-original';
  const saved: string[] = [];
  let clears = 0;
  const refresher = createTokenRefresher({
    readToken: () => token,
    saveToken: (value) => {
      token = value;
      saved.push(value);
    },
    clearToken: () => {
      token = null;
      clears++;
    },
    request,
  });
  return {
    ...refresher,
    saved,
    token: () => token,
    clears: () => clears,
    replace: (value: string | null) => {
      token = value;
    },
  };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((finish) => {
    resolve = finish;
  });
  return { promise, resolve };
}

test('StrictMode restoration and parallel expired requests share exactly one token rotation', async () => {
  const response = deferred<Response>();
  const calls: string[] = [];
  const session = fixture(async (token) => {
    calls.push(token);
    return response.promise;
  });
  const requests = [session.refresh(), session.refresh(), session.refresh()];
  response.resolve(success());
  assert.deepEqual(
    await Promise.all(requests),
    Array(3).fill({ status: 'success', accessToken: 'access-next', refreshToken: 'refresh-next' }),
  );
  assert.deepEqual(calls, ['refresh-original']);
  assert.deepEqual(session.saved, ['refresh-next']);
  assert.equal(session.clears(), 0);
});
test('the next refresh uses the rotated token', async () => {
  const calls: string[] = [];
  const session = fixture(async (token) => {
    calls.push(token);
    return success(`access-${calls.length}`, `refresh-${calls.length}`);
  });
  await session.refresh();
  await session.refresh();
  assert.deepEqual(calls, ['refresh-original', 'refresh-1']);
});
test('a network outage preserves the refresh token and supports retry', async () => {
  let online = false;
  const session = fixture(async () => {
    if (!online) throw new Error('offline');
    return success();
  });
  assert.deepEqual(await session.refresh(), { status: 'temporary' });
  assert.equal(session.token(), 'refresh-original');
  online = true;
  assert.equal((await session.refresh()).status, 'success');
  assert.equal(session.clears(), 0);
});
test('server errors and rate limits preserve the existing session', async () => {
  for (const status of [429, 500, 502, 503]) {
    const session = fixture(async () => new Response(null, { status }));
    assert.deepEqual(await session.refresh(), { status: 'temporary' });
    assert.equal(session.token(), 'refresh-original');
    assert.equal(session.clears(), 0);
  }
});
test('only an explicitly invalid refresh token clears the stored session', async () => {
  for (const status of [401, 403]) {
    const session = fixture(async () => new Response(null, { status }));
    assert.deepEqual(await session.refresh(), { status: 'invalid' });
    assert.equal(session.token(), null);
    assert.equal(session.clears(), 1);
  }
});
test('malformed success responses never replace a valid stored refresh token', async () => {
  for (const body of [{}, { accessToken: 'access' }, { accessToken: '', refreshToken: 'new' }]) {
    const session = fixture(async () => Response.json(body));
    assert.equal((await session.refresh()).status, 'temporary');
    assert.equal(session.token(), 'refresh-original');
    assert.deepEqual(session.saved, []);
  }
});
test('a refresh completing after logout cannot restore the old session', async () => {
  const response = deferred<Response>();
  const session = fixture(async () => response.promise);
  const pending = session.refresh();
  session.replace(null);
  response.resolve(success());
  assert.deepEqual(await pending, { status: 'superseded' });
  assert.equal(session.token(), null);
  assert.deepEqual(session.saved, []);
});
test('an older refresh failure cannot log out a newer login', async () => {
  const response = deferred<Response>();
  const session = fixture(async () => response.promise);
  const pending = session.refresh();
  session.replace('another-login');
  response.resolve(new Response(null, { status: 401 }));
  assert.deepEqual(await pending, { status: 'superseded' });
  assert.equal(session.token(), 'another-login');
  assert.equal(session.clears(), 0);
});
test('the browser lock reads tokens after another tab has finished rotating', async () => {
  let token = 'original';
  let lock: Promise<unknown> = Promise.resolve();
  const calls: string[] = [];
  function withLock<T>(operation: () => Promise<T>): Promise<T> {
    const next = lock.then(operation);
    lock = next;
    return next;
  }
  const options = {
    readToken: () => token,
    saveToken: (value: string) => {
      token = value;
    },
    clearToken: () => {
      token = '';
    },
    withLock,
    request: async (presented: string) => {
      calls.push(presented);
      return success(`access-${calls.length}`, `rotated-${calls.length}`);
    },
  };
  const firstTab = createTokenRefresher(options),
    secondTab = createTokenRefresher(options);
  const result = await Promise.all([firstTab.refresh(), secondTab.refresh()]);
  assert.equal(
    result.every((item) => item.status === 'success'),
    true,
  );
  assert.deepEqual(calls, ['original', 'rotated-1']);
});

test('publishes the renewed access token before releasing the shared refresh', async () => {
  const session = fixture(async () => success());
  let activeToken = 'expired';
  await session.refresh((result) => {
    if (result.status === 'success') activeToken = result.accessToken;
    return result;
  });
  assert.equal(activeToken, 'access-next');
});
