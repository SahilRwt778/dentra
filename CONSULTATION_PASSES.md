# Three-day consultation passes and messages

## Product rules

- A paid consultation starts one **fixed 72-hour window at the original visit's completion time**. A booking or successful checkout alone does not start the clock. For a clinic visit paid after completion, the same completion timestamp is used.
- During that window, the patient can message the treating dentist and reserve free follow-up consultations for the **same concern and dentist**, in video or clinic mode. Each follow-up needs an available appointment slot. There is currently no count limit.
- The scheduled start must be before the exact expiry timestamp. Completing a follow-up, sending a message, rescheduling, or retrying a request never extends the window.
- A reserved video follow-up has its own room and normal call timing: 10 minutes before to two hours after its scheduled start. A valid reservation can finish after the pass deadline. Clinic follow-ups must start before the pass expires; a consultation already in progress can be completed afterward. There is no continuously open three-day video room.
- After expiry, new messages and follow-up bookings are blocked. Existing messages and private attachments remain readable. A new concern or further consultation requires a new paid booking.
- Refunding the original fee, cancelling the original visit, or making either participant unavailable revokes further pass access. Existing follow-up reservations are retained for history, with coverage unavailable; they cannot start a new consultation or video call. They can still be cancelled.
- Coverage applies to the consultation fee. Additional clinic procedures are outside this pass and are not charged through the follow-up booking.

## Patient and dentist experience

- Patient Mobile: completed Appointment and Visit Summary show the pass deadline, **Message dentist**, and **Book free follow-up**. The latter selects video/clinic and a slot with the original dentist. It goes straight to the appointment without checkout.
- Patient Mobile and Dentist Mobile have a **Messages** tab with conversation unread counts. Dentist Web has a **Messages** page and sidebar count. Notification taps open the relevant conversation.
- One conversation belongs to the original paid visit, rather than one thread for every follow-up or a single thread for all future concerns with that dentist. Follow-up call chats resolve to the original conversation.
- Both participants can send text, JPEG/PNG photos, and PDF reports using the existing attachment menu and private viewer. Chat does not require joining a video call after the pass activates. Closed conversations disable the composer and preserve history.
- Before the original visit completes, its existing call chat keeps the joined-room/session requirements. Completion switches the conversation to pass access.
- Message delivery uses durable HTTP storage and short polling. Read receipts advance only while the conversation is visible in the foreground. In-app notifications coalesce per unread conversation; patient phone alerts use the existing Firebase delivery worker. Dentist phone push remains deferred.

## Data and API

`consultation_cases` stores the original visit, participants, activation, and expiry. `appointments.consultation_case_id` and `follow_up_of` link follow-ups to it. `consultation_chat_reads` stores each participant's read cursor.

Existing `video_chat_messages` and private storage objects remain in place, under the original appointment ID. There is no message-history rewrite. Free follow-ups create **no transaction, gateway order, refund, or additional wallet earning**. Their appointment payment view is synthetic: zero amount, `method: follow_up`, and `status: covered` or `coverage_revoked`.

Routes:

- `GET /consultation-cases?page=1` — owned conversations, 20 per page, unread totals.
- `GET /consultation-cases/:caseId` — current pass state, server time, and permissions.
- `POST /consultation-cases/:caseId/follow-ups` — patient-only booking with a retry key; dentist and concern come from the original record.
- Existing `/appointments/:id/video/chat` list/send/download routes accept either the original or a follow-up appointment ID and resolve the same history.
- `POST /appointments/:id/video/chat/read` — advances a bounded, monotonic sequence cursor and reads corresponding message notifications.

Ownership, active sessions, slot availability, expiry, and source funding are checked on the server. Retried accepted bookings/messages return the original result. Booking retries are serialized before appointment/dentist locks. File sends recheck expiry after storage upload. Conversation files remain private and require participant authentication.

## Rollout

1. Apply migrations against the intended database from a trusted checkout:

   ```bash
   cd dentra-api
   npm run migrate -- up
   ```

   The new migration is `1794843000000_consultation_cases.sql`. It preserves existing data, links existing appointments to cases, and backfills validity from paid completed visits' actual completion times. It does not grant old visits a fresh three days. The earlier profile-photo migration is also included in this checkout; check the target migration history.

2. Deploy the API, then rebuild/deploy Dentist Web and Admin Web. Reload updated JavaScript in both mobile apps. This feature adds no native dependency and needs no native rebuild by itself.
3. Test with a disposable paid visit: complete it as the dentist, send messages from both inboxes, reserve a free follow-up, and confirm no new entry appears in Payments or wallet earnings.

This work has not run migrations or deployed changes against the hosted environment. Do not re-import `schema.sql` into an existing database. Clinical history is intentionally protected from destructive down migrations; roll back application code or use a reviewed forward migration.
