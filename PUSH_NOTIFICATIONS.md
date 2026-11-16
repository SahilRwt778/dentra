# Patient push notifications

Dentra's Firebase project is `dentra-a5c03`. Patient Android and iOS use the identifier `com.dentra.patient`. The API keeps the persistent inbox in PostgreSQL and uses Firebase Cloud Messaging (FCM) to alert registered patient phones. Dentist and admin web inboxes continue to work through their existing polling.

Local setup on 17 October 2026: the server credential is installed with owner-only file permissions, Google accepted its credentials, and the running API reports delivery enabled. Android push is enabled locally and the rebuilt debug app is installed on the emulator. Notification permission is granted, the signed-in device is registered, and Firebase accepted both a dry run and one live test alert. Android's notification service confirmed that the test alert was posted while Dentra was in the background. No appointment data was created or changed for that initial alert. The initial test did not verify a real appointment notification's tap/navigation flow; hosted verification is recorded below. iOS push remains disabled pending APNs.

Hosted verification on 16 November 2026: patient Android registered against `https://dentra-api-gwo6.onrender.com`. A reschedule performed through Dentist Web created deliveries that the Render worker sent successfully; the hosted records contain provider message IDs with no delivery error. The user confirmed that the background phone alert arrived and tapping it opened the correct appointment. The earlier `app/invalid-credential` error was resolved by correcting the Render service-account Secret File and credential path. Earlier read notifications were intentionally skipped. Booking, cancellation, reminders, visit-summary alerts and account isolation retain automated coverage; those other event types were not separately exercised on a phone during this hosted test.

## Hosted activation on Render

Use the existing Firebase project and credential; another project or key is not required. The local patient app already points to `https://dentra-api-gwo6.onrender.com` with `DENTRA_PUSH_ENABLED=true` and `DENTRA_PUSH_IOS_ENABLED=false`.

1. Open **Render → dentra-api → Environment → Secret Files → Add Secret File**. Use filename **`firebase-service-account.json`**. Copy the contents of the local ignored `dentra-api/.secrets/firebase-service-account.json` into Render's Contents field. Keep this file out of chat and Git. Render makes it available at `/etc/secrets/firebase-service-account.json`.
2. Set these API environment variables, then save and deploy:

   | Variable | Value |
   | --- | --- |
   | `PUSH_ENABLED` | `true` |
   | `FIREBASE_PROJECT_ID` | `dentra-a5c03` |
   | `GOOGLE_APPLICATION_CREDENTIALS` | `/etc/secrets/firebase-service-account.json` |

   The Blueprint defines the project and mounted path, with `PUSH_ENABLED` set to `sync: false` so later syncs preserve the enable switch configured in Render. Existing Blueprints ignore new `sync: false` entries; add the values manually on the service. For a new deployment, leave push disabled until the secret file is installed. Never use the local Mac credential path on Render.
3. Wait for the API to show Live and `/health` to return 200. Sign in to Patient Android against the hosted API, open **Notifications → Enable phone notifications**, and grant permission. An older installation may need a native rebuild if it does not contain Firebase Messaging; a configured installation only needs a reload after public environment changes.
4. Confirm registration through the authenticated `GET /notifications/push-device` (`available: true`) and `PUT /notifications/push-device` requests. Availability reports the enable switch; successful FCM delivery still needs the matching secret file, valid service-account access, and a current phone registration.
5. Put the patient app in the background. Make one disposable appointment update through Dentist Web, such as rescheduling an eligible test booking. Confirm a generic phone alert arrives, tap it, and verify the correct appointment opens. For a completed test visit, verify the visit-summary alert opens the summary. Registration does not replay earlier inbox history.

The Free Render service sleeps during inactivity. Its in-process push and reminder workers pause while it sleeps; reliable reminders require an always-running API. This deployment can verify phone delivery while the API is awake. No app-side polling can deliver a background alert while the server worker is asleep.

