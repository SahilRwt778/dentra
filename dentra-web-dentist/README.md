# dentra-web-dentist

The Dentist Web client for Dentra — Phase 3 of the rollout in [`../DENTRA_ARCHITECTURE.md`](../DENTRA_ARCHITECTURE.md). Same stack and conventions as [`dentra-web-admin`](../dentra-web-admin): Vite + React + TypeScript, Redux Toolkit + RTK Query (generated from `dentra-api`'s `openapi.yaml`, nothing hand-written per endpoint), and `src/styles/prototype.css` ported directly from `../index.html` — extended here with the dental-chart, prescription-sheet, and consult-layout rules Admin Web never needed.

## Running it

```bash
cp .env.example .env     # defaults to http://localhost:3000
npm install
npm run dev               # http://localhost:5175
```

Needs `dentra-api` running locally — its `.env` now allows both `http://localhost:5174` (Admin Web) and `http://localhost:5175` (this app) in `CORS_ORIGINS`. Use existing accounts and appointments, or create them through the onboarding and booking flows.

Login is mobile + a generated four-digit OTP, same as the patient flow — request a code, then read it from `dentra-api`'s server log (`[otp:stub] +91... code=XXXX`), since there's no real SMS vendor yet. Every code must match the backend's generated value; no fixed bypass code is accepted.

```bash
npm run build      # tsc -b && vite build
npm run gen:api     # regenerate src/api/generated-api.ts after openapi.yaml changes
```

## Auth and the status gate

`src/auth/dentist-gate.tsx` sits between the protected-route check and the app shell: a valid access token doesn't by itself mean there's a usable dentist profile behind it. It calls `GET /dentists/me` and renders one of three things:

- **404 or draft** → `OnboardingPage` — the self-serve "Apply to join Dentra" form (details and KYC documents). `POST /dentists/applications` saves a draft; `PATCH /dentists/applications/me` updates it. Multipart uploads use RTK Query with `FormData`, including normal token refresh. A failed upload keeps the draft and successful uploads, so the dentist can retry or resume after signing in again. `POST /dentists/applications/me/submit` checks the four required documents and sends the completed request to the admin queue as `pending_review`.
- **pending_review / rejected / disabled** → `AccountStatusPage`, with no portal navigation. Pending dentists see that their request was sent to admin. Rejected dentists see the admin's rejection reason. The page checks status every 10 seconds while focused, on reconnect/focus, and through a manual refresh button. Reconsideration remains admin-only.
- **verified** → the real app: Today, Schedule, Patients, Payments, Settings.

Profile-check errors show a retry screen and do not grant portal access. The API's global `DentistAccessGuard` also checks live approval state on protected routes: OTP alone allows onboarding and reading one's own status, while clinical APIs require an active, verified dentist. Admin approval unlocks the existing session; rejection or disable blocks it. The web client clears cached profile data when accounts change or log out.

To test manually: verify a new mobile number at `http://localhost:5175`, fill the application and upload degree, council registration, government ID and selfie, then submit. In Admin Web (`http://localhost:5174`), open **Waiting for verification**, inspect the request, and approve or reject it. The dentist tab updates automatically. No database migration is needed; this uses the existing `draft`, `pending_review`, `verified`, `rejected`, and `disabled` states.

## Two backend endpoints that didn't exist before this

Building Today/Patients/Patient-record surfaced real gaps in `dentra-api`, not just missing frontend code — fixed there, not worked around here:

1. **`GET /appointments`** (the patient/dentist-scoped endpoint, not Admin Web's platform-wide one) returned bare UUIDs for the other party — no name at all. `AppointmentsService`'s shared query now joins `patients`/`dentists` and the `Appointment` schema carries `patientName`, `patientAge`, `patientGender`, `dentistName`. Always safe to include: the caller is always either the patient or the dentist on the row.
2. **`GET /dentists/me/patients`** and **`GET /dentists/me/patients/{patientId}`** didn't exist at all — there was no way for a dentist to list their own patients or read one's chart and history. Added under `dentra-api/src/modules/care/patients/` (access-controlled by the appointment relationship, not a copy of `/patients/me`'s self-access rule) — a dentist who has never treated a given patient gets the same 404 an unrelated appointment owner would, never a 403 that would confirm the patient exists.

Both are covered end to end in `dentra-api/test/e2e/care.e2e-spec.ts`, verified with real HTTP calls against the real seeded data before this README was written, not just typechecked.

## The Consult page

The biggest single page in either web app — `src/pages/consult-page.tsx` — covers the prototype's `today()` → `consult()` pipeline: the "ready when you are" / in-progress / completed states, the editable dental chart (`src/components/dental-chart.tsx`, shared with the read-only patient record view), prescription items with a "preview and sign" modal, and reschedule. Allergy conflicts are **not** re-checked client-side — `dentra-api`'s `POST .../prescription/sign` already does that server-side (422 with a message naming the conflict), and the sign modal just surfaces whatever that response says and offers the `allergyOverrideAck` retry. One source of truth for that rule, not two.

The video panel uses LiveKit for patient-to-dentist calls, with waiting/presence, camera/microphone controls, screen sharing and private consultation chat. The API issues short-lived connection tokens; leaving the call keeps the consultation open. The connection and audio remain mounted above the router so minimizing and navigating preserve the call. See [LiveKit setup](../LIVEKIT_SETUP.md) and [video verification](../VIDEO_CONSULTATIONS.md).

## Payments dashboard

Open **Payments** in the sidebar for online paid amounts, clinic collections, outstanding fees and refund states. Search by patient or payment reference, filter source/status/transaction dates, and choose 20, 50 or 100 rows per page. Totals cover all matching transactions, independently of the visible page. **View details** opens the current receipt and gateway references with a link to its appointment.

Reports refresh while the page is focused and after appointment/payment updates. Receipt and report caches are removed when their views close; logout clears all API data. The dashboard displays payment states before fees and payouts. Patient checkout and provider confirmation remain in the patient app/API. See [PAYMENTS.md](../PAYMENTS.md) for API rules and manual verification. No migration or native rebuild is needed for the dashboard.


## Working days and time off

Dentists can set separate video and per-clinic working days, and block full-day leave or repeating daily breaks across a date range. Time off previews affected appointments and requires those appointments to be moved or cancelled before saving. Patient booking and rescheduling enforce these settings on the backend. Existing bookings keep their time when working days change.

See [AVAILABILITY.md](../AVAILABILITY.md) for screens, API rules, migration, and verification.


## Clinic payment collection

The appointment Payment card offers **Mark as paid** for an outstanding pay-at-clinic booking, including completed clinic visits. Confirm the full booked fee and Cash, UPI or Card only after receiving payment. Saved receipts appear in both dentist clients, Patient Mobile and Admin Payments. See [PAYMENTS.md](../PAYMENTS.md) for retry, cancellation, audit and migration rules.

## Payout history

Open **Wallet → Earlier payout batches** to view batches created before Wallet and their reserved/recorded-paid totals, filter status and paginate. **View payout** opens the saved fee, net amount, account ending, included collections, transfer reference and activity. Paid means admin recorded an external transfer; bank credit is confirmed through your bank. The list does not include clinic collections received directly by the practice.

Queries refresh while focused, remove unused receipt caches, and clear with logout. The new ledger requires migration `1792843200000_payout_batches.sql` in the API (applied locally). See [PAYMENTS.md](../PAYMENTS.md) for eligibility, manual processing and verification.

## Wallet

The **Wallet** sidebar entry shows available online earnings, reserved withdrawal amounts, total withdrawn, pending earnings and request history. Enter an amount, review the approved account ending, and confirm a withdrawal request for admin review. The minimum is enforced by the backend. Decline reasons and bank transfer evidence appear in request details. **Earlier payout batches** keeps prior history accessible.

The notification bell includes approvals, declines, processing, Paid, failed and cancelled withdrawals alongside bookings. Notifications include the amount and any decline/failure/cancellation reason and link to the request. Fresh events refresh active Wallet queries once and show a toast while the portal is open. An event already read on another device still refreshes balances without another toast.

Wallet excludes pay-at-clinic collections. Fees are saved with online bookings and already reflected in the available balance; withdrawals charge no additional fee. Unpriced older bookings and missing policy/account setup have explicit messages. Requests safely retry uncertain results using the same ID. See [PAYMENTS.md](../PAYMENTS.md) for fee setup, balances and migration `1792846800000_dentist_wallet.sql` (applied locally).
