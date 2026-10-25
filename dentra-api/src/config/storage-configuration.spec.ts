import configuration from './configuration';

const original = process.env;
beforeEach(() => {
  process.env = {
    ...original,
    DATABASE_URL: 'postgres://synthetic',
    JWT_ACCESS_SECRET: 'test-only',
    OTP_HASH_SECRET: 'test-only',
    RAZORPAY_KEY_ID: 'test-only',
    RAZORPAY_KEY_SECRET: 'test-only',
    RAZORPAY_WEBHOOK_SECRET: 'test-only',
    STORAGE_PROVIDER: 'supabase',
    SUPABASE_URL: 'https://synthetic.supabase.co',
    SUPABASE_SECRET_KEY: 'sb_secret_test_only',
  };
});
afterEach(() => {
  process.env = original;
});

test('accepts a server secret for Supabase private storage', () => {
  expect(configuration().storage).toMatchObject({
    provider: 'supabase',
    bucket: 'dentra-private',
  });
});
test('fails on missing credentials, publishable keys and unsupported providers', () => {
  process.env.SUPABASE_SECRET_KEY = '';
  process.env.SUPABASE_SERVICE_ROLE_KEY = '';
  expect(configuration).toThrow(
    'requires SUPABASE_URL and SUPABASE_SECRET_KEY'
  );
  process.env.SUPABASE_SECRET_KEY = 'sb_publishable_not_a_server_secret';
  expect(configuration).toThrow('not a publishable key');
  process.env.STORAGE_PROVIDER = 'misspelled';
  expect(configuration).toThrow('must be local or supabase');
});
test('keeps local development available without cloud credentials', () => {
  process.env.STORAGE_PROVIDER = 'local';
  process.env.SUPABASE_SECRET_KEY = '';
  expect(configuration().storage.provider).toBe('local');
});
