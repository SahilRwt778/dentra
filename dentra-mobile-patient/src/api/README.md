# Mobile API

Screens import the feature they need. Query hooks return `data`, `isLoading`, `error` and `refetch`. Mutation hooks return an async action and its loading state; await the action directly and handle errors with `errorMessage`.

```tsx
import { useAppointmentQuery, useRescheduleAppointmentMutation } from '@/api/appointments';
import { errorMessage } from '@/api/errors';

const { data: appointment, isLoading, error } = useAppointmentQuery(appointmentId);
const [reschedule, { isLoading: saving }] = useRescheduleAppointmentMutation();

async function saveTime() {
  try {
    await reschedule(appointmentId, selectedDate, selectedTime);
    navigation.goBack();
  } catch (error) {
    setMessage(errorMessage(error));
  }
}
```

| File | Responsibility |
| --- | --- |
| `auth.ts` | Request and verify patient OTPs |
| `patients.ts` | Patient profile, registration, dental chart and privacy requests |
| `dentists.ts` | Dentist search, details and available slots |
| `appointments.ts` | Appointment pages, details, booking, cancellation, rescheduling and visit summaries |
| `notifications.ts` | Notification pages and read actions |
| `video.ts` | Video availability and joining credentials |
| `files.ts` | Private uploads, file lists and authenticated downloads |
| `care-documents.ts` | Protected prescription and completed visit-summary PDF downloads |
| `private-download.ts` | Shared binary download, login-session check and private-cache handling |
| `types.ts` | App-facing request and response models |
| `errors.ts` | Display server messages, including validation lists, with a fallback |
| `cache.ts` | Cache invalidation for background notification updates |
| `base-api.ts` | Base URL, timeout, authorization and one retry after session refresh |

Feature modules adapt the generated request arguments and unwrap mutation results. HTTP routes, contract types and cache tags remain generated from `dentra-api/openapi.yaml`, so they have one source of truth. `openapi-config.js` selects the endpoints used by the patient app. Run `npm run gen:api` after changing that contract; `generated/patient-api.ts` is generated code and should not be edited by hand.

Binary adapters use the same client: `files.ts` handles native URI/FormData uploads; `private-download.ts` handles protected attachment/document bytes and the app's private cache. These use shared token refresh and reject results after a login-session change. Screens use `useUploadPatientFile`, `useDownloadPatientFile`, `usePatientFilesQuery`, `useAppointmentFilesQuery` and `useDownloadCareDocument`; they do not handle tokens or multipart encoding. `lib/attachment-picker.ts` handles native picker permissions and cancellation, while `lib/private-files.ts` handles cache cleanup and the phone's document viewer.

Use a feature hook directly for a simple request. Multi-step flows live in focused hooks:

- `hooks/use-book-appointment.ts` keeps one idempotency key per booking attempt, prevents double submission and coordinates checkout. A client payment result never marks the booking as paid.
- `hooks/use-booking-attachments.ts` uploads selections with stable retry keys, retains partial successes and blocks confirmation until every selected file is ready or removed.
- `hooks/use-notifications.ts` merges older pages and manages read actions.
- `hooks/use-appointments.ts` loads the complete appointment history.
- `hooks/use-visit-summaries.ts` loads summaries for completed visits.
- `video/use-video-consultation.ts` manages availability, permissions, session ownership and media cleanup. `VideoScreen.tsx` renders its state.

Session refresh and encrypted pending logouts stay in `auth/`. Push requests stay bound to the login session that created them in `notifications/push-session.ts`; they must not silently switch to a different account when retrying. Normal screens use the feature hooks above.
