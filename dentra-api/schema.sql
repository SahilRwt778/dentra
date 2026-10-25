-- Dentra: PostgreSQL schema (Phase 1)
-- Target: Postgres 14+. Run as sequential migrations in a real project;
-- kept as one file here for review against DENTRA_ARCHITECTURE.md.

create extension if not exists pgcrypto;   -- gen_random_uuid()
create extension if not exists citext;     -- case-insensitive email

-- ========================================================================
-- Enums
-- ========================================================================

create type user_role as enum ('patient', 'dentist', 'admin');

create type dentist_status as enum ('draft', 'pending_review', 'verified', 'rejected', 'disabled');

create type submitted_by as enum ('self', 'admin');

create type kyc_doc_type as enum ('degree', 'council', 'id_proof', 'clinic_proof', 'insurance', 'selfie');

create type appointment_type as enum ('video', 'clinic');

create type appointment_status as enum ('booked', 'waiting', 'in_consult', 'completed', 'cancelled');

create type payment_method as enum ('upi', 'card', 'netbanking', 'pay_at_clinic');

create type payment_status as enum ('pending', 'paid', 'due_at_clinic', 'refund_pending', 'refund_failed', 'refunded', 'cancelled', 'failed');

create type tooth_status as enum ('healthy', 'caries', 'filled', 'crown', 'rct', 'missing', 'extract');

create type privacy_request_type as enum ('export', 'erase');

create type privacy_request_status as enum ('open', 'resolved');

create type notification_channel as enum ('push', 'sms', 'email', 'in_app');

-- ========================================================================
-- Users & identity
-- ========================================================================

-- One row per login identity. A mobile number can have separate patient
-- and dentist identities; it is unique within each role. Patients and
-- dentists authenticate by mobile + OTP; admins by email + password. Exactly one of
-- (mobile) / (email) is the login handle depending on role, but both
-- columns exist on every row so support staff always have a way to reach
-- someone.
create table users (
  id                uuid primary key default gen_random_uuid(),
  role              user_role not null,
  mobile            varchar(15),                  -- E.164, e.g. +919820010482
  email             citext,
  password_hash     text,                         -- admin only
  totp_secret       text,                          -- admin only
  status            varchar(20) not null default 'active',  -- active | locked | deleted
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint users_mobile_format check (mobile is null or mobile ~ '^\+[1-9][0-9]{7,14}$'),
  constraint users_role_identity check (
    (role in ('patient','dentist') and mobile is not null) or
    (role = 'admin' and email is not null and password_hash is not null)
  )
);
create unique index users_mobile_role_uidx on users (mobile, role) where mobile is not null;
create unique index users_email_uidx on users (email) where email is not null;

create table admin_profiles (
  user_id uuid primary key references users(id) on delete cascade,
  full_name text not null default 'Dentra admin',
  version integer not null default 0,
  updated_at timestamptz not null default now()
);

create table platform_settings (
  id uuid primary key default gen_random_uuid(),
  singleton boolean not null default true unique check (singleton),
  name text not null,
  region text not null,
  support_email text not null,
  version integer not null default 1,
  updated_at timestamptz not null default now()
);
insert into platform_settings (name, region, support_email)
values ('Dentra', 'Delhi NCR', 'support@dentra.in');

create table patients (
  user_id           uuid primary key references users(id) on delete cascade,
  full_name         text not null,
  date_of_birth     date not null,
  gender            varchar(20),
  email             citext,
  city              text,
  preferred_lang    varchar(20) not null default 'English',
  allergies         text default 'None known',
  conditions        text default 'None',
  medications       text default 'None',
  emergency_contact text,
  -- set only when date_of_birth implies the patient was a minor at signup
  guardian_name         text,
  guardian_relationship text,
  guardian_mobile       varchar(15),
  guardian_consent_at   timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint patients_guardian_required_if_minor check (
    date_of_birth <= (current_date - interval '18 years') or
    (guardian_name is not null and guardian_relationship is not null and
     guardian_mobile is not null and guardian_consent_at is not null)
  )
);

