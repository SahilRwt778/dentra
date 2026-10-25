-- Up Migration
CREATE TABLE admin_profiles (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT 'Dentra admin',
  version integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE platform_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton boolean NOT NULL DEFAULT true UNIQUE CHECK (singleton),
  name text NOT NULL,
  region text NOT NULL,
  support_email text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO platform_settings (name, region, support_email)
VALUES ('Dentra', 'Delhi NCR', 'support@dentra.in');

-- Down Migration
DROP TABLE platform_settings;
DROP TABLE admin_profiles;
