-- Up Migration
create table clinic_payment_collections (
  id uuid primary key,
  transaction_id uuid not null unique references transactions(id) on delete restrict,
  amount_paise integer not null check (amount_paise >= 0),
  method text not null check (method in ('cash', 'upi', 'card')),
  collected_by uuid not null references users(id) on delete restrict,
  collected_at timestamptz not null default now()
);

-- Down Migration
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM clinic_payment_collections) THEN
    RAISE EXCEPTION 'Archive clinic payment receipts before removing their storage.';
  END IF;
END $$;
DROP TABLE clinic_payment_collections;