create table dentists (
  user_id            uuid primary key references users(id) on delete cascade,
  full_name          text not null,
  date_of_birth      date,
  gender             varchar(20),
  email              citext,
  profile_photo_url  text,
  qualification      text not null,
  specialization     text not null,
  years_experience   smallint not null default 0,
  languages          text[] not null default '{}',
  council_reg_no     text not null,
  council_name       text,
  council_reg_valid_till date,
  -- video is priced and scheduled at the dentist level: it isn't tied to
  -- any one clinic. In-clinic hours live on dentist_clinics instead.
  offers_video       boolean not null default false,
  fee_video_paise    integer not null default 0,
  fee_clinic_paise   integer not null default 0,
  video_hours_from   time,
  video_hours_to     time,
  video_working_days smallint[] not null default array[0,1,2,3,4,5,6]::smallint[]
    check (video_working_days <@ array[0,1,2,3,4,5,6]::smallint[] and array_position(video_working_days, null) is null),
  pan                varchar(10),
  bank_account_holder text,
  bank_account_no    text,
  bank_ifsc          varchar(11),
  gstin              varchar(15),
  status             dentist_status not null default 'draft',
  submitted_by       submitted_by not null default 'self',
  submitted_at       timestamptz not null default now(),
  reviewed_by        uuid references users(id),
  reviewed_at        timestamptz,
  rejection_reason   text,
  resubmission_count smallint not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint dentists_fee_nonneg check (fee_video_paise >= 0 and fee_clinic_paise >= 0),
  constraint dentists_video_hours check (
    (offers_video = false) or (video_hours_from is not null and video_hours_to is not null and video_hours_from < video_hours_to)
  )
);
create index dentists_status_idx on dentists (status);
create index dentists_specialization_idx on dentists (specialization);

-- Proposed bank details stay separate from the approved fields on dentists.
create table dentist_payout_requests (
  id uuid primary key default gen_random_uuid(),
  dentist_id uuid not null references dentists(user_id) on delete cascade,
  bank_account_holder text not null,
  bank_account_no text not null,
  bank_ifsc varchar(11) not null,
  pan varchar(10) not null,
  gstin varchar(15),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  submitted_at timestamptz not null default now(),
  reviewed_by uuid references users(id),
  reviewed_at timestamptz,
  rejection_reason text,
  constraint payout_request_review_state check (
    (status = 'pending' and reviewed_at is null and reviewed_by is null and rejection_reason is null) or
    (status = 'approved' and reviewed_at is not null and reviewed_by is not null and rejection_reason is null) or
    (status = 'rejected' and reviewed_at is not null and reviewed_by is not null and rejection_reason is not null and length(trim(rejection_reason)) > 0)
  )
);
create unique index dentist_payout_one_pending_idx on dentist_payout_requests (dentist_id) where status = 'pending';
create index dentist_payout_history_idx on dentist_payout_requests (dentist_id, submitted_at desc, id desc);
create index dentist_payout_queue_idx on dentist_payout_requests (status, submitted_at, id);

-- ========================================================================
-- Clinics (a dentist has one or more; video has none)
-- ========================================================================

create table dentist_clinics (
  id               uuid primary key default gen_random_uuid(),
  dentist_id       uuid not null references dentists(user_id) on delete cascade,
  name             text not null,            -- display name + area, e.g. "Smile Axis Dental, Lajpat Nagar"
  address_line     text,
  pincode          varchar(10),
  phone            varchar(15),
  latitude         numeric(9,6),
  longitude        numeric(9,6),
  hours_from       time not null default '10:00',
  hours_to         time not null default '18:30',
  working_days     smallint[] not null default array[0,1,2,3,4,5,6]::smallint[]
    check (working_days <@ array[0,1,2,3,4,5,6]::smallint[] and array_position(working_days, null) is null),
  is_active        boolean not null default true,  -- soft-remove: keep history, hide from booking
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint dentist_clinics_hours check (hours_from < hours_to)
);
create index dentist_clinics_dentist_idx on dentist_clinics (dentist_id) where is_active;

create table dentist_time_off (
  id uuid primary key,
  dentist_id uuid not null references dentists(user_id) on delete cascade,
  start_date date not null,
  end_date date not null check (end_date >= start_date and end_date - start_date <= 365),
  all_day boolean not null,
  start_minute smallint not null check (start_minute >= 0),
  end_minute smallint not null check (end_minute <= 1440 and end_minute > start_minute),
  reason varchar(200),
  created_at timestamptz not null default now(),
  check (not all_day or (start_minute = 0 and end_minute = 1440))
);
create index dentist_time_off_dates_idx on dentist_time_off (dentist_id, start_date, end_date);

-- A dentist must always have at least one clinic OR offer video (enforced
-- in the application layer at write time, not as a DB constraint, since
-- Postgres can't express "at least one row in another table" declaratively
-- without a trigger; add one if this invariant matters enough to enforce
-- at the DB layer too).

-- ========================================================================
-- KYC documents (self-serve and admin-created onboarding both land here)
-- ========================================================================

