# dentra-web-admin

The Admin Web client for Dentra — Phase 2 of the rollout in [`../DENTRA_ARCHITECTURE.md`](../DENTRA_ARCHITECTURE.md). Talks to [`dentra-api`](../dentra-api) over its OpenAPI contract; no shared package between them — this repo generates its own types directly from `../dentra-api/openapi.yaml`.

## Stack

- Vite + React + TypeScript
- Redux Toolkit + RTK Query, with the entire API layer (`src/api/generated-api.ts`) generated from `openapi.yaml` via `@rtk-query/codegen-openapi` — nothing there is hand-written per endpoint
- React Router
- **Styling: `src/styles/prototype.css`, ported directly from `../index.html`'s `<style>` block** — the same CSS variables (`--accent`, `--ink`, `--line`, ...), the same class names (`.card`, `.btn-primary`, `.po-side`, `.verify-card`, ...), the same responsive breakpoints. Not shadcn/ui, not Tailwind's default theme — Tailwind is still installed for layout utilities (`flex`, `gap-*`, arbitrary values), but every visual component comes from the ported stylesheet so the admin portal looks like the prototype, not like a generic shadcn app. If the prototype's design changes, update `prototype.css` to match — it's a straight port, not an interpretation.

## Running it

```bash
cp .env.example .env     # defaults to http://localhost:3000, dentra-api's default port
npm install
npm run dev               # http://localhost:5174
```

Needs `dentra-api` running locally with CORS configured for this origin — its `.env.example` defaults `CORS_ORIGINS` to `http://localhost:5174` already. Sign in with an existing admin account. If needed, `npm run create-admin -- <email> <password>` in `dentra-api` provisions an admin without resetting existing data. Appointments and payments created through the patient app appear in the corresponding admin pages.

```bash
npm run build      # tsc -b && vite build
npm run gen:api     # regenerate src/api/generated-api.ts after openapi.yaml changes
```

## How the API layer works

`src/api/base-api.ts` is an empty `createApi()` — `openapi-config.js` + `npm run gen:api` injects every endpoint into it from `openapi.yaml`, producing `src/api/generated-api.ts` with a typed hook per operation (`useGetAdminDentistsQuery`, `usePostAdminDentistsByDentistIdApproveMutation`, ...). Pages never hand-write a fetch call; they import the hook for the endpoint they need. `tag: true` in the codegen config means mutations and queries sharing an OpenAPI tag (e.g. everything under "Admin") auto-invalidate and refetch each other — approving a dentist refreshes both the dentist list and the audit log without any manual cache-busting code.

Auth uses `src/store/auth-slice.ts` for the access token and `src/auth/refresh-token-storage.ts` for the rotating refresh token in localStorage. The configured defaults are 15 minutes and 30 days respectively. Reload restoration and expired API requests share `session-refresh.ts` and one in-flight rotation, including React StrictMode's repeated effects. Where available, a browser Web Lock serializes rotations across tabs. A delayed 401 retries with an already-renewed access token. Auth endpoints do not recursively trigger refresh.

Network outages, rate limits and server errors preserve the saved session; startup shows a retry screen rather than discarding it. Only an explicit invalid/revoked/expired refresh response clears it. Responses from an old request cannot restore a session after logout or replace a newer login. Each browser persists an independent admin device ID, so signing in elsewhere no longer replaces its refresh-token family. Logout revokes that family. Sign in again once after upgrading to establish the browser-specific session.

Run `npm test` with Node 22 to exercise refresh races, transient failures, token rotation, cross-tab coordination and logout with the built-in test runner, then payout component checks with Vitest. No browser or project servers are started by these tests.

## Dentist Review

Mirrors `../index.html` (the original prototype) rather than a generic filterable table: three sections shown at once — pending applications as cards with a document checklist (`src/components/document-checklist.tsx`), a verified-dentists table, and a disabled/rejected table. The required-document set (`degree`, `council`, `id_proof`, `selfie` — not `clinic_proof` or `insurance`) matches the prototype's `KYC_DOCS` and `dentra-api`'s `REQUIRED_DOC_TYPES` exactly; keep all three in sync if that rule ever changes.

KYC documents (a government ID, a selfie) are never served as static files — `GET /dentists/applications/{dentistId}/documents/{documentId}` requires the owning dentist's or an admin's bearer token. `ViewDocumentLink` in `document-checklist.tsx` fetches with that header, turns the response into a blob URL, and opens it in a new tab — a plain `<a href>` can't attach an Authorization header, so it can't be used here.

"Move to review" (rejected → pending_review, for after a dentist resubmits) isn't in the original `openapi.yaml` — it existed in the prototype but not yet in `dentra-api`'s contract, so it was added here too: `POST /admin/dentists/{dentistId}/reconsider`, in both repos, with e2e coverage in `dentra-api`.

## Nav and pages

Six nav items: `Overview`, `Appointments`, `Review Queue`, `Dentists`, `Payments`, `Settings`. The first five of the prototype's — `Overview`, `Appointments`, `Dentists`, `Payments`, `Settings` — plus one deliberate departure from it: the prototype's `dentists()` screen put the pending-review cards and the verified-dentist roster on one page; here they're split. `Review Queue` (`/dentists/review`, `src/pages/dentist-review-page.tsx`) is just the pending applications — the document checklist, approve/reject — with the pending-count badge; `Dentists` (`/dentists`, `src/pages/dentists-page.tsx`) is the roster — verified dentists plus disabled/rejected — with no action queue mixed in. Same `GET /admin/dentists?status=pending_review` endpoint underneath, just two screens instead of one.

