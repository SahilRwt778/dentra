# Patient photos and reports

Patients can take a photo, choose photos, or select PDF reports in **Book a visit → Step 2**. Each booking supports eight files, up to 10 MiB each. The API accepts JPEG, PNG and PDF signatures and ignores the client-provided MIME type when deciding how to serve content.

Uploads are initially private to the active patient account. Confirming a booking binds the selected file IDs inside the appointment/payment transaction. Only that patient and the appointment's active, verified dentist can retrieve the bytes. Another dentist treating the same patient on a different appointment has no access to those files. Admin accounts have no patient-file access.

Patient files appear in **My records → Files**, appointment details and completed visit summaries. The dentist can open photos and download PDF reports on the consultation page, including the **Photos and reports** side panel during a video call. Existing reports can be uploaded while booking; this does not generate a prescription or visit-summary PDF.

## Local setup

The additive migration `1792249200000_patient_files.sql` creates metadata only. Apply it with `npm run migrate -- up` in `dentra-api` if it has not been applied to your database. Existing appointments and payments are preserved.

The API defaults to private local storage at `dentra-api/uploads/patients`. `PATIENT_FILES_DIRECTORY` can select another directory. The directory is ignored by Git and must not be exposed by a static web server. Requests for file content always require a bearer token and an ownership check; no public or token-in-query URLs are issued. Downloads use `private, no-store`, attachment disposition and `nosniff` headers.

New native packages require a mobile rebuild, rather than a JavaScript reload. Dependencies are in `package-lock.json`; iOS pods are in `ios/Podfile.lock`. Start the API/web/Metro yourself, then use the usual `npm run android` or `npm run ios`. A physical iPhone is needed for testing camera capture if the simulator has no camera. Android uses system pickers and URI grants without broad storage permissions.

If the app reports missing `NativeDocumentPicker`, `launchCamera`, or `launchImageLibrary`, it is running a native build without the pickers. A Metro reload cannot add native modules. With Metro already running, run `npm run android -- --no-packager` from `dentra-mobile-patient` to build, install and reopen the Android app without starting another Metro process. `assembleDebug` alone only creates an APK; it does not install it. A normal reinstall/update preserves app data; uninstalling or clearing app storage is unnecessary.

## Retention and retries

- A stable upload key makes network retries return the same file ID. Reusing a key with different bytes fails with a conflict.
- Failed bookings roll back all file bindings. Retrying the original booking reuses its appointment idempotency key.
- Unused uploads become inaccessible after 24 hours. A job runs at API startup and every five minutes to remove expired/deleted draft bytes in batches of 100. It keeps metadata tombstones so old upload keys cannot accidentally recreate deleted files.
- Removing an unused upload denies access immediately. Saved booking attachments are retained as part of that appointment's records; they cannot be removed through the draft-delete endpoint.
- Mobile downloads live in the app's private cache, cleared at startup, logout and session loss. Results arriving after an account switch are discarded. Opening a file grants the selected native viewer access; the viewer controls any copy the user chooses to save.

For a deployment, use a persistent, backed-up private volume shared by all API instances, and HTTPS. This implementation uses local disk rather than object storage. File signatures and size limits do not replace a malware scanner. A process crash between writing a file and committing its metadata can leave an unreferenced disk file; those require an operational reconciliation job. There is no general patient-record retention/erasure workflow in this feature.

## Manual verification

1. Sign in as a patient and start a booking. At Step 2, capture/choose a photo and add a PDF. Cancel a picker and confirm that existing selections stay intact.
2. Disconnect the network while uploading. Confirm that Continue stays disabled for failed selections, then reconnect and retry or remove the failed file.
3. Finish booking with consent. View the files in appointment details and My records → Files.
4. Open that appointment as its assigned dentist. View the photo and download the report; during video, open the Photos and reports side panel.
5. Sign in as another patient/dentist and verify that the original file content URL returns 404. An admin must receive 403.
6. Leave a booking unfinished. Its unused upload can be removed from My records → Files; an expired draft must not open or bind to a later booking.

Automated coverage includes content/MIME/size validation, cross-account access, assignment, retry idempotency, rollback after a failed payment order, expiry/cleanup, quotas, picker cancellation/permission denial, partial uploads and downloads across session changes. Integration tests use a disposable PostgreSQL schema and temporary directory and never access existing patient files.