create table dentist_documents (
  id             uuid primary key default gen_random_uuid(),
  dentist_id     uuid not null references dentists(user_id) on delete cascade,
  doc_type       kyc_doc_type not null,
  file_url       text not null,            -- S3 object key / signed URL base
  uploaded_at    timestamptz not null default now(),
  verified_by    uuid references users(id),
  verified_at    timestamptz,
  -- true only for the handful of pre-verified seed/demo dentists created
  -- without a real upload; never set by application code post-launch
  is_seed_placeholder boolean not null default false,
  unique (dentist_id, doc_type)
);

-- ========================================================================
-- OTP + session management
-- ========================================================================

create table otp_codes (
  id            uuid primary key default gen_random_uuid(),
  mobile        varchar(15) not null,
  purpose       varchar(20) not null,  -- patient | dentist | prescription
  context       text,                -- binds prescription OTPs to the appointment and saved medicine list
  code_hash     text not null,
  expires_at    timestamptz not null,
  attempts      smallint not null default 0,
  consumed_at   timestamptz,
  created_at    timestamptz not null default now()
);
create index otp_codes_mobile_idx on otp_codes (mobile, created_at desc);
-- Rate limiting (max 5 requests/hour, max 5 verify attempts, 15 min lock)
-- is enforced in the API layer using this table's created_at/attempts;
-- no DB-level trigger needed for a single-writer OTP flow.

create table refresh_tokens (
  session_id    uuid not null default gen_random_uuid(),
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references users(id) on delete cascade,
  device_id     text not null,           -- app-generated, stable per install
  token_hash    text not null,
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null,
  revoked_at    timestamptz
);
create index refresh_tokens_user_idx on refresh_tokens (user_id) where revoked_at is null;
create unique index refresh_tokens_hash_uidx on refresh_tokens (token_hash);
create index refresh_tokens_session_idx on refresh_tokens (session_id) where revoked_at is null;

-- ========================================================================
-- Appointments — the table the whole booking-race-condition fix hangs on
-- ========================================================================

create table appointments (
  id               uuid primary key default gen_random_uuid(),
  patient_id       uuid not null references patients(user_id) on delete restrict,
  dentist_id       uuid not null references dentists(user_id) on delete restrict,
  clinic_id        uuid references dentist_clinics(id) on delete restrict,  -- null for video
  type             appointment_type not null,
  scheduled_date   date not null,
  scheduled_time   time not null,     -- 30-minute slot start
  status           appointment_status not null default 'booked',
  concern_summary  text not null,
  concerns         text[] not null default '{}',
  symptom_area     text,
  symptom_since    text,
  pain_score       smallint,
  swelling         boolean not null default false,
  note             text,
  photo_urls       text[] not null default '{}',
  booked_at        timestamptz not null default now(),
  completed_at     timestamptz,
  cancelled_at     timestamptz,
  rescheduled_at   timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint appointments_pain_range check (pain_score is null or pain_score between 0 and 10),
  constraint appointments_clinic_required_for_clinic_visit check (
    (type = 'clinic' and clinic_id is not null) or (type = 'video' and clinic_id is null)
  )
);
create index appointments_patient_idx on appointments (patient_id, scheduled_date desc);
create index appointments_dentist_date_idx on appointments (dentist_id, scheduled_date);
create index appointments_status_idx on appointments (status) where status in ('booked','waiting','in_consult');

-- THE fix for the prototype's race condition: a dentist cannot hold two
-- non-cancelled appointments in the same slot, full stop, regardless of
-- clinic or video. Booking still wraps this in an application-level
-- transaction (to also move the payment atomically), but even if that
-- logic has a bug, the database refuses the second row outright instead
-- of silently double-booking.
create unique index appointments_no_double_booking
  on appointments (dentist_id, scheduled_date, scheduled_time)
  where status <> 'cancelled';

-- ========================================================================
-- Consultations & prescriptions
-- ========================================================================

