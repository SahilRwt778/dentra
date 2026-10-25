# dentra-api

Backend for all four Dentra clients (Patient Mobile, Dentist Mobile, Dentist Web, Admin Web). One contract — `openapi.yaml` — enforced server-side, not just by each client's UI.

See [`../DENTRA_ARCHITECTURE.md`](../DENTRA_ARCHITECTURE.md) for why it's split this way.

## Layout

```
src/
├── main.ts, app.module.ts
├── common/        guards, filters, decorators, utils — shared across every module
├── config/        typed env access (configuration.ts); nothing else reads process.env directly
├── health/        GET /health, public, for the load balancer / orchestrator
├── database/      one shared pg.Pool (PG_POOL), global — schema.sql is plain SQL, no ORM
└── modules/
    ├── identity/  one subfolder per identity, not a flat pile of controllers
    │   ├── auth/      otp/request, otp/verify, refresh, logout, admin/login (done — see scripts/create-admin.ts for provisioning)
    │   ├── users/     UsersService — the users-table lookups auth/patients/dentists all share
    │   ├── patients/  register, me, me/chart (done)
    │   └── dentists/  public search/profile/slots, self-serve application + documents,
    │                  self profile + clinics CRUD (done)
    ├── care/      appointments, consultations, prescriptions, dental chart (done)
    │   ├── appointments/  book/list/get/cancel/reschedule/check-in/start, the double-booking lock
    │   └── consultations/ draft notes + chart diffing, allergy-checked prescription signing, complete
    ├── admin/     dentist review, platform-wide appointments, audit log, privacy requests (done)
    │   ├── dentists/     admin-created dentist, approve/reject/disable/enable/reconsider
    │   ├── appointments/ GET /admin/appointments — every dentist's calendar at once, patient/dentist
    │   │                 names joined in; unlike GET /appointments, not scoped to the caller
    │   ├── payments/     GET /admin/payments — transaction reporting, totals and gateway configuration
    │   ├── settings/     GET/PATCH /admin/me and /admin/settings — persisted profile and platform details
    │   ├── audit/        AuditService — every write above logs here
    │   └── privacy/      file/list/resolve a DPDP export or erase request
    └── payments/  Razorpay order/refund adapter and signed webhooks
```

Every route is locked by the global `JwtAuthGuard` unless marked `@Public()`; `RolesGuard` then checks `@Roles(...)` where present. This is the server-side version of the role check the old prototype only had in its UI.

## Running it

```bash
cp .env.example .env            # fill in JWT_ACCESS_SECRET and OTP_HASH_SECRET at minimum
docker compose up -d            # Postgres on 5432, schema.sql auto-applied on first run
npm install
npm run start:dev               # http://localhost:3000, docs at /docs
```

For an existing database, run `npm run migrate -- up` to apply schema updates without resetting data. The mobile-identity migration replaces global mobile-number uniqueness with uniqueness per `(mobile, role)`, so one person can use the same number for separate patient and dentist accounts. Existing IDs, profiles and sessions are preserved; repeated or concurrent sign-ins reuse the matching role's account.

The prescription OTP migration adds a nullable `otp_codes.context` column. Signing uses `POST /appointments/{id}/prescription/otp`, then `POST /appointments/{id}/prescription/sign` with `otpId` and a generated four-digit `confirmationCode`. Challenges are bound to the dentist, appointment and saved medicine list, expire after five minutes, and lock after five wrong attempts. The challenge is consumed atomically with the signature. Login and signing challenges cannot be exchanged.

Dentist Web omits `prescriptionItems` when saving notes after signing, so completing the visit preserves the signature. Draft writes, signing and completion serialize on the appointment row. Completed/cancelled appointments reject further draft writes. Patients can read consultation summaries and chart changes after completion.

New patient bookings also create an `in_app` notification for the assigned dentist in the same database transaction. Failed bookings leave no notification; replaying an idempotency key does not duplicate or reset it. The notification migration adds the `in_app` channel and an index enforcing one booking notification per dentist and appointment, preserving existing data.

