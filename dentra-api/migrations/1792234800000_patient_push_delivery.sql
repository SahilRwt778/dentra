-- Up Migration
ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS session_id uuid NOT NULL DEFAULT gen_random_uuid();
CREATE INDEX IF NOT EXISTS refresh_tokens_session_idx ON refresh_tokens (session_id) WHERE revoked_at IS NULL;

CREATE TABLE push_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  installation_id text NOT NULL UNIQUE,
  session_id uuid NOT NULL,
  token text NOT NULL,
  token_hash varchar(64) NOT NULL UNIQUE,
  platform varchar(10) NOT NULL CHECK (platform IN ('android', 'ios')),
  binding_id uuid NOT NULL DEFAULT gen_random_uuid(),
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX push_devices_user_idx ON push_devices (user_id) WHERE enabled;

CREATE TABLE push_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  device_id uuid NOT NULL REFERENCES push_devices(id) ON DELETE CASCADE,
  binding_id uuid NOT NULL,
  status varchar(10) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'sent', 'skipped', 'failed')),
  attempts smallint NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  lease_until timestamptz,
  lease_token uuid,
  last_error_code varchar(100),
  provider_message_id text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (notification_id, device_id)
);
CREATE INDEX push_deliveries_pending_idx ON push_deliveries (next_attempt_at, created_at) WHERE status IN ('pending', 'sending');

-- Down Migration
DROP TABLE IF EXISTS push_deliveries;
DROP TABLE IF EXISTS push_devices;
DROP INDEX IF EXISTS refresh_tokens_session_idx;
ALTER TABLE refresh_tokens DROP COLUMN IF EXISTS session_id;
