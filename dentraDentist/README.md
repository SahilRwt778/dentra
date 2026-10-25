# Dentra Dentist mobile

React Native app built in your `src/features`, `components`, `api`, and `common` folder structure. It uses the existing Dentra API and admin approval process.

Implemented features:

- Mobile verification with the backend's four-digit OTP; no fixed-code bypass.
- New dentist application, professional details, fees, and required document uploads.
- Recovery of saved drafts and partial uploads after an interrupted submission.
- Pending review, rejected (with admin reason), and disabled account screens. Only `verified` accounts see the main tabs; the API also enforces this.
- Today’s queue, day selection with Today/Tomorrow/dates and week navigation, pagination, pull to refresh, and foreground updates.
- Appointment details, patient-reported symptoms, and payment status.
- Arrival check-in for today's booked clinic visits, rescheduling with live availability, and confirmed appointment cancellation.
- A prototype-based Patients tab with local name/phone search, allergy indicators and completed-visit dates.
- Read-only patient profiles with guardian/contact details, medical history, the current dental chart and appointments with the signed-in dentist.
- Prototype-based profile cards, editable professional details, clinic locations, consultation fees/video hours, and logout.
- Payout account submission with admin approval status, rejection reasons, correction and resubmission.
- Clinical notes with manual draft saving, reopening saved drafts, unsaved-change protection, and read-only notes for completed visits.
- A prototype-based dental chart with all 32 permanent teeth, status selection, changed-tooth saves, and read-only current charts for completed visits.
- Prescription drafts with medicine editing, allergy warnings, preview, four-digit OTP signing, and read-only signed prescriptions.
- Treatment plans in the prototype's Plan tab, with procedure editing, permanent-tooth selection, optional cost estimates, patient advice, and a follow-up calendar picker.
- Mobile consultation completion: save changed sections, require a diagnosis and signed medicines, then review read-only records.
- Booking-notification inbox, unread bell on the page headers, cursor pagination, individual read status, and marking the displayed snapshot read.
- An in-app banner for new bookings and an automatic refresh of the visible queue/schedule.
- Private patient photos and PDF reports on appointment details. Photos fit inside a full-screen preview, with the filename and red close button below the phone's notch; reports open in the phone's PDF viewer.
- Full-screen dentist video consultations through the LiveKit backend, microphone/camera controls, camera switching, and in-app call minimization.
- Axios APIs, secure refresh-token storage, session restore, and a shared refresh request for concurrent expired-token responses.
- Redux Toolkit for shared app state and RTK Query for the Axios-backed API cache, with typed dispatch/selector hooks.

Dentist booking alerts currently appear while this app is open. Background phone push is a separate next step: the existing push-device API and delivery worker currently support patients, and the dentist app has not been registered with Firebase yet. The notification inbox remains available after reopening the app.

Today follows the dentist mobile prototype: Dentra header with Wallet and notifications, a time-of-day greeting, white Today/Waiting/Completed totals, a teal next-patient card, and compact chronological queue rows with time blocks and status badges. The card prioritizes an active consultation, then a waiting patient, then the earliest booked visit. It opens details or continues the active consultation; an empty/completed day links to Schedule. The Axios day loader reads all appointment pages and deduplicates repeated IDs before calculating totals. Refresh, booking alerts, foreground return, and date rollover keep the day current. No native rebuild is needed.

Schedule follows the same prototype with a compact header, Today/Tomorrow/date strip and complete per-day booking counts. Rows share Today's time blocks, status badges and symptom flags, ordered chronologically. Cancelled visits are hidden with their count shown below the list. Previous/next week and return-to-today controls preserve access beyond the prototype's first seven days. The Axios week loader reads all pages for each visible date; stale responses for a previous week cannot replace the current selection. Closed states use saved clinic/video working days and all-day time off, with existing appointments kept visible after hours change. Pull-to-refresh, foreground polling and booking alerts refresh the visible week. Sundays are not hard-coded as closed.

## Run locally

Use Node **22.13+** (22.23.2 is available on this computer), and keep the existing API running on port 3000. Keep the API migrations up to date, including the treatment-plan migration described below.

