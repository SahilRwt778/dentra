import { Pool } from 'pg';
import { hashPassword } from '../src/common/utils/password.util';

/**
 * Provisions (or rotates the password of) one admin account directly
 * against the database. There is no self-serve admin signup, by design
 * — DENTRA_ARCHITECTURE.md treats admin accounts as something ops
 * provisions, not something the API ever creates. Run with DATABASE_URL
 * already in the environment (e.g. `set -a && source .env && set +a`
 * first), then:
 *
 *   npm run create-admin -- admin@dentra.example "a strong password"
 *
 * Re-running for the same email rotates the password.
 */
async function main() {
  const [email, password] = process.argv.slice(2);
  if (!email || !password) {
    console.error('Usage: npm run create-admin -- <email> <password>');
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set — source .env first.');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const passwordHash = await hashPassword(password);

  const { rows } = await pool.query(
    `insert into users (role, email, password_hash, status)
     values ('admin', $1, $2, 'active')
     on conflict (email) where email is not null
       do update set password_hash = excluded.password_hash, status = 'active'
     returning id`,
    [email, passwordHash],
  );

  console.log(`Admin account ready: ${rows[0].id} (${email})`);

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
