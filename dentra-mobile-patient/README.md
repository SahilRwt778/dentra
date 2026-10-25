# Dentra Patient Mobile

React Native patient app built from the patient journeys and visual language in `../index.html`. It uses the live `dentra-api` contract through small feature API modules, backed by RTK Query.

## What is built

- Four-digit OTP login with backend verification, resend cooldown, secure session restoration, and logout with cache clearing and server revocation. There is no development bypass code.
- Registration with a native date-of-birth picker, calendar-date validation, personal details, language, consent, and conditional guardian fields for minors. Birth dates cannot be in the future; the selected local date is saved without a timezone shift.
- Four tabs: Home, Appointments, Records, and Profile, using the prototype’s teal palette, cards, date blocks, and navigation.
- Dentist search, specialty filters, pagination, public profiles, clinic locations, hours, and fees.
- Five-step booking: concerns, symptom details, visit type, dentist, then clinic/date/live slots/payment/consent. Retry requests reuse an idempotency key.
- Pay-at-clinic bookings and native Razorpay checkout. Checkout cancellation keeps the appointment available for retry. Payment status comes from the server, never from a successful client callback.
- Appointment details, cancellation, rescheduling, clinic directions, pull-to-refresh, and status polling.
- LiveKit video consultations with a joining lobby, media permissions, audio-only support, mute, camera switching, waiting/reconnection states and cleanup. See [video setup and testing](../VIDEO_CONSULTATIONS.md).
- Full paginated appointment history, completed visit summaries, prescriptions, native summary sharing, and a read-only FDI dental chart.
- Private camera/gallery photo and PDF report uploads while booking, upload retry/removal, appointment attachments and paginated files in My records. Only the patient and assigned dentist can read saved attachments. See [setup and manual tests](../PATIENT_FILES.md).
- Downloadable signed prescription and completed visit-summary PDFs from appointment details and visit records, using the phone's PDF viewer. See [document setup and testing](../CARE_DOCUMENTS.md).
- Persistent patient notification inbox with an unread Home badge, booking confirmations, cancellations, reschedules, one-hour reminders and completed visit summaries. Opening an update marks it read and opens the matching appointment or visit; older pages, retry and mark-all are supported. Updates poll every ten seconds while the app is active, pause in the background, and refresh appointment/record data on new arrivals.
- Firebase phone notification integration with explicit permission, token rotation, authenticated appointment/visit navigation, generic foreground banners, and logout cleanup. See [push setup and activation](../PUSH_NOTIFICATIONS.md); provider credentials and Apple/APNs activation are separate from the passing automated tests.
- Profile and medical-history editing, emergency contacts, privacy export/deletion requests, FAQs, and email support.

## Run locally

Use Node **22.23.2** (`nvm use`), the version in `.nvmrc`.

```sh
npm install
cp .env.example .env
npm start
```

In a second terminal:

```sh
npm run android
# or, after installing the iOS pods:
cd ios
pod install
cd ..
npm run ios
```

The API defaults to `http://10.0.2.2:3000` on Android and `http://localhost:3000` on iOS. For a physical device, set `DENTRA_API_URL` in `.env` to a reachable LAN address; use an HTTPS API for release builds. `DENTRA_SUPPORT_EMAIL` is also configurable. These are public build-time values; never put API secrets in this app. Restart Metro with `npm start -- --reset-cache` after changing them.

Run `dentra-api` separately with its database and required environment configured. Online checkout requires the API version that returns `payment.gatewayOrderId` and `payment.gatewayKeyId`, plus working Razorpay webhook delivery to `/payments/webhook`. No Razorpay signing secret is included in the mobile app. No money or provider calls are involved in the automated mobile tests.

## Verification

```sh
npm run typecheck
npm run lint
npm test -- --runInBand --watchman=false
npm run gen:api
```

The tests cover initial login rendering, booking requirements and submission, retry idempotency, guardian requirements, invalid dates, appointment ordering, phone normalization, concurrent session refresh, logout during refresh, notification event rendering/navigation, pagination/retry/read actions, background/resume synchronization, push permission and token rotation, account-switch isolation, encrypted offline logout, and authenticated push taps. Native SDKs are mocked for Jest; a passing test does not verify a real payment or FCM delivery.

API types and HTTP endpoints are generated from `../dentra-api/openapi.yaml`; keep contract changes there and regenerate. Screens use readable feature hooks such as `useAppointmentQuery(id)` and async actions such as `reschedule(id, date, time)`. See the [API structure and examples](src/api/README.md). The generated implementation stays in `src/api/generated/`, and the generator includes only the patient app's endpoints. The Metro configuration explicitly resolves Lucide’s CJS entry and supports `.mjs` sources.

## Provider and API boundaries

Video calling uses the API’s appointment-scoped LiveKit integration; see [setup, joining rules and testing](../VIDEO_CONSULTATIONS.md). SMS delivery is still the API’s development stub. OS push requires Firebase credentials and device setup described in the [push guide](../PUSH_NOTIFICATIONS.md). Photo/report uploads use private API storage as described in the [file guide](../PATIENT_FILES.md), and clinical PDFs use the [document endpoints](../CARE_DOCUMENTS.md). Actual privacy export/erasure processing remains to be implemented. Support opens the user’s email app for review; it does not pretend to submit a ticket. Mobile numbers and dates of birth remain read-only after registration because the current profile-update contract does not support changing them.

The OTP bypass has been removed. Payment confirmation and refunds now use locked transitions, durable idempotent refund jobs and provider reconciliation; see [payment behaviour and testing](../PAYMENTS.md). This does not replace the remaining backend security review or manual provider checkout testing.

LiveKit requires server-side project configuration and a native rebuild of both apps. See [LIVEKIT_SETUP.md](../LIVEKIT_SETUP.md). Keep `packages/dentra-video` and `packages/dentra-call-core` alongside the app when installing dependencies. LiveKit API secrets belong only in the backend environment. Screen sharing and private chat are described in [CALL_COLLABORATION.md](../CALL_COLLABORATION.md).
