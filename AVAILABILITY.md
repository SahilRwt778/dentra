# Dentist availability

Dentists manage working days and time off from both dentist clients, using the same API.

## Where to edit

- Dentist mobile: **Profile → Fees and hours** sets video days and hours. **Profile → Locations → Edit** sets each clinic's days and hours. **Profile → Time off → Manage** blocks leave and breaks.
- Dentist web: **Settings → Fees & availability**, **Clinics**, and **Time off** provide the same controls.

Weekdays use `0` for Sunday through `6` for Saturday. Video availability belongs to the dentist; clinic availability belongs to the selected location. Selecting no working days pauses new bookings for that consultation type/location.

The migration defaults every existing dentist and clinic to all seven days, preserving the previous every-day behavior. Changing working days/hours leaves existing appointments in place.

## Time off

Time off applies across every clinic and video consultation. A period can cover one day or an inclusive date range of up to 366 days. Partial-day hours repeat on each selected date and use IST, like consultation hours. All-day leave closes each selected day completely.

1. Choose dates, optionally turn off **All day** and select hours.
2. **Check affected appointments** previews overlapping booked, waiting, and in-consultation appointments. The response contains a total and the first 20 matches.
3. Open affected appointments and move or cancel them. Check again to see any remaining matches.
4. When no active appointments overlap, **Confirm time off** saves it. Removing time off reopens otherwise available slots; other leave periods, closed weekdays, and existing bookings still apply.

The private reason never enters the public dentist response. Existing appointment/payment/refund records are not changed by time-off operations.

## API and consistency

- `PATCH /dentists/me`: optional `videoWorkingDays`; omission preserves saved days.
- `POST/PATCH /dentists/me/clinics[/<clinicId>]`: optional `workingDays`; omitted edits preserve saved days, new clinics default to every day.
- `GET /dentists/me/time-off`: current/upcoming periods owned by the verified dentist.
- `POST /dentists/me/time-off/preview`: date/time input, no data mutation.
- `POST /dentists/me/time-off`: the same input plus a UUID `requestId`, reused for retries.
- `DELETE /dentists/me/time-off/<id>`: remove an owned period.

Slot lookup, booking, and rescheduling share the same weekday and time-off filter. A slot is excluded if any part overlaps leave. Booking, rescheduling, and time-off creation serialize through the dentist row lock, so a new booking between preview and confirmation causes a conflict instead of being hidden under leave. Creation rechecks appointments inside the transaction. Normal booking uniqueness still prevents two appointments at the same time across locations.

Migration: `dentra-api/migrations/1792832400000_dentist_availability.sql`. Apply with `npm run migrate -- up` when updating another database. No native dependency or native rebuild is required.

## Verification

`dentra-api/test/e2e/availability.e2e-spec.ts` covers default days, separate clinic/video schedules, closed-day booking and rescheduling, overlapping partial/full-day leave, private reasons, retries, ownership/verification, stale previews, and simultaneous booking/time-off creation. The e2e runner creates and removes a disposable schema.

`dentraDentist/__tests__/availability.test.tsx` uses the real Axios/Redux path with synthetic responses to verify review-before-save, date changes, affected-appointment navigation, partial days, conflicts, retries, duplicate-tap protection, removal confirmation, and slot cache refresh. `mobile-settings.test.tsx` checks weekday saves and preservation during unrelated edits.
