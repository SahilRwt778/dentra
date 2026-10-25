-- Up Migration
create table payout_batches (
  id uuid primary key,
  dentist_id uuid not null references dentists(user_id) on delete restrict,
  account_approval_id uuid not null references dentist_payout_requests(id) on delete restrict,
  bank_account_holder text not null,
  bank_account_no text not null,
  bank_ifsc text not null,
  fee_bps integer not null check (fee_bps between 0 and 10000),
  gross_paise bigint not null check (gross_paise > 0),
  fee_paise bigint not null check (fee_paise >= 0),
  net_paise bigint not null check (net_paise > 0 and net_paise = gross_paise - fee_paise),
  status text not null default 'pending' check (status in ('pending','processing','paid','failed','cancelled')),
  version integer not null default 1 check (version > 0),
  created_by uuid not null references users(id) on delete restrict,
  bank_reference text unique,
  paid_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payout_paid_reference check (
    (status = 'paid' and bank_reference is not null and paid_on is not null) or
    (status <> 'paid' and bank_reference is null and paid_on is null)
  )
);
create index payout_batches_dentist_idx on payout_batches (dentist_id, created_at desc, id desc);
create index payout_batches_status_idx on payout_batches (status, created_at desc, id desc);

create table payout_batch_items (
  batch_id uuid not null references payout_batches(id) on delete restrict,
  transaction_id uuid not null references transactions(id) on delete restrict,
  provider_payment_ref text not null,
  amount_paise integer not null check (amount_paise > 0),
  fee_paise integer not null check (fee_paise between 0 and amount_paise),
  released_at timestamptz,
  primary key (batch_id, transaction_id)
);
-- Failed/in-flight transfers keep their reservation. Only cancellation releases it.
create unique index payout_transaction_reserved_idx on payout_batch_items (transaction_id) where released_at is null;
create unique index payout_provider_payment_reserved_idx on payout_batch_items (provider_payment_ref) where released_at is null;

create table payout_batch_events (
  id uuid primary key,
  batch_id uuid not null references payout_batches(id) on delete restrict,
  actor_id uuid not null references users(id) on delete restrict,
  status text not null check (status in ('pending','processing','paid','failed','cancelled')),
  note text,
  request jsonb not null,
  created_at timestamptz not null default now()
);
create index payout_batch_events_batch_idx on payout_batch_events (batch_id, created_at, id);

-- Down Migration
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM payout_batches) THEN
    RAISE EXCEPTION 'Archive payout batches before removing their ledger.';
  END IF;
END $$;
drop table payout_batch_events;
drop table payout_batch_items;
drop table payout_batches;
