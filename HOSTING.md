# Hosting Dentra for testing

Deploy the API first, then the two web portals. PostgreSQL and private files live in Supabase; LiveKit Cloud supplies video. The mobile apps connect to the hosted API after its URL is known.

| Component | Hosting | Repository configuration |
| --- | --- | --- |
| NestJS API | Render Free web service | `render.yaml` |
| Admin and dentist portals | Render static sites | `render.web.yaml` |
| PostgreSQL | Existing Supabase project | API `DATABASE_URL` |
| Private photos, reports, chat files and KYC documents | Supabase private bucket | API `SUPABASE_*` variables |
| Video consultations | LiveKit Cloud | API `LIVEKIT_*` variables |

## 1. Supabase prerequisites

The existing project has already received `dentra-api/schema.sql` and its migration history has been baselined. Do not import the schema again or fake future migrations. Apply later updates normally with `npm run migrate -- up` against the intended database before deploying code that needs them.

Use **Connect → Session pooler**, port **5432**, for `DATABASE_URL`. Keep the complete username, URL-encoded database password and SSL parameters from your working connection string. This is a PostgreSQL connection string, not the Supabase project HTTPS URL or an API key. The API does not use Supabase's Data API; it may remain disabled.

The Storage bucket must be named **`dentra-private`**, with **Public bucket disabled**. A maximum upload size of **10 MiB (10,485,760 bytes)** and allowed MIME types `image/jpeg`, `image/png`, `application/pdf` match the API. No browser/mobile Storage policies or public URLs are needed: the API checks Dentra authentication and ownership before accessing the bucket with its server key.

Set these API environment variables:

```dotenv
STORAGE_PROVIDER=supabase
SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
SUPABASE_SECRET_KEY=YOUR-SERVER-SECRET
SUPABASE_STORAGE_BUCKET=dentra-private
```

Obtain the server secret from **Project settings → API Keys → Secret keys** (`sb_secret_…`). Store it only in the ignored API `.env` and Render's API environment settings. Never put it in `VITE_*`, mobile configuration, GitHub or a screenshot. [Supabase key documentation](https://supabase.com/docs/guides/getting-started/api-keys).

The API checks that the bucket exists and is private at startup. Patient/chat objects use `patients/<file-id>`; dentist documents use `dentists/<dentist-id>/<versioned-name>`. Database metadata and authenticated download URLs remain unchanged. Local development can instead select `STORAGE_PROVIDER=local` with `PATIENT_FILES_DIRECTORY` and `DENTIST_FILES_DIRECTORY`.

Changing providers does not migrate existing bytes. Copy any existing local objects to the matching private keys before switching an existing database. For the current fresh Supabase database, no file metadata existed when cloud storage was verified.

## 2. Push the prepared code to GitHub

From the workspace root, review `git status` and `git diff`. Commit the intended source, lockfile, tests, documentation and the two Render YAML files, then push your branch. The API `.env`, `.secrets` and uploads must stay ignored; Render receives secrets separately.

Render builds from GitHub, so uncommitted local changes are not deployed.

## 3. Deploy the API

