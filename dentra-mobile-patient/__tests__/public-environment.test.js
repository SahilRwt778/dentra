const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const readPublicEnvironment = require('../public-environment.cjs');

let directory;
beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'dentra-public-env-'));
});
afterEach(() => {
  fs.rmSync(directory, { recursive: true, force: true });
});

test('reads only public settings and lets build environment values override the file', () => {
  const file = path.join(directory, '.env');
  fs.writeFileSync(
    file,
    'DENTRA_API_URL=https://file.example.test\nDENTRA_SUPPORT_EMAIL=support@example.test\nDENTRA_PUSH_ENABLED=true\nSUPABASE_SECRET_KEY=synthetic-private-secret\n',
  );
  expect(
    readPublicEnvironment(file, { DENTRA_API_URL: 'https://build.example.test' }),
  ).toEqual({
    DENTRA_API_URL: 'https://build.example.test',
    DENTRA_SUPPORT_EMAIL: 'support@example.test',
    DENTRA_PUSH_ENABLED: 'true',
    DENTRA_PUSH_IOS_ENABLED: undefined,
  });
  expect(readPublicEnvironment(path.join(directory, 'missing'), {})).toEqual({
    DENTRA_API_URL: undefined,
    DENTRA_SUPPORT_EMAIL: undefined,
    DENTRA_PUSH_ENABLED: undefined,
    DENTRA_PUSH_IOS_ENABLED: undefined,
  });
});

test('Babel embeds public fields without rewriting backend secret expressions', () => {
  const { transformSync } = require('@babel/core');
  const result = transformSync(
    'const api = process.env.DENTRA_API_URL; const secret = process.env.SUPABASE_SECRET_KEY;',
    {
      configFile: false,
      babelrc: false,
      plugins: [require('../babel-plugin-environment.cjs')],
    },
  );
  expect(result.code).not.toContain('process.env.DENTRA_API_URL');
  expect(result.code).toContain('process.env.SUPABASE_SECRET_KEY');
});

test('Metro changes its cache key with the public API URL and excludes backend secrets', () => {
  function cacheVersion(api, secret) {
    return execFileSync(
      process.execPath,
      ['-e', 'process.stdout.write(require("./metro.config.js").cacheVersion)'],
      {
        cwd: path.resolve(__dirname, '..'),
        env: { ...process.env, DENTRA_API_URL: api, SUPABASE_SECRET_KEY: secret },
        encoding: 'utf8',
      },
    );
  }
  const first = cacheVersion('https://first.example.test', 'synthetic-secret-one');
  expect(cacheVersion('https://second.example.test', 'synthetic-secret-one')).not.toBe(first);
  expect(cacheVersion('https://first.example.test', 'synthetic-secret-two')).toBe(first);
});