create table consultations (
  appointment_id   uuid primary key references appointments(id) on delete cascade,
  chief_complaint  text,
  findings         text,
  diagnosis        text,
  treatment_done   text,
  plan             text,
  plan_items       jsonb not null default '[]'::jsonb
                     check (jsonb_typeof(plan_items) = 'array' and jsonb_array_length(plan_items) <= 20),
  follow_up_date   date,
  edited_at        timestamptz,
  is_edited        boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table prescriptions (
  id               uuid primary key default gen_random_uuid(),
  appointment_id   uuid not null unique references appointments(id) on delete cascade,
  signed_by_dentist_id uuid references dentists(user_id),
  signed_at        timestamptz,
  -- re-confirmed by an OTP/biometric step at sign time (Phase 6); this
  -- column holds that confirmation's reference, not a copy of the OTP
  signature_ref    text,
  created_at       timestamptz not null default now()
);

create table prescription_items (
  id               uuid primary key default gen_random_uuid(),
  prescription_id  uuid not null references prescriptions(id) on delete cascade,
  medicine_name    text not null,
  strength         text,
  dose             text not null,
  frequency        text not null,
  duration         text not null,
  instructions     text,
  sort_order       smallint not null default 0
);
create index prescription_items_rx_idx on prescription_items (prescription_id, sort_order);

-- ========================================================================
-- Dental chart — append-only, never overwritten, so a patient's history
-- across different dentists stays reconstructable
-- ========================================================================

create table dental_chart_entries (
  id               uuid primary key default gen_random_uuid(),
  patient_id       uuid not null references patients(user_id) on delete cascade,
  tooth_number     varchar(2) not null,     -- FDI notation, e.g. "36"
  status           tooth_status not null,
  recorded_by_dentist_id uuid references dentists(user_id),
  appointment_id   uuid references appointments(id),
  recorded_at      timestamptz not null default now()
);
create index dental_chart_patient_idx on dental_chart_entries (patient_id, tooth_number, recorded_at desc);

-- The patient's *current* chart is a view: the latest entry per tooth.
create view patient_current_chart as
select distinct on (patient_id, tooth_number)
  patient_id, tooth_number, status, recorded_by_dentist_id, recorded_at
from dental_chart_entries
order by patient_id, tooth_number, recorded_at desc;

-- ========================================================================
-- Payments
-- ========================================================================

create table transactions (
  id               uuid primary key default gen_random_uuid(),
  appointment_id   uuid not null references appointments(id) on delete restrict,
  gateway_ref         text,              -- the Razorpay order id, set at booking time
  gateway_payment_ref text,              -- the Razorpay payment id, only known once payment.captured fires; refunds operate on payment id, not order id
  payment_expires_at timestamptz,        -- new online bookings hold their slot for 15 minutes
  next_payment_check_at timestamptz,     -- reconcile new online orders when a payment webhook is delayed
  idempotency_key  text not null,        -- one per booking attempt, from the client
  amount_paise     integer not null,
  method           payment_method not null,
  status           payment_status not null default 'pending',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create unique index transactions_idempotency_uidx on transactions (idempotency_key);
create index transactions_appointment_idx on transactions (appointment_id);

create table clinic_payment_collections (
  id uuid primary key,
  transaction_id uuid not null unique references transactions(id) on delete restrict,
  amount_paise integer not null check (amount_paise >= 0),
  method text not null check (method in ('cash', 'upi', 'card')),
  collected_by uuid not null references users(id) on delete restrict,
  collected_at timestamptz not null default now()
);

-- A full refund is saved with cancellation, then submitted after commit.
-- Its UUID is also the gateway idempotency key, including after timeouts/restarts.
create table payment_refunds (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null unique references transactions(id) on delete restrict,
  payment_ref text not null,
  amount_paise integer not null check (amount_paise > 0),
  gateway_ref text unique,
  status text not null default 'pending' check (status in ('pending', 'processed', 'failed')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  lease_token uuid,
  lease_until timestamptz,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index payment_refunds_due_idx on payment_refunds (next_attempt_at) where status = 'pending';

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


-- ========================================================================
-- Privacy requests (DPDP Act, 2023)
-- ========================================================================

create table privacy_requests (
  id               uuid primary key default gen_random_uuid(),
  patient_id       uuid not null references patients(user_id) on delete cascade,
  type             privacy_request_type not null,
  status           privacy_request_status not null default 'open',
  sla_due_at       timestamptz not null,
  resolved_at      timestamptz,
  resolved_by      uuid references users(id),
  created_at       timestamptz not null default now()
);
create index privacy_requests_open_idx on privacy_requests (sla_due_at) where status = 'open';

-- ========================================================================
-- Notifications (fan-out log, not a queue — the queue is in the broker)
-- ========================================================================

create table notifications (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references users(id) on delete cascade,
  channel          notification_channel not null,
  template_key     text not null,
  payload          jsonb not null default '{}',
  sent_at          timestamptz,
  read_at          timestamptz,
  created_at       timestamptz not null default now()
);
create index notifications_user_idx on notifications (user_id, created_at desc);
create unique index notifications_appointment_booked_uidx
  on notifications (user_id, template_key, (payload->>'appointmentId'))
  where template_key = 'appointment_booked';
create unique index notifications_dentist_onboarding_uidx
  on notifications (user_id, template_key, (payload->>'dentistId'))
  where template_key = 'dentist_onboarding_submitted';
create unique index notifications_patient_event_uidx
  on notifications (user_id, template_key, (payload->>'eventKey'))
  where template_key in ('booking_confirmed', 'appointment_cancelled', 'appointment_rescheduled',
    'appointment_reminder', 'visit_summary_ready');

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


-- ========================================================================
-- Audit log — every state change that affects another party
-- ========================================================================

create table audit_log (
  id               uuid primary key default gen_random_uuid(),
  actor_user_id    uuid references users(id),
  actor_label      text not null,          -- denormalized name, survives actor deletion
  action           text not null,          -- e.g. 'approved', 'rejected', 'disabled', 'override_verified'
  entity_type      text not null,          -- 'dentist' | 'appointment' | 'patient' | ...
  entity_id        uuid not null,
  detail           text,
  before_state     jsonb,
  after_state      jsonb,
  created_at       timestamptz not null default now()
);
create index audit_log_entity_idx on audit_log (entity_type, entity_id, created_at desc);
create index audit_log_created_idx on audit_log (created_at desc);

-- Appointment-scoped video consultation rooms

CREATE TABLE video_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  room_name text NOT NULL UNIQUE,
  provider text NOT NULL DEFAULT 'livekit',
  provider_room_id text,
  patient_identity text,
  dentist_identity text,
  scheduled_date date NOT NULL,
  scheduled_time time NOT NULL,
  expires_at timestamptz NOT NULL,
  patient_session_id uuid,
  dentist_session_id uuid,
  closed_at timestamptz,
  cleaned_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX video_rooms_active_uidx ON video_rooms (appointment_id) WHERE closed_at IS NULL;
CREATE INDEX video_rooms_cleanup_idx ON video_rooms (created_at) WHERE cleaned_at IS NULL;
CREATE UNIQUE INDEX video_rooms_provider_room_uidx ON video_rooms(provider_room_id) WHERE provider_room_id IS NOT NULL;


-- Private patient photos and reports
CREATE TABLE patient_files (
  id uuid PRIMARY KEY,
  patient_id uuid NOT NULL REFERENCES patients(user_id) ON DELETE RESTRICT,
  appointment_id uuid REFERENCES appointments(id) ON DELETE RESTRICT,
  upload_key uuid NOT NULL,
  file_name text NOT NULL,
  mime_type text NOT NULL CHECK (mime_type IN ('image/jpeg', 'image/png', 'application/pdf')),
  size_bytes integer NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 10485760),
  content_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '24 hours',
  deleted_at timestamptz,
  purged_at timestamptz,
  UNIQUE (patient_id, upload_key)
);
CREATE INDEX patient_files_patient_idx ON patient_files (patient_id, created_at DESC, id DESC) WHERE deleted_at IS NULL;
CREATE INDEX patient_files_appointment_idx ON patient_files (appointment_id) WHERE deleted_at IS NULL;
CREATE INDEX patient_files_cleanup_idx ON patient_files (expires_at) WHERE appointment_id IS NULL AND purged_at IS NULL;



CREATE TABLE care_documents (
  appointment_id uuid NOT NULL REFERENCES appointments(id) ON DELETE RESTRICT,
  kind text NOT NULL CHECK (kind IN ('prescription', 'visit-summary')),
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (appointment_id, kind)
);


CREATE TABLE video_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
  appointment_id uuid NOT NULL REFERENCES appointments(id),
  sender_id uuid NOT NULL REFERENCES users(id),
  sender_role text NOT NULL CHECK (sender_role IN ('patient','dentist')),
  request_id uuid NOT NULL,
  body text NOT NULL DEFAULT '' CHECK (length(body)<=4000),
  content_hash text NOT NULL,
  file_name text,
  mime_type text CHECK (mime_type IN ('image/jpeg','image/png','application/pdf')),
  size_bytes integer CHECK (size_bytes BETWEEN 1 AND 10485760),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(appointment_id,sender_id,request_id),
  CHECK (length(btrim(body))>0 OR file_name IS NOT NULL),
  CHECK ((file_name IS NULL AND mime_type IS NULL AND size_bytes IS NULL) OR
         (file_name IS NOT NULL AND mime_type IS NOT NULL AND size_bytes IS NOT NULL))
);
CREATE INDEX video_chat_messages_appointment_sequence_idx ON video_chat_messages(appointment_id,sequence);
