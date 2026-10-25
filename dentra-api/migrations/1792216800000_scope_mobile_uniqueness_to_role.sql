-- Up Migration
-- Keep existing IDs, profiles and sessions. The same number may be used
-- once as a patient and once as a dentist, with independent identities.
CREATE UNIQUE INDEX IF NOT EXISTS users_mobile_role_uidx
  ON users (mobile, role) WHERE mobile IS NOT NULL;
DROP INDEX IF EXISTS users_mobile_uidx;

-- Down Migration
-- This safely fails if a number is now shared across roles; no accounts
-- are removed or merged to restore the old restriction.
CREATE UNIQUE INDEX IF NOT EXISTS users_mobile_uidx
  ON users (mobile) WHERE mobile IS NOT NULL;
DROP INDEX IF EXISTS users_mobile_role_uidx;
