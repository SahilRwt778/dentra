// Every run gets a disposable schema. The configured database's existing data is untouched.
const { spawnSync } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { mkdtemp, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { Pool } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required for isolated integration tests.');
  const schema = `dentra_e2e_${randomUUID().replaceAll('-', '')}`;
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const filesDirectory = await mkdtemp(path.join(tmpdir(), 'dentra-files-e2e-'));
  try {
    await pool.query(`CREATE SCHEMA "${schema}"`);
    // Extensions live outside the disposable schema and are never removed during cleanup.
    await pool.query('CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public');
    await pool.query('CREATE EXTENSION IF NOT EXISTS citext WITH SCHEMA public');
    const databaseUrl = new URL(process.env.DATABASE_URL);
    databaseUrl.searchParams.set('options', `-c search_path=${schema},public`);
    const isolated = new Pool({ connectionString: databaseUrl.toString() });
    try {
      const selected = await isolated.query('select current_schema() as name');
      if (selected.rows[0].name !== schema) throw new Error('The database pooler did not select the disposable test schema. No test data was applied.');
      await isolated.query(readFileSync(path.join(__dirname, '../schema.sql'), 'utf8'));
    } finally {
      await isolated.end();
    }
    console.log('Running integration tests in an isolated schema with a local payment fixture.');
    const result = spawnSync(
      process.execPath,
      [
        require.resolve('jest/bin/jest'),
        '--config',
        './test/e2e/jest-e2e.json',
        '--runInBand',
        ...process.argv.slice(2),
      ],
      {
        cwd: path.join(__dirname, '..'),
        stdio: 'inherit',
        env: {
          ...process.env,
          DATABASE_URL: databaseUrl.toString(),
          NODE_ENV: 'test',
          PATIENT_FILES_DIRECTORY: filesDirectory,
          DENTIST_FILES_DIRECTORY: path.join(filesDirectory, 'dentists'),
          STORAGE_PROVIDER: 'local',
          SUPABASE_SECRET_KEY: '',
          SUPABASE_SERVICE_ROLE_KEY: '',
          PUSH_ENABLED: 'false',
          VIDEO_ENABLED: 'false',
          LIVEKIT_URL: 'wss://synthetic.livekit.test',
          LIVEKIT_API_KEY: 'synthetic-video-key',
          LIVEKIT_API_SECRET: 'synthetic-video-secret-at-least-32-characters',
          JWT_ACCESS_SECRET: 'isolated-test-access-secret',
          OTP_HASH_SECRET: 'isolated-test-otp-secret',
          RAZORPAY_KEY_ID: 'rzp_test_local_fixture',
          RAZORPAY_KEY_SECRET: 'local-fixture-secret',
          RAZORPAY_WEBHOOK_SECRET: 'local-fixture-webhook-secret',
        },
      },
    );
    if (result.error) throw result.error;
    process.exitCode = result.status ?? 1;
  } finally {
    await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await pool.end();
    await rm(filesDirectory, { recursive: true, force: true });
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