Dentist Web's bell shows the unread count and a paginated booking inbox. It checks for updates every five seconds while the portal is focused, refetches on focus/reconnection, displays a new-booking alert, and refreshes the appointment views. Opening a notification marks it read and opens that appointment. `GET /notifications`, `PATCH /notifications/{id}/read` and `POST /notifications/read-all` return only the authenticated recipient’s notifications: appointment bookings for approved dentists, onboarding submissions for admins, and appointment updates for patients. Mark-all uses the newest displayed notification as a cutoff, leaving later events unread. History and read state survive reloads and sign-ins. This delivers notifications inside the web portal; external push, email and SMS delivery are separate integrations.

Dentist Web and Admin Web have a sticky header containing the current page title, subtitle, page actions and notification bell. Submitting a complete self-serve dentist application creates one `dentist_onboarding_submitted` notification for each active admin in the same transaction as the pending-review status and audit entry. Drafts, incomplete submissions and retries do not create extra notifications. The additive admin-onboarding migration enforces one notification per application and admin without changing existing records.

Admin Web checks notifications every five seconds while focused, refreshes the review queue on new arrivals, and offers a direct application review link. The link fetches `GET /admin/dentists/{dentistId}`, so applications remain accessible even outside the first queue page or after approval/rejection. Reviewed applications show their current status and cannot be approved or rejected again from that screen.

Patient Mobile has a persistent notification inbox and unread Home badge for booking confirmation (including whether online payment was outstanding), cancellations, reschedules, one-hour reminders, and completed visit summaries. The API saves these events in the same transaction as the appointment change, enforces recipient ownership on list/read/cursors, and preserves read timestamps. Cancellation retries serialize on the appointment and reuse the cancelled result; rescheduling to the current slot is a no-op. Changed or cancelled appointments mark old reminders read. The patient notification migration adds a unique event index without deleting or backfilling existing records.

The API reminder job runs at startup and once per minute. Appointment times are interpreted in `Asia/Kolkata`; eligible visits are still booked, start in the next hour, belong to active patients and verified active dentists, and have paid or pay-at-clinic transactions. Past, cancelled, completed, in-consultation and unpaid online visits are excluded. Row locks and a schedule-revision event key prevent duplicate reminders across workers or restarts. Tests disable the automatic timer and invoke the real job with a controlled clock. Run the API continuously for reminder generation; the mobile inbox polls every ten seconds while active and refreshes on return from the background.

Patient phone push uses Firebase Admin with Application Default Credentials and an atomic `push_deliveries` queue. `PUSH_ENABLED=false` is the default. The additive push migration creates device/delivery tables and login session families without deleting existing data. Registering a phone requires a live signed patient session; rotation preserves the family and logout revokes that family's bindings. Workers recheck ownership, binding, read state and reminder timing before sending generic alerts containing only a notification ID. See [Firebase activation and device testing](../PUSH_NOTIFICATIONS.md) for credential paths, native configuration, retries and Apple/APNs prerequisites. Automated tests mock FCM and never use real device tokens.

```bash
npm run typecheck   # tsc --noEmit
npm run build       # nest build + tsc-alias (rewrites @common/* etc. to relative paths for dist/)
npm run test:e2e    # isolated Postgres schema; real API/database checks, mocked gateway calls
npm run create-admin -- <email> <password>  # provision an admin account directly
npm run seed                                # wipe every table and refill with a coherent demo dataset
```

`npm run seed` (`scripts/seed.ts`) is destructive — it truncates every table, including `users`, and refills them with one dataset: the same 9 dentists, 5 patients and 9 appointments as `../index.html` (same names, specializations, clinics, allergies, consultations, prescriptions), adapted to this schema's real constraints. It ends by printing a working admin login (`admin@dentra.in` / `Admin@123`, the prototype's own demo credentials) and dentist/patient mobile numbers, so there's always something real to log in with and look at right after running it. Re-run it any time the database accumulates e2e-test or manual-testing debris and you want it back to a clean, meaningful state.