```sh
npm install --legacy-peer-deps
```

Start Metro yourself in a terminal. The dentist run scripts and native debug builds default to port **8082**, separate from the patient app's Metro on **8081**:

```sh
npm start
```

In another terminal, build and install the native app:

```sh
npm run android -- --no-packager
```

For iOS, install pods after dependency changes, then run the app:

```sh
cd ios
bundle exec pod install
cd ..
npm run ios -- --no-packager
```

The native app must be rebuilt after adding modules. A JavaScript reload alone cannot add secure storage, navigation screens, or the document picker to an older installed app.

If iOS reports `"dentraDentist" has not been registered`, check the bundle's Metro port. Loading the patient bundle from 8081 causes this error even though the dentist app is registered correctly. Rebuild the dentist app with the command above after changing its native Metro configuration. For a physical phone, set the computer's LAN address with port 8082 in the dev menu.

`src/common/config/api.ts` is the single API URL setting:

| Device | Default development URL |
| --- | --- |
| Android emulator | `http://10.0.2.2:3000` |
| iOS simulator | `http://localhost:3000` |
| Physical phone | Set your computer's LAN IP; the phone and computer must share a network |

Set the release API URL to your deployed HTTPS endpoint before distributing a release. Release requests are blocked while it is blank. Never put API secrets in mobile configuration.

Real SMS remains deferred. Use the current four-digit `[otp:stub]` code printed by your API terminal for the dentist purpose. The app does not accept a fixed test code.

## Code organization

| Folder | Responsibility |
| --- | --- |
| `src/api` | Short, typed Axios endpoint functions. `client.ts` adds authorization and retries an expired-token request once. `http.ts` handles public auth calls. |
| `src/store` | Redux setup, typed hooks, auth/notification/call-window slices, and the shared RTK Query API. |
| `src/features/auth` | Secure session lifecycle and approval gate. |
| `src/navigation` | Root, stack, and tab navigators, plus shared route types. |
| `src/features/Login` | Mobile number, OTP, resend, and code expiry UI. |
| `src/features/onboarding` | Application details, validation, document selection/upload, and review status. |
| `src/features/today`, `schedule`, `appointments`, `profile` | Feature screens. |
| `src/features/settings` | Profile, clinics, fees/hours, and payout screens, shared layout, and form validation. |
| `src/features/consultation` | Clinical notes, dental chart, prescriptions, patient context, draft lifecycle, and unsaved-change protection. |
| `src/features/notifications` | Booking inbox, unread bell, foreground banner, and queue refresh. |
| `src/features/attachments` | Patient-file list and private photo/report viewing. |
| `src/features/video` | Appointment entry, call lobby, media stage, controls, and call lifecycle. |
| `src/components` | Reusable buttons, fields, cards, feedback, screen layouts, and icons. |
| `src/common` | Configuration, API types, theme, hooks, date/error helpers, and native services. |

Navigation is split by responsibility:

- `RootNavigator.tsx` handles session restoration, login, the dentist approval gate, and the navigation container for approved dentists.
- `StackNavigator.tsx` defines the main screen stack: tabs, appointment details, clinical notes, notifications, and settings editors.
- `TabNavigator.tsx` defines the Today, Schedule, and Profile tabs.
- `types.ts` contains route names and parameters. Feature screens import navigation types from here.

Keep new code readable: use clear names, small focused functions, and separate screen UI, navigation, and API calls. Add stack screens in `StackNavigator.tsx`, tab screens in `TabNavigator.tsx`, and route parameters in `types.ts`. `App.tsx` only wires app-wide providers and the root navigator.

