# Patient push notifications

Dentra's Firebase project is `dentra-a5c03`. Both native apps use the identifier `com.dentra.patient`. The API keeps the persistent inbox in PostgreSQL and uses Firebase Cloud Messaging (FCM) to alert registered patient phones. Dentist and admin web inboxes continue to work through their existing polling.

Local setup on 17 October 2026: the server credential is installed with owner-only file permissions, Google accepted its credentials, and the running API reports delivery enabled. Android push is enabled locally and the rebuilt debug app is installed on the emulator. Notification permission is granted, the signed-in device is registered, and Firebase accepted both a dry run and one live test alert. Android's notification service confirmed that the test alert was posted while Dentra was in the background. No appointment data was created or changed. A real appointment notification's tap/navigation flow remains a manual check; automated mobile tests cover authenticated navigation. iOS push remains disabled pending APNs.

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
