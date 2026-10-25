-- Up Migration
ALTER TABLE otp_codes ADD COLUMN IF NOT EXISTS context text;

-- Down Migration
ALTER TABLE otp_codes DROP COLUMN IF EXISTS context;