`npm run test:e2e` needs a reachable Postgres at `DATABASE_URL` and permission to create a schema. It loads `schema.sql` into a uniquely named disposable schema, runs the suite with test-only secrets and mocked gateway order/refund calls, and drops only that schema afterward. Existing accounts, appointments and other application data are preserved. Webhook signatures and database handling are exercised locally without contacting Razorpay.

## What's stubbed, deliberately

- **SMS**: login and prescription signing log generated four-digit codes (`console.log`, see `[otp:stub]`) instead of sending them — the SMS vendor is still an open decision (see `../DENTRA_ARCHITECTURE.md`'s assumptions). Verification checks the generated code, five-minute expiry, and five-attempt limit; there are no bypass codes. Codes are single-use, including concurrent verification requests. Prescription confirmation uses the signing code; it is not a certificate-backed digital-signature provider integration.
- **Admin provisioning**: there's no self-serve admin signup endpoint, by design (see `../DENTRA_ARCHITECTURE.md`) — accounts are seeded directly with `scripts/create-admin.ts` (bcrypt password hash only). `POST /auth/admin/login` is email + password (bcrypt), covered end to end in `auth-admin-login.e2e-spec.ts`. TOTP 2FA was built and then removed — it had no real enrollment flow (the secret was only ever printed once to whoever ran the seed script), so it added friction without adding real security; worth revisiting with a proper enrollment UI later. `admin.e2e-spec.ts` (dentist review, audit log, privacy requests) still seeds its admin accounts directly and signs the token with the app's own `JwtService` rather than going through login each time — that's a test-speed shortcut, not a gap in login itself.
- **Privacy-request resolution**: `POST /privacy-requests/{id}/resolve` flips the status and logs to the audit trail, but doesn't yet trigger a real export-package or anonymization job — same not-yet-chosen-vendor pattern as document storage.
- **Payments**: Razorpay order creation, webhook signature verification and refunds are implemented. Admin Web reads recorded transactions through the admin-only `GET /admin/payments`, with search, status/method/IST date filters, pagination, totals across matching records, and non-secret test/live configuration metadata. This reporting route does not alter payment states or contact Razorpay. Cancellations durably queue full refunds, which stay processing until gateway confirmation. Retries use the same gateway idempotency key; background status reads recover missing payment/refund webhooks. New online holds expire after 15 minutes without changing legacy bookings. Admins can recheck failed saved requests with an audit entry. See [payment behaviour and testing](../PAYMENTS.md). Provider checkout and bank processing still need manual testing; automated tests mock outbound calls.

Admin login accepts an optional stable `deviceId`. Admin Web generates one per browser, providing independent refresh-token families instead of one shared `admin-web` slot. Older clients without the field retain the legacy slot. Access tokens use the configured TTL (15 minutes by default); refresh tokens rotate with a 30-day default TTL. Logout revokes the presented token's entire session family without affecting other browser families.

## Private file storage and hosting

Patient files, consultation chat attachments and dentist KYC documents support `STORAGE_PROVIDER=local` (default) or `supabase`. Cloud mode requires `SUPABASE_URL`, `SUPABASE_SECRET_KEY` and a private `SUPABASE_STORAGE_BUCKET`; the API checks the bucket before accepting traffic. Local directories are configured by `PATIENT_FILES_DIRECTORY` and `DENTIST_FILES_DIRECTORY`. Existing bytes must be copied to the corresponding keys before changing providers on a populated database.

All file routes retain their authentication and ownership checks. KYC downloads use `GET /dentists/applications/{dentistId}/documents/{documentId}` for the owning dentist or an admin. Uploads validate JPEG/PNG/PDF signatures and the 10 MiB size limit. Replacement KYC uploads use immutable names and remove the previous object only after the database commits. Interrupted commits or failed cleanup can leave unused private objects for operational reconciliation.

See [HOSTING.md](../HOSTING.md) for Supabase and Render configuration. Integration tests always use temporary local directories and a verified disposable database schema, even when the development `.env` selects Supabase.

## Admin profile and settings

Dentist payout submission and admin approval are implemented separately from profile editing and onboarding. See [payout details and review](../PAYOUTS.md) for the web workflow, additive migration, endpoints, and tests.

`GET/PATCH /admin/me` reads and updates the authenticated admin's name, actual login email and optional contact number. Changing the email requires the current password. `GET/PATCH /admin/settings` manages shared platform name, region and support email. Only active admins may use these endpoints. Updates normalize values, validate duplicate identities, check the submitted version, and write audit snapshots atomically with the data change. Passwords and hashes are never returned or audited. Unchanged saves preserve the version and add no audit entry.

Migration `1792245600000_admin_settings` adds `admin_profiles` and a singleton `platform_settings` table. Existing accounts keep their IDs, login emails and passwords. New and existing admins can read their actual email before their first profile edit; a generic display name is used until they save one. Admin Web consumes the platform metadata; patient/dentist clients retain their existing configuration.

## Video consultations

LiveKit is the video provider for both mobile apps and Dentist Web. The API checks appointment/session/payment eligibility, issues short-lived opaque participant tokens, verifies signed arrival webhooks and retries room cleanup. Configure `LIVEKIT_URL`, `LIVEKIT_API_KEY` and `LIVEKIT_API_SECRET` in the server environment and add the webhook URL as described in [LIVEKIT_SETUP.md](../LIVEKIT_SETUP.md). The existing `/video/token` route returns LiveKit connection credentials. Apply the additive restore-LiveKit migration before running the updated API; existing clinical/payment/chat records are preserved. Rebuild both native apps. Live-device verification requires a configured LiveKit project. Real SMS remains deferred.


## Working days and time off

Dentists can set separate video and per-clinic working days, and block full-day leave or repeating daily breaks across a date range. Time off previews affected appointments and requires those appointments to be moved or cancelled before saving. Patient booking and rescheduling enforce these settings on the backend. Existing bookings keep their time when working days change.

See [AVAILABILITY.md](../AVAILABILITY.md) for screens, API rules, migration, and verification.

## Payout batch ledger

`src/modules/payouts` retains earlier manual transfer batches alongside payout-account approvals and Wallet. Existing batches keep their saved amounts, fees and bank account snapshots and can progress through processing/paid/confirmed-failed/cancelled states. After global Wallet policy setup, new payouts use dentist withdrawal requests. Dentist batch history is owner-scoped and read-only. No bank transfer API is invoked.

Migration `1792843200000_payout_batches.sql` adds the immutable amount/account snapshots, unique active transaction/provider-capture reservations and retry events. Apply with `npm run migrate -- up` on other databases. See [PAYMENTS.md](../PAYMENTS.md) for state transitions, rounding, audit rollback, discrepancies and synthetic integration tests.

## Dentist Wallet

Wallet uses captured completed online earnings after immutable booking fee snapshots. Amount-based withdrawal requests reserve earnings under the dentist lock; admin review and manual transfer progress preserve retries, versions and audit history. Global fee/minimum settings start unset. Explicit fee assignment prices only earlier unpriced online bookings, preserving existing rates. Direct clinic collections are excluded.

Each admin decision saves an owner-only `wallet_withdrawal_updated` notification in the decision transaction. It contains the request ID, amount, status and decline/failure/cancellation reason, excluding bank details and transfer references. The inbox, individual reads and snapshot read-all support these updates with existing ownership rules. Failed decisions roll back their notifications; identical decision retries do not create extra alerts. Dentist background push is not enabled by this change.

Migration `1792846800000_dentist_wallet.sql` is applied locally. Run `npm run migrate -- up` on other databases before using the new booking fee column. Wallet read APIs do not mutate balances or create records. See [PAYMENTS.md](../PAYMENTS.md) for balance formulas, refund shortfalls, earlier batches, endpoints and tests.
