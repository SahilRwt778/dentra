-- Up Migration
alter table transactions add column platform_fee_bps integer check (platform_fee_bps between 0 and 9999);
create index transactions_capture_idx on transactions (gateway_payment_ref) where gateway_payment_ref is not null;

create table wallet_settings (
  singleton boolean primary key default true check (singleton),
  fee_bps integer check (fee_bps between 0 and 9999),
  minimum_withdrawal_paise integer check (minimum_withdrawal_paise > 0),
  version integer not null default 1,
  updated_at timestamptz not null default now(),
  check ((fee_bps is null) = (minimum_withdrawal_paise is null))
);
insert into wallet_settings (singleton) values (true);

create table payout_transfer_references (
  reference text primary key,
  kind text not null check (kind in ('batch','withdrawal')),
  entity_id uuid not null,
  unique (kind,entity_id)
);
insert into payout_transfer_references (reference,kind,entity_id)
select bank_reference,'batch',id from payout_batches where bank_reference is not null;

create table wallet_withdrawals (
  id uuid primary key,
  dentist_id uuid not null references dentists(user_id) on delete restrict,
  amount_paise integer not null check (amount_paise > 0),
  minimum_paise integer not null check (minimum_paise > 0 and amount_paise >= minimum_paise),
  account_approval_id uuid not null references dentist_payout_requests(id) on delete restrict,
  bank_account_holder text not null,
  bank_account_no text not null,
  bank_ifsc text not null,
  status text not null default 'requested' check (status in ('requested','approved','processing','paid','rejected','failed','cancelled')),
  version integer not null default 1,
  bank_reference text unique,
  paid_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  request jsonb not null,
  check ((status = 'paid' and bank_reference is not null and paid_on is not null) or
    (status <> 'paid' and bank_reference is null and paid_on is null))
);
create index wallet_withdrawals_dentist_idx on wallet_withdrawals (dentist_id,created_at desc,id desc);
create index wallet_withdrawals_status_idx on wallet_withdrawals (status,created_at desc,id desc);
create table wallet_withdrawal_events (
  id uuid primary key,
  withdrawal_id uuid not null references wallet_withdrawals(id) on delete restrict,
  actor_id uuid not null references users(id) on delete restrict,
  status text not null,
  note text,
  request jsonb not null,
  created_at timestamptz not null default now()
);
create index wallet_withdrawal_events_idx on wallet_withdrawal_events (withdrawal_id,created_at,id);

-- Down Migration
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM wallet_withdrawals) OR EXISTS (SELECT 1 FROM transactions WHERE platform_fee_bps IS NOT NULL) THEN
    RAISE EXCEPTION 'Archive wallet withdrawals and assigned fees before removing wallet storage.';
  END IF;
END $$;
drop table wallet_withdrawal_events;
drop table wallet_withdrawals;
drop table wallet_settings;
drop table payout_transfer_references;
drop index transactions_capture_idx;
alter table transactions drop column platform_fee_bps;