`Overview` and `Appointments` needed a real backend capability that didn't exist before: `dentra-api`'s `GET /admin/appointments` (`?filter=today|upcoming|past`), platform-wide across every dentist, with patient/dentist names already joined in (`AdminAppointmentsService`, under `AdminModule`) — unlike `GET /appointments`, which stays scoped to the calling patient or dentist. `src/components/appointment-table.tsx` is the shared table both pages render, a straight port of the prototype's `apptTable()`.

`Settings` folds together `Profile`, `Platform`, `Privacy and data requests`, and `Audit log`, matching the prototype's single `asettings()` screen rather than separate top-level pages.

**A real bug this surfaced**: `src/styles/prototype.css`'s `.po-nav button` rule never matched anything, because `AppShell` renders the nav with React Router's `NavLink` (an `<a>` tag), not a `<button>` the way the prototype's click-handler-based routing did — so the entire sidebar nav was unstyled from the first version of this rewrite until it was reported and fixed. Now `.po-nav a, .po-nav button` covers both. Worth remembering: a ported class name matching the prototype's CSS doesn't mean it's actually being applied — check what HTML element the framework actually renders, not just what the prototype's markup used.

## Payments

`Payments` reads real transaction records from the admin-only `GET /admin/payments` endpoint. It displays patient and dentist names, transaction and gateway references, appointment times, methods, saved statuses and amounts. Search, status/method filters, IST transaction dates and pagination are supported. Summary totals cover all matching records, including records on other pages. The page refreshes every 15 seconds and supports manual refresh.

The Razorpay badge reports the API's current test/live configuration; it does not claim to verify live provider connectivity. Only configuration metadata is returned, never credentials. Online payment capture is handled by the existing signed Razorpay webhook. The former demo transactions and local-only Mark paid action have been removed. No transactions are changed by viewing this page. Processing and failed refunds have separate totals and statuses. The explicit Recheck refund action requeues a saved failed request using its existing key and records an audit entry; it does not create another refund if a gateway refund ID already exists. See [payment behaviour and testing](../PAYMENTS.md).

## Admin settings

Profile and Platform read from `GET /admin/me` and `GET /admin/settings`, and save through their PATCH endpoints. Values persist in PostgreSQL and reload from the API. The sidebar uses the saved admin name/email and platform name. Profile caches clear when signing out or signing in to another account.

The profile email is the actual login email. Changing it requires the current password; subsequent sign-ins use the saved email and existing password. Names and optional contact numbers can be edited separately. The server normalizes email/phone values, rejects duplicates and restricts access to active admins. Each profile is scoped to the caller's account.

Profile and platform forms submit the last-read version to reject stale edits. On a conflict, cancel editing and reopen the form to use the latest saved values. Successful changes and their audit snapshots commit in the same transaction; unchanged saves add no audit entry. Passwords and hashes never appear in profile responses or audit snapshots. Platform metadata is currently consumed by Admin Web; other clients retain their existing configuration.

Apply `npm run migrate -- up` in `dentra-api` before using these endpoints. Migration `1792245600000_admin_settings` adds two tables and persists the existing platform defaults without modifying accounts, appointments or payments. Eleven integration tests cover access, persistence, real login-email changes, validation, conflicts, audit rollback and no-op saves.

## A note on verification

Payment reporting and refund recovery are covered by backend integration tests for admin access, totals, filters, IST date boundaries, pagination, validation, empty results, webhook updates, retry keys and audit entries. The admin production build passes. Login and payment reporting were also checked against the running API. The updated Payments layout still needs a manual browser pass, including at a phone width.

## Payout transfers

Open **Withdrawals → Earlier payout batches** for manual batches created before Wallet. **Payout review** separately approves bank details. Existing batches retain their saved fees and account snapshots and can continue through processing to Paid after an external transfer is confirmed. New payouts use dentist withdrawal requests once the global Wallet policy is configured. Failed transfers stay reserved; confirmed cancellation releases their collections.

Read [PAYMENTS.md](../PAYMENTS.md) for state rules, reconciliation, privacy and migration `1792843200000_payout_batches.sql` (applied locally). No money is transferred by these screens. Lost-response retries preserve their exact request IDs and payloads. `npm test` includes real Redux/fetch component tests for confirmations and retry behaviour, plus the existing auth unit tests.

## Wallet withdrawal review

Open **Withdrawals** to review dentist-submitted requests, filter status, search names/references and adjust page size. Open a request to approve or decline; declining requires a reason and releases the reservation. Approval is separate from processing and recording the full external bank transfer. The existing in-app bell opens new withdrawal requests. **Earlier payout batches** preserves older transfer history.

In **Settings → Wallet and withdrawals**, configure the global platform fee and minimum amount. Both start unset. New online bookings save the fee; existing assigned rates never change. The form can explicitly assign the chosen rate to earlier unpriced online bookings. Pay-at-clinic fees remain deferred. Read [PAYMENTS.md](../PAYMENTS.md) for states, refund adjustments, migration and verification.