1. Sign in to [Render](https://dashboard.render.com/) with access to the GitHub repository.
2. Select **New → Blueprint**, connect the repository and choose the branch you pushed.
3. Use **`render.yaml`** as the Blueprint file. It creates one **Free** Node service in Singapore, with root directory `dentra-api`.
4. Enter the prompted values below. Confirm the service uses Free, then deploy.

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | The working Supabase **session pooler** connection string from your API `.env` |
| `SUPABASE_URL` | Your Supabase project HTTPS URL |
| `SUPABASE_SECRET_KEY` | The server secret used for the private bucket |
| `CORS_ORIGINS` | Initially `http://localhost:5174,http://localhost:5175`; replace/add the actual portal HTTPS URLs in step 4 |
| `RAZORPAY_KEY_ID` | Your Razorpay **test** key ID |
| `RAZORPAY_KEY_SECRET` | The corresponding test key secret |
| `RAZORPAY_WEBHOOK_SECRET` | The secret you choose for the hosted Razorpay webhook |
| `LIVEKIT_URL` | Your LiveKit Cloud project's secure `wss://…livekit.cloud` URL |
| `LIVEKIT_API_KEY` | Your LiveKit Cloud API key |
| `LIVEKIT_API_SECRET` | Its matching API secret |

The Blueprint generates separate random `JWT_ACCESS_SECRET` and `OTP_HASH_SECRET` values and sets Node 22.23.2, `NODE_ENV=production` and Supabase storage. Keep generated secrets stable across redeploys. New hosted sessions are independent of local sessions signed with other secrets. Render supplies `PORT` automatically.

Build command: `npm ci --include=dev --legacy-peer-deps && npm run build`. Start command: `npm run start:prod`. No persistent Render disk is required.

After deployment, open `https://YOUR-API.onrender.com/health` and check for `status: "ok"`. The endpoint is a process health check; also exercise sign-in and an authenticated file upload/download to verify the database and storage. API documentation is at `/docs`.

Provision the admin separately if this new database has none. From `dentra-api`, using Node 22 and the `.env` targeting that database:

```sh
node --env-file=.env -r ts-node/register scripts/create-admin.ts admin@dentra.com 'CHOOSE-A-STRONG-PASSWORD'
```

This creates the admin or resets that email's password. Do not run `npm run seed` on this database: it truncates application data. Free Render services have no interactive shell, so provisioning and migrations run from your trusted local checkout. [Render Free limitations](https://render.com/docs/free).

## 4. Deploy both web portals

1. Create a **second Blueprint** for the same repository/branch and choose **`render.web.yaml`** as its Blueprint path.
2. For **both** `VITE_API_BASE_URL` prompts, enter the API origin from step 3, e.g. `https://YOUR-API.onrender.com`, with no trailing slash or `/docs`.
3. Deploy the static sites and record their actual HTTPS URLs.
4. Open **dentra-api → Environment**, set `CORS_ORIGINS` to those two exact origins separated by a comma, then save/redeploy the API. Keep localhost origins only if you still need them.

The static-site builds run from the repository root so the dentist portal can resolve `packages/dentra-call-core`. Each site includes an SPA rewrite to `/index.html`, allowing refreshes of routes such as `/schedule` and `/consult/...`.

`VITE_API_BASE_URL` is embedded during the build. Redeploy a portal after changing it. Server secrets belong only to the API service. Render prompts for `sync: false` variables at initial Blueprint creation; add later credentials manually in the service's Environment settings. [Render Blueprint reference](https://render.com/docs/blueprint-spec).

## 5. Enable integrations

Video is enabled in `render.yaml` for the configured LiveKit Cloud deployment; its project settings are supplied through Render. The phone push enable switch is supplied through Render (`sync: false`), so later Blueprint syncs preserve your choice. Leave it disabled until the Firebase secret file is installed.

- **Video:** add `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` to the API service and set `VIDEO_ENABLED=true`. Use a reachable secure Cloud URL, not a local LiveKit server. Set the LiveKit webhook to `https://YOUR-API.onrender.com/video/webhook` with the matching signing key. See [LIVEKIT_SETUP.md](LIVEKIT_SETUP.md).
- **Payments:** configure the Razorpay test webhook at `https://YOUR-API.onrender.com/payments/webhook` with the same `RAZORPAY_WEBHOOK_SECRET`. Follow [PAYMENTS.md](PAYMENTS.md) for events, signatures, checkout and refund verification.
- **Push:** upload the existing Firebase service-account JSON as Render **Secret File** `firebase-service-account.json`. Set `GOOGLE_APPLICATION_CREDENTIALS=/etc/secrets/firebase-service-account.json`, `FIREBASE_PROJECT_ID=dentra-a5c03`, and `PUSH_ENABLED=true`, then save/deploy. The Blueprint defines the project and mounted path; the credential contents are installed through Render's Environment page. Do not copy the local computer's credential path to Render. Follow the hosted activation and phone test in [PUSH_NOTIFICATIONS.md](PUSH_NOTIFICATIONS.md).

Real SMS remains deferred. For testing, generated OTPs still appear in the API's private logs.

## 6. Connect the mobile apps and verify

Patient Mobile reads `DENTRA_API_URL` from `dentra-mobile-patient/.env`; `.env.example` includes `https://dentra-api-gwo6.onrender.com`. Dentist Mobile uses that same hosted origin in `dentraDentist/src/common/config/api.ts` for development and release. Restart Metro with `npm start -- --reset-cache` in each app folder and reload the app after changing its configuration. Neither app receives database or Supabase server credentials. Distribute a rebuilt bundle to update an installed release app.

Verify patient sign-in → booking → test payment → dentist appointment → consultation → completed records, plus dentist onboarding → admin document review. Upload a synthetic photo/PDF, check authorized downloads, redeploy the API and confirm those files still open. Test video, chat attachments, screen sharing and Home/PiP on real devices after enabling LiveKit. Browser camera/screen capture requires HTTPS (localhost is a development exception).

## Free-tier operating limits

Render's Free API sleeps after 15 idle minutes and can take about a minute to wake. Its local filesystem is ephemeral. This setup therefore uses private Supabase storage for durable uploads. In-process reminder, refund-retry, room-cleanup and draft-file-cleanup jobs pause while the API sleeps and resume when it runs. [Render documents these Free limits](https://render.com/docs/free).

Use this deployment for manual testing with synthetic records. Reliable scheduled work and real patient use need an always-running API, suitable backups and a production deployment review. Monitor provider usage limits; a free plan is not unlimited storage, bandwidth or video minutes.