These steps configure patient phone delivery only. They do not enable dentist phone push or Apple APNs. See [Render Secret Files](https://render.com/docs/configure-environment-variables#secret-files) and [Firebase Admin credentials](https://firebase.google.com/docs/admin/setup).

### Registered phone but no alert

If an appointment event has queued deliveries with `last_error_code=app/invalid-credential`, the hosted worker reached Firebase initialization but could not load or use its server credential. A registered phone and `available: true` do not prove the server credential is valid. Check the API service's Secret File filename and `GOOGLE_APPLICATION_CREDENTIALS` together. Replace the Secret File contents with the complete original service-account JSON, including its `type: service_account`, project ID, client email and private key. The Android `google-services.json` and Apple plist are client configuration files and cannot authenticate the server. Keep private key contents out of logs, chat and Git.

Save/deploy the corrected configuration. Unread pending deliveries retry automatically while their sessions and device bindings remain active; a fresh appointment update is useful if the old event was read or expired. Do not reset delivery state manually or create another appointment solely to hide a credential error.

## Local activation

The Android and Apple client configuration files are already installed locally and ignored by git:

- `dentra-mobile-patient/android/app/google-services.json`
- `dentra-mobile-patient/ios/DentraMobilePatient/GoogleService-Info.plist`

Other developers can download matching files from Firebase Console → Project settings → General → Your apps. Client configuration files are not backend credentials. Never copy a service-account private key into a mobile app.

The API needs a server credential before delivery can be enabled. For local development, an authorised project owner can open Firebase Console → Project settings → Service accounts → Firebase Admin SDK and generate a private key. Save it locally as `dentra-api/.secrets/firebase-service-account.json`. Keep the file private and out of version control. On hosted infrastructure, prefer an attached service identity with Application Default Credentials rather than a downloaded key.

Set these values in `dentra-api/.env`, then restart the API:

```dotenv
PUSH_ENABLED=true
FIREBASE_PROJECT_ID=dentra-a5c03
GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/dentra-api/.secrets/firebase-service-account.json
```

Set `DENTRA_PUSH_ENABLED=true` in `dentra-mobile-patient/.env`. Leave `DENTRA_PUSH_IOS_ENABLED=false` while APNs is pending. Restart Metro with `npm start -- --reset-cache`, and rebuild the native app. JavaScript reload alone cannot add the Firebase native modules.

```sh
# dentra-mobile-patient, Node 22
npm run android

# iOS dependencies, then build
cd ios
pod install
# If the CocoaPods CDN fails with HTTP/2 transport errors:
ruby ../scripts/pod-install-http1.rb install --repo-update
cd ..
npm run ios
```

The optional CocoaPods wrapper selects HTTP/1.1 for that process only and retains normal TLS verification.

Sign in again after upgrading from an older API version so the access token includes the new login session claims. In the patient app, open Notifications → Enable phone notifications and accept the OS permission request. The app checks availability without automatically prompting on login. An Android emulator needs Google Play services; a physical Android phone also works.

## Apple delivery pending

iOS native dependencies, Firebase initialisation, background remote notification mode, and APNs entitlements are prepared. Delivery is not activated: the project owner does not yet have an Apple Developer membership or an APNs key.

After obtaining membership, enable Push Notifications for `com.dentra.patient` in the Apple developer account, configure signing/provisioning in Xcode, create an APNs authentication key, and upload it with its key ID and team ID under Firebase Project settings → Cloud Messaging → the Apple app. Keep the `.p8` key private. Set `DENTRA_PUSH_IOS_ENABLED=true`, restart Metro and rebuild. Test on a correctly signed supported Apple device. An unsigned simulator build passing does not verify APNs delivery. The in-app inbox works while this is pending.

## Delivery and account behaviour

- Booking confirmation, cancellation, rescheduling, reminders, and completed visit summaries create inbox events and device deliveries in the same transaction. New device registrations do not replay old inbox history.
- The API worker claims queued deliveries every ten seconds, retries temporary failures with backoff, reclaims expired worker leases, and disables invalid or unregistered FCM tokens. General alerts expire after 24 hours; reminders expire by the appointment start. Read updates and obsolete reminders are skipped before sending.
- Alerts say only “You have a new appointment update. Open Dentra to view it.” FCM receives an opaque notification ID; names, appointment dates and clinical details stay out of the push payload. Queued offline Android alerts may collapse into the latest alert; all events remain in the inbox.
- Taps fetch the notification through the authenticated API, enforce recipient ownership, and open the appointment or completed visit. Foreground messages refresh relevant data and show a generic dismissible banner.
- Device bindings belong to a signed installation and login session. Token rotation and account changes invalidate previous queued bindings. Logout stops listeners immediately, deletes the native token, clears cached patient data, and revokes the login's server binding. Offline logout revocations stay in Keychain and must complete before a new push binding can register.
- Push is best effort; OS settings, connectivity and provider behaviour can delay delivery. Provider acceptance is not proof that a device displayed the alert. A delivery already submitted to FCM cannot be recalled on logout; its generic content and authenticated tap protect private records.

## Verification

API E2E tests run against a disposable database schema and mock outbound FCM delivery. They exercise real session/binding checks, queue transactions, retries, worker leases, logout/refresh and cross-account isolation. Mobile tests cover explicit permission requests, disabled delivery, token rotation, logout races, encrypted offline revocation, and authenticated notification navigation. Native Android/iOS builds verify SDK integration; a real provider/device delivery test is separate.

Manual check after activation:

1. Enable notifications as a patient, then put the app in the background.
2. Book/reschedule/cancel a visit or complete it from Dentist Web. Confirm a generic OS alert arrives and the inbox has one matching event.
3. Tap the alert and confirm it opens the correct appointment or visit summary.
4. Deny permission in OS settings, return to the app, then re-enable and retry registration.
5. Log out, sign in as another patient, and verify the previous patient's events do not open or generate new alerts on that installation.

References: [React Native Firebase setup](https://rnfirebase.io/), [Messaging usage](https://rnfirebase.io/messaging/usage), [Apple/APNs setup](https://rnfirebase.io/messaging/usage/ios-setup), [Firebase Admin credentials](https://firebase.google.com/docs/admin/setup), [FCM error codes](https://firebase.google.com/docs/cloud-messaging/error-codes).