The existing `patients` directory is reserved for later work. Shared state uses [Redux Toolkit and React Redux](https://redux.js.org/tutorials/quick-start). Axios endpoint functions remain under `src/api`; Redux does not replace their authorization/refresh client.

### Redux state

- `store/store.ts` configures the reducers, middleware, in-memory query cache, and session-change cleanup. `StoreProvider.tsx` connects secure-session events to Redux above navigation.
- `store/hooks.ts` exports `useAppDispatch`, `useAppSelector`, and `useAppStore`, with types inferred from the store.
- `authSlice.ts` stores login/restore status and the session version. Refresh tokens stay in secure storage; access tokens stay in the session service. Neither is copied into Redux.
- `dentraApi.ts` defines shared queries for the dentist profile, daily appointments, appointment details, clinical notes, patient dental charts, notifications, patient-file metadata, video availability, clinics, and payout details. Queries call the existing Axios endpoint functions through `queryResult.ts`, which stores only serializable error messages and HTTP status codes. Successful mutations refresh the affected cache entries.
- `notificationsSlice.ts` tracks delivered booking IDs, the current banner, and booking updates. `videoSlice.ts` tracks the open appointment and the expanded/minimized window state.

Use the exported query hooks for server data, and typed Redux hooks for shared UI state. Form input, temporary previews, drag coordinates, native media handles, and LiveKit room credentials remain local to their feature. No Redux state is persisted to disk. Logout/account changes reset the query cache, booking state, and call window; normal token rotation preserves them. Query updates use microtask batching so a paused native animation frame does not hold up call/session listeners.

The store can be created with `createAppStore()` for an isolated test. `test-utils/store.tsx` provides a reusable wrapper that keeps the same store across renderer updates and clears the query cache afterward.

The refresh token is stored in iOS Keychain / Android Keystore-backed storage; the access token stays in memory. Concurrent 401s share one rotation. Offline refresh failures keep the saved session available for retry. Logout clears local credentials and navigation state; late responses from an older login are discarded. Server revocation is attempted when connected.

Documents are selected through the system file picker and sent as multipart data to the existing private onboarding endpoints. Required: degree, council registration, photo ID, and selfie. Selfies must be JPEG/PNG; other documents accept JPEG/PNG/PDF, up to 10 MB each. Missing/unsupported files stop submission. Existing uploads remain available when retrying a saved draft.

Patient attachments are fetched with Axios through the shared authentication/refresh client. MIME type, byte length and the 10 MB limit are checked before saving bytes in the app's private cache. Filenames supplied by patients never become local paths. Photo cache files are removed when closing the preview; downloaded files are removed when leaving the appointment, on logout/session loss, and at the next app startup. A late download from an older login cannot open a viewer or restore cache files. Reports explicitly opened in another app are subject to that app's own save/share behavior.

No broad storage permission is requested on Android. The file viewer uses the app's private cache and a temporary OS content-URI grant. Rebuild and install the dentist app after this update; a JavaScript reload does not add the new file-viewing native module.

Booking notifications poll every 10 seconds while the app is in the foreground, with no overlapping polling request. The first load does not announce past bookings as new. Tapping a notification opens the appointment even if marking the notification read temporarily fails; the inbox shows the read-status error. Mark all as read sends the latest displayed notification ID as a boundary, so a later booking remains unread. An unread badge represents the count across all notification pages.

The appointments API returns 20 items per page, latest times first. Today excludes cancelled appointments; its counters describe the current page when pagination is present. Schedule includes cancelled entries. Profile/access checks refresh every 30 seconds while foregrounded; appointment lists also refresh when focused or returning to the foreground. No polling runs while the app is backgrounded.

## Profile and settings

The Profile layout follows the dentist mobile prototype in `../index.html` (`createDentistApp()`): a compact identity card, stacked white sections, teal actions, and a separate **Offer video consults** switch. Editor screens keep that visual style and use a fixed save button below the scrollable form.

- **Profile → Edit:** qualification, specialization, council registration, languages, and email. The login mobile number is read-only.
- **Locations → Manage:** add, edit, or remove clinics. Existing address, PIN, phone, and opening hours are preserved when editing. Server rules determine whether a clinic can be removed.
- **Fees and hours → Edit:** in-clinic/video fees and video hours. Fees are entered in rupees and sent as integer paise. Clinic and video hours use a time selection sheet with Cancel and Set time.
- **Payout details → Manage:** add bank account holder, account number and confirmation, IFSC, PAN, and optional GSTIN. A pending request shows its status; a rejection shows the admin's reason and allows correction. Approved details stay active while changes await review. Approval records payout details; it does not transfer money.

Payout status refreshes every 15 seconds while focused and foregrounded, except while editing. Pull to refresh is also available. The form retains the request version seen when opened; a stale submission refreshes the current status instead of overwriting another request. Account confirmation stays local to the form and is cleared when it closes. Payout cache entries are removed when unused, and all account data is cleared on logout or account change. API calls remain in `src/api/settings.api.ts`, with Redux cache hooks in `src/store/dentraApi.ts`.

Manual settings check: update a profile field and fee, add/edit a clinic, then submit payout details. Open **Admin Web → Payout review**, approve, and refresh the mobile payout screen. Repeat with a change that admin rejects, check the rejection reason, and correct/resubmit. Check validation, offline retry, and that logout removes the previous account's details. This update adds no native modules, so existing native builds need only a JavaScript reload.

## Clinical notes, dental chart, and prescriptions

Open an appointment from Today or Schedule, then choose **Start consultation** or **Continue consultation** in the Consultation card. Starting uses the existing server endpoint and refreshes appointment lists. Future visits cannot be started from the mobile action; the backend remains authoritative about appointment ownership, state, and dates. Completed visits offer **View consultation** in read-only mode.

The screen follows the consultation prototype in `../index.html`: compact patient identity and status, a video entry when appropriate, Note/Chart/Rx/Plan sections, a white clinical-note card, and the patient-reported concern below it. In **Note**, record chief complaint, examination findings, diagnosis, and treatment done today, then tap **Save draft** in the fixed footer. A diagnosis is optional for a draft. Reopen the same appointment to retrieve the saved note from the API.

In **Chart**, select Healthy, Cavity, Filled, Crown, Root canal treated, Missing, or To be extracted, then tap teeth. The horizontally scrollable chart uses the prototype's FDI order, with the patient's right on the left of the screen. Tap a tooth marked with the selected status again to clear it, or choose Healthy. Changed teeth are outlined and listed as unsaved. **Save chart** writes only changed teeth, with an explicit `healthy` status when clearing an existing finding. The current chart is fetched again before showing save confirmation. Refresh loads other recent findings while retaining local changes.

Note and chart drafts remain in memory when switching sections. Each section saves separately; the other section's unsaved indicator remains visible. A single Back/stack-removal warning covers both sections. The chart is loaded only when opened, using the dentist's authenticated patient endpoint. The backend currently returns the patient's latest chart across visits, not a historical snapshot for each completed visit. The read-only screen identifies it as the current patient chart.

The UI, form helpers, and save/navigation lifecycle are separate files under `src/features/consultation`, with chart-specific files under `dental-chart`. Axios calls live in `src/api/consultations.api.ts` and `src/api/patients.api.ts`; Redux query hooks share the existing authentication, cache, and session cleanup. Note saves send only changed note fields to `PUT /appointments/{id}/consultation`. Chart saves send only changed chart entries to that same endpoint. Neither sends medicines, plan, or follow-up fields, so those records remain untouched, including signed prescriptions. Only patient ID and tooth findings from the patient endpoint enter the chart cache; unused chart cache entries are removed immediately.

Query refreshes preserve unsaved input. Failed saves retain edits for retry; repeated taps share the in-flight action. Back/stack removal warns before discarding unsaved changes and waits for an ongoing save. Drafts are saved explicitly to the backend, not automatically or to device storage. If a visit is closed on another device, the next status check or rejected save makes the screen read-only while retaining any unsaved text. Logout clears the query cache; unused consultation responses are removed immediately.

For video visits, minimize the existing call with Back and enter notes, or return to the same call from the notes screen. The call provider remains above navigation, so opening notes does not replace the room connection.

In **Rx**, add medicines with generic name, optional strength/form, dose, frequency, duration, and optional instructions. Edit/remove rows and tap **Save prescription** to save the full medicine list. Removing the last medicine saves an empty list. Required fields are checked before adding a row or saving; incomplete medicine edits remain local across section switches and participate in the unsaved-change warning. Prescription saves never send clinical-note, chart, plan, or follow-up fields.

**Preview and sign** saves any changed clinical note first, then the medicine list, and opens a native modal preview. Review the patient, dentist registration, and medicines, type the dentist's full name, request a signing code, and enter its four digits. Real SMS remains deferred: use the API terminal's current `[otp:stub]` entry with the `(prescription)` purpose. The server generates and verifies the code; there is no fixed-code bypass. The UI applies the server's resend cooldown and expiry and clears entered codes when the medicine list changes or the visit closes.

Recorded allergies are fetched through the existing authenticated patient endpoint; a failed lookup blocks signing. Matching warnings use the same interim rule table as the backend, which remains authoritative and checks again during signing. A flagged conflict requires the dentist's explicit acknowledgement. There are no automatic medicine/dose suggestions. The saved prescription is rechecked before and after requesting a code, and before signing, so a changed medicine list requires a fresh review and challenge. The backend binds the OTP to the exact prescription content and performs verification/signing atomically. If a response is lost after signing, the app reads the saved status before allowing another attempt.

Signed prescriptions are immutable in mobile. Reopening the Rx tab offers **View signed prescription** with signing details. Patient consultation/PDF access follows the existing backend rule: the visit must be completed, and the prescription PDF requires a signed, non-empty prescription. Complete the visit from mobile or web, then check the patient app's visit records and prescription download. Signing does not complete a visit.

Prescription UI, medicine validation, draft lifecycle, and signing lifecycle are separate files in `src/features/consultation/prescription`. Short Axios functions live in `src/api/prescriptions.api.ts`; Redux manages the shared server cache. Navigation parameters contain only the appointment ID. Typed names, codes, and allergy acknowledgements stay in the preview screen; signing mutations are reset after completion. The allergy cache contains only patient ID and recorded allergies, is removed when unused, and is cleared with other account data on logout.

Manual check: start an eligible clinic appointment, enter notes, switch to Chart, mark a tooth, save the chart, return to Note, and save the note. Leave and reopen, then verify both in the web portal. Clear an existing finding with Healthy and confirm that it stays cleared after reopening. Test Back with unsaved work in either section, failed-save retry, and notes alongside a signed prescription. Complete the visit in the web portal and confirm mobile notes/chart become read-only. For video, minimize/restore the existing call while editing. No backend migration or native-module change is required.

Prescription manual check: add/edit/remove medicines, save, reopen, and verify the same list in the web portal. Open the preview, request the current prescription-purpose code, and sign. Check wrong/expired codes, resend cooldown, an allergy conflict and acknowledgement, and network retry. Verify that the signed medicine list has no edit controls, complete the visit, and confirm the patient can view/download that prescription. Automated checks use synthetic data and a disposable backend schema; native app interaction still needs a manual pass.

## Treatment plans

Open a consultation and select **Plan** beside Note, Chart, and Rx. Add up to 20 procedures, select their permanent teeth (or leave empty for general treatment), and optionally enter the total estimate for each procedure in rupees. Estimates are stored as integer paise; an empty estimate stays unknown and a zero estimate stays zero. Use the pencil to edit or the red trash icon to remove a procedure. Add patient-facing advice and tap **Save treatment plan**. Finish or cancel a procedure editor before saving the whole plan.

In the same advice card, tap **Follow-up date** to open the calendar, navigate months, select today or a future date, and confirm with **Select date**. Cancel or phone Back keeps the original date. **Clear follow-up date** removes it when saved. Dates stay as `YYYY-MM-DD` calendar strings without a timezone conversion. Existing past dates remain visible in historical records.

Only changed plan fields are sent through Axios and Redux. Other notes, prescriptions and dental findings stay untouched. An omitted follow-up date preserves the saved value; explicit `null` clears it. Unfinished editors survive tab switches and background query refreshes, failed saves can be retried, and Back protects unsaved work. Completed visits are read-only. The treating dentist can see the saved procedures in the web portal; patients see them in their completed visit, share text and visit-summary PDF. Existing document snapshots remain immutable.

The API migration `1792828800000_consultation_treatment_plan.sql` adds the plan-items column and has been applied locally. The follow-up/calendar and completion changes need no additional migration, native dependency, or mobile rebuild. Manual check: add/edit/remove procedures, mix priced and unpriced estimates, select teeth, select/change/clear a follow-up date, save and reopen, verify in web, then complete the visit and check the patient's summary/PDF.

### Complete a consultation

Use **Complete consultation** in the fixed footer. Finish or cancel open medicine/procedure editors, enter a diagnosis, and sign any non-empty prescription first. After confirmation, the app saves changed note, chart, prescription, and plan sections sequentially, then calls `POST /appointments/{id}/consultation/complete`. A failed save stops completion, identifies the section, and retains pending edits. Earlier successful saves remain saved. A lost completion response is reconciled with the server status before offering a retry.

After success, the screen displays **Consultation completed**, removes editing/completion actions and keeps the saved sections available for review. Any video call belonging to that visit closes. The existing backend transaction creates the immutable visit summary and patient notification; it checks ownership, status, diagnosis and prescription signature again. The patient chart tab is still the current chart across visits, as labelled.

Manual check: cancel the confirmation, try an empty diagnosis and an unsigned prescription, complete with and without medicines, interrupt a draft save and retry, then reopen the completed record. Check that Today/Schedule refresh, the patient can access the summary, and no clinical fields can be edited after completion.

### Patient records

Open **Patients** in the bottom tabs. The layout follows the patient list and record screens in `../index.html`: a compact header and pill search above avatar rows, then identity, medical history, contact, current teeth and appointment rows. The record header uses the patient's name, and their mobile number opens the phone app. Search matches names without case sensitivity and phone numbers with or without spaces, parentheses, dashes or a country prefix. Filtering happens locally over the existing dentist roster endpoint. The list contains everyone who has booked with this dentist; last-visit dates and visit counts include only their completed visits with this dentist.

Select a patient to read their profile, any saved guardian details, allergies, conditions, medicines and emergency contact. Missing medical information is labelled **Not recorded**. The dental chart is read-only and shows the current patient chart across visits. **Appointments with you** contains only the signed-in dentist's appointments, newest first. Completed visits open the saved consultation's Note/Rx/Plan sections; other statuses open appointment details. Use **View appointment and shared files** from a completed consultation to access its protected photos and PDF reports.

Both the patient record and consultation chart use tooth-shaped SVG icons with the existing status colours and FDI numbering. Missing teeth have dashed, unfilled outlines; unsaved changes retain their highlight. Tooth touch targets remain 44 points wide, and charts scroll horizontally. No native rebuild is needed.

**View patient profile** is also available on appointment details and inside consultations. Opening it keeps the consultation mounted, so local drafts and a minimized call remain available when returning. Profile routes carry only the patient ID. Axios calls are in `src/api/patients.api.ts`; the roster and record use RTK Query with no unused cache retention and the existing session reset. Pull to refresh, foreground updates and booking/completion updates keep the screens current. Errors hide stale record data and provide retry.

The backend keeps the existing appointment-relationship and verified-dentist checks. It now returns calendar dates as `YYYY-MM-DD`, appointment times/type/clinic and saved guardian details. These additions need no database migration or native rebuild. Manual check: search by name and formatted phone, clear the search, open a patient, review medical history/teeth, open a past visit and its files, and return to an unsaved consultation. Complete a visit and verify the roster/history refresh; also check empty results and failed-request retry.

### Manage appointments

The appointment screen follows the prototype's compact patient identity, date/status and visit/payment card, concern tags, reported symptom rows, medical history and past visits. Shared files use compact tappable rows; photos and PDF reports retain their protected download/viewer flow. Medical history and completed visits come from the signed-in dentist's existing patient endpoint. Missing history is labelled as unrecorded, and a failed refresh hides cached history until retry succeeds.

The fixed bottom action starts or continues a consultation, shows the date/time for a future visit, or opens a completed visit summary. Cancelled appointments have no consultation action. The patient profile, video entry, and appointment management controls remain available in the scrollable content. **Mark patient as arrived** is available only for a booked clinic visit scheduled for today; it changes the status to **Waiting**. **Reschedule appointment** is available while booked. **Cancel appointment** is available before the consultation starts and requires confirmation. Completed, cancelled and active consultation records do not expose these management actions. Requests disable the other appointment controls and protect Back until the request finishes.

The Reschedule stack screen keeps the patient, visit type and clinic in view. Choose Today/Tomorrow/a nearby day or use the calendar, then select a time returned by the existing availability API. Changing the date clears the old selection; unavailable/past times are omitted by the backend. Empty results and request failures have explicit messages and retry. **Confirm new time** preserves the original clinic, visit type and payment. After success, **Back to appointment** returns to the updated details.

Reschedule requests include the original `expectedDate` and `expectedTime`. The API checks them under the appointment lock so a stale mobile screen cannot overwrite a newer schedule; sending the same target again is a safe retry. Older clients can omit both fields. A changed appointment requires **Review updated time** before another selection. Conflicts refresh availability, and lost responses are reconciled against the current appointment before offering retry. Cancellation also re-reads the details before submitting; the existing backend queues captured-payment refunds and creates the patient notification. The UI does not mark a refund complete itself.

Axios methods are in `src/api/appointments.api.ts`, query/mutation hooks in `src/store/dentraApi.ts`, and screen/action logic under `src/features/appointments`. Successful actions refresh appointment details, old/new schedule pages, patient history and video eligibility. These changes require no database migration or native rebuild. Manual check: arrive a clinic patient today; reschedule both clinic and video visits; change dates after selecting a time; cancel the confirmation without submitting; then confirm a cancellation and check the patient status/refund state. Test a slot taken on another device, a changed schedule and a lost-response retry using test appointments.

## Video consultations

Video uses the shared `@dentra/video` package with the official LiveKit React Native/WebRTC SDKs. Keep the workspace layout, install dependencies, resolve iOS pods and rebuild the native app. JavaScript reload cannot install the media SDK. The dentist app uses Metro port 8082, separate from the patient app on 8081.

Configure the API's LiveKit URL, key, secret and signed webhook using [LIVEKIT_SETUP.md](../LIVEKIT_SETUP.md), then apply the restore-LiveKit migration. Secrets stay on the backend. Screen sharing and private chat/files are documented in [CALL_COLLABORATION.md](../CALL_COLLABORATION.md).

Open a video appointment and choose **Open video consultation**, then **Start and join video call**. Existing appointment, payment, session and joining-window checks still apply. The full-screen call retains mute, camera, switch-camera, auto-hidden controls, Back minimization, a draggable in-app window and restore/leave controls. The connection stays above navigation. Android uses the existing call foreground service/PiP activity; iOS uses the LiveKit/WebRTC video-call PiP renderer. Completing the consultation closes its call and leaves clinical records read-only. Leaving video alone keeps the appointment open.

Automated media tests use synthetic SDK/native events. Installed rebuilt apps and a real LiveKit-backed two-device check remain required; follow the [video verification guide](../VIDEO_CONSULTATIONS.md). Use physical phones to verify two-way camera and background behavior.

## Checks

```sh
npm run typecheck
npm run lint
npm test -- --runInBand --watchman=false
```

Tests cover request sharing, account-cache cleanup, late responses after logout, token rotation preserving an active call, serializable API errors, settings navigation and saves, exact fee conversion, payout approval/rejection states, stale forms, duplicate taps, retry after a lost response, clinical draft recovery, unsaved-change protection, and preserving signed prescriptions when saving notes, alongside the existing app/video/PiP checks. Android/iOS JavaScript bundle checks verify dependency resolution. Tests use synthetic API responses and mocked native UI; device interaction still needs a manual pass:

1. Sign in as an existing approved dentist and compare today's appointments with the web portal.
2. Choose Tomorrow and another date, paginate if needed, pull to refresh, and open appointment details. Check that Android Back returns to the list.
3. Sign in with a new dentist number. Fill the form, select the four required files, and submit. Confirm the admin receives the onboarding request.
4. Approve in admin and tap **Check application status**; the tabs should open. Repeat rejection with another application and verify the reason appears.
5. With an approved dentist signed in, book from the patient app. Within the next foreground notification check, verify the unread bell, booking banner, and refreshed queue. Open the inbox, tap the booking, and confirm it opens the correct appointment. Check older/newer pages and mark all as read.
6. Book with patient photos and a PDF. Open the appointment in the dentist app, view a full photo, close it with the red X or Android Back, and open the PDF in a native viewer. Check missing/deleted-file errors and logout during a slow download.
7. Close/reopen the app to check session restore. Disconnect/reconnect the network and verify retry does not require a new OTP. Log out and confirm no prior appointment data appears.


## Working days and time off

Dentists can set separate video and per-clinic working days, and block full-day leave or repeating daily breaks across a date range. Time off previews affected appointments and requires those appointments to be moved or cancelled before saving. Patient booking and rescheduling enforce these settings on the backend. Existing bookings keep their time when working days change.

See [AVAILABILITY.md](../AVAILABILITY.md) for screens, API rules, migration, and verification.


## Record clinic payments

In **Appointment → Payment**, choose Cash, UPI or Card and confirm **Mark as paid** after receiving the full booked consultation fee. Cancelled, video and online-payment bookings do not offer collection; completed clinic visits can still be collected. The screen shows the saved receipt method and time. Duplicate taps and lost-response retries reuse the receipt request ID, and a collection on another device refreshes the visible receipt.

Patients and Admin Payments see the shared paid status and receipt. Any refund of a clinic-collected payment is handled directly by the clinic. See [PAYMENTS.md](../PAYMENTS.md) for API rules, migration and tests. No native rebuild is needed.

## Payments dashboard

Open **Profile → Payments → View** for online paid amounts, clinic collections, outstanding fees and refund states. Expand **Show filters** to search by patient/reference and select source, status or transaction dates. Apply updates both totals and the 20-row history; totals include every matching transaction, independently of the current page. Tap a payment for its fresh receipt, gateway references and appointment link.

Axios requests live in `src/api/payments.api.ts`, RTK Query hooks in `src/store/dentraApi.ts`, and readable screen/filter/summary components in `src/features/payments`. Foreground refresh and appointment invalidation keep the report current. Private report caches are removed when screens lose their subscribers, and session reset clears them. No migration or native rebuild is needed. See [PAYMENTS.md](../PAYMENTS.md) for reporting semantics and manual checks.

## Payout history

Open **Profile → Wallet → Open → Earlier payout batches** for batches created before Wallet, status filters, pagination and reserved/recorded-paid totals. **View payout** shows the saved fee/net amount, account ending, included collections, external transfer reference and activity. Open an included appointment directly. Paid means an admin recorded the transfer; actual credit is confirmed through your bank.

Simple Axios methods are in `src/api/payout-batches.api.ts`; RTK Query handles refresh and account-cache cleanup. Navigation remains in the navigation folder. API migration `1792843200000_payout_batches.sql` is required (applied locally); no native rebuild is needed. See [PAYMENTS.md](../PAYMENTS.md) for full rules.

## Wallet

Open **Profile → Wallet → Open** (or **Payments → Wallet**) to see available online earnings, reserved amounts, total withdrawn, pending earnings and withdrawal history. **Request withdrawal** accepts an amount, shows its review and saved account ending, then submits it for admin approval. View a request for its status, decline reason and transfer reference. **Earlier payout batches** retains old history.

The **Today** header also opens Wallet directly. The notification bell and inbox include withdrawal approvals, declines, processing, Paid, failed and cancelled transfers alongside bookings. Each update opens its request; decline/failure/cancellation reasons appear in the inbox. New events refresh active Wallet queries and offer one banner while the app is open. Read status survives sign-in; logout clears notification state. Background dentist push is still separate, and this update needs no native rebuild.

Axios methods are in `src/api/wallet.api.ts`; RTK Query owns request/balance refresh and cache cleanup. Screens live in `src/features/wallet`, and stack routes remain in `src/navigation`. Uncertain submissions reuse the exact request ID and amount. Wallet setup and approved-bank checks, minimum limits, review and retries have synthetic tests. The API migration is applied locally; no native rebuild is needed. Pay-at-clinic fees remain deferred. See [PAYMENTS.md](../PAYMENTS.md).
