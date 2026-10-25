-- Up Migration
ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'refund_pending';
ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'refund_failed';
ALTER TABLE transactions ADD COLUMN payment_expires_at timestamptz;
ALTER TABLE transactions ADD COLUMN next_payment_check_at timestamptz;

CREATE TABLE payment_refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL UNIQUE REFERENCES transactions(id) ON DELETE RESTRICT,
  payment_ref text NOT NULL,
  amount_paise integer NOT NULL CHECK (amount_paise > 0),
  gateway_ref text UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'failed')),
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  lease_token uuid,
  lease_until timestamptz,
  last_error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX payment_refunds_due_idx ON payment_refunds (next_attempt_at) WHERE status = 'pending';

-- Down Migration
-- Keep refund records and enum values: removing them could lose unresolved financial work.
DO $$ BEGIN
  RAISE EXCEPTION 'This migration is irreversible: preserve refund jobs and payment statuses.';
END $$;
