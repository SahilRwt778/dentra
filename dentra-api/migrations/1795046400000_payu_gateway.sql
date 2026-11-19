-- Up Migration
-- Existing online payments must continue through their original provider.
ALTER TABLE transactions ADD COLUMN gateway_provider text NOT NULL DEFAULT 'razorpay'
  CHECK (gateway_provider IN ('razorpay','payu'));
ALTER TABLE transactions ADD COLUMN gateway_checkout_data jsonb;
CREATE UNIQUE INDEX transactions_provider_ref_uidx ON transactions(gateway_provider,gateway_ref)
  WHERE gateway_ref IS NOT NULL;

-- Down Migration
DO $$ BEGIN
  RAISE EXCEPTION 'Preserve gateway ownership and unresolved PayU payments; do not discard financial metadata.';
END $$;
