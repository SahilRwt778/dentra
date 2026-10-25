# Payment confirmation and refunds

Razorpay is the payment provider. The API creates the order; checkout's client result never marks a booking paid. A signed `payment.captured` webhook or an authenticated provider status read must confirm the exact INR amount.

## Payments received at the clinic

For a **pay-at-clinic** appointment, Dentist Mobile → **Appointment → Payment** and Dentist Web → **Appointment → Payment → Mark as paid** record the full booked consultation fee already received by cash, UPI, or card. Choose the method and confirm receipt. The fee comes from the original booking; changing the dentist's current fee does not change it. Partial collections and discounts are not supported by this action.

Only the verified treating dentist can record collection. Booked, waiting, in-consultation and completed clinic visits are eligible; cancelled visits and online payments are not. This action records receipt of money and never initiates a charge, gateway order or transfer.

`POST /appointments/{appointmentId}/clinic-payment` accepts `{requestId, amountPaise, method}`. `requestId` is a UUID reused on retries; `method` is `cash`, `upi`, or `card`. The server verifies the exact original amount, locks the appointment and transaction in the same order as cancellation, inserts one receipt, changes the transaction from `due_at_clinic` to `paid`, and adds a `clinic_payment_recorded` audit entry atomically. Identical retries return the same receipt; another collection or changed request details return a conflict. A failed audit write rolls back the receipt and status together.

Appointment responses include `payment.collection` with receipt ID, method, amount and server-recorded collection time. Patient Mobile shows these details; Admin Payments shows the method/time and includes the amount in Paid totals. The underlying booking method remains `pay_at_clinic`, so the admin **Pay at clinic** filter includes both outstanding and collected clinic payments. Transaction-date filters continue to use the booking transaction's creation date; collection time is displayed separately.

Cancelling a clinic-paid appointment preserves its paid receipt. Any refund is arranged directly with the clinic; no Razorpay refund is queued. Patient and dentist cancellation copy explains this. Payments with an actual gateway payment reference continue through the existing online refund process, including legacy records.

Migration `1792836000000_clinic_payment_collections.sql` adds receipt storage without changing existing appointments or transactions. Run `npm run migrate -- up` when updating another database. No native dependency or rebuild is required.

Manual check using a test appointment:

1. Book an in-clinic appointment with **Pay at clinic**.
2. Open it in either dentist client, choose a received payment method, and confirm **Mark as paid**.
3. Refresh Patient Mobile and Admin Payments: verify Paid, the booked amount, receipt method and collection time.
4. Reopen the dentist appointment: collection is no longer offered. The admin audit log contains one collection event.
5. On another test booking, dismiss the confirmation: it must remain due. For a cancelled clinic-paid test booking, verify the receipt remains paid and the clinic-refund explanation appears.

Automated coverage: API `test/e2e/clinic-payments.e2e-spec.ts`, dentist mobile `__tests__/clinic-payment.test.tsx`, dentist web `__tests__/clinic-payment.test.tsx`, and the patient appointment-payment tests. These use synthetic data; no existing payment is marked received for UI verification.

## Dentist payment reports

Dentist Web → **Payments** and Dentist Mobile → **Profile → Payments → View** show online paid amounts, clinic collections, due-at-clinic fees, awaiting online payments, processing/failed refunds and completed refunds. These are current transaction states before fees or payouts; they are not settlement or bank balances. Failed online attempts count as awaiting payment, and refunded amounts are separate from paid amounts.

`GET /dentists/me/payments` accepts `q`, `source=online|clinic`, payment `status`, `from`, `to`, `page` (default 1) and `limit` (default 20, maximum 100). Dates are inclusive `YYYY-MM-DD` calendar dates in IST and filter the booking transaction's creation time, matching Admin Payments. Collection time is shown separately. Search treats `%`, `_` and backslashes literally across patient names and transaction/appointment/receipt/provider references. Results sort by creation time then ID, newest first. Totals cover all matching transactions in the same database snapshot as the requested page.

`GET /dentists/me/payments/{transactionId}` returns the current payment, collection receipt and provider references for its appointment. Both endpoints require a verified treating dentist, use the authenticated owner, send `Cache-Control: no-store`, and return no bank details or clinical notes. Unrelated and missing payment IDs both return 404. No migration is introduced for reporting; clinic receipt storage still requires the migration documented above.

Both clients refresh on return/foreground and after appointment/payment changes, and hide old results while changed filters load. Failed requests offer retry; denied reads hide stale details. Reports and receipts have no unused cache retention, and logout clears account data. Mobile uses 20 rows; web offers 20, 50 and 100.

Manual checks with existing test records:

1. Compare the two dashboards, search a known transaction, and apply source/status/date filters. Clear them and check page navigation and web row limits.
2. Open online and clinic payment details, verify method/time/references, and follow **Open appointment**. Closing details preserves the list filters.
3. Record a clinic collection through its appointment using a disposable test booking. Verify both dashboards move that amount from due to collected.
4. Test a refunded online booking and confirm its amount is separate from paid totals. Disconnect/reconnect to check retry; log out and sign in as another dentist to check scope and cache cleanup.

Automated coverage: API `test/e2e/dentist-payments.e2e-spec.ts`, dentist mobile and web `__tests__/payments-dashboard.test.tsx`. Tests use synthetic responses or a disposable database schema.

## Dentist Wallet and withdrawal requests

Dentist Web → **Wallet** and Dentist Mobile → **Profile → Wallet → Open** show available online earnings, reserved withdrawals, total withdrawn, pending earnings and withdrawal history. Pay-at-clinic collections and their platform dues are outside this wallet. An in-clinic appointment paid online through Dentra is still an online collection.

Admin Web → **Settings → Wallet and withdrawals** contains one global platform fee and minimum withdrawal. Both start unset; this update does not choose their values. Requests remain disabled until admin configures both. Fees support two decimal places (basis points); amounts use integer paise. A new online booking saves the fee rate in its transaction. Each booking's fee rounds half-up to the nearest paise. Changing settings never reprices an assigned booking. Older online bookings with no assigned fee remain unpriced and unavailable until admin explicitly selects **Apply this fee to earlier online bookings**. Direct pay-at-clinic bookings are not included in that assignment.

Available funds come from positive captured online collections on completed appointments, after their saved platform fee, excluding refunds, duplicate capture references and money reserved in earlier payout batches. Pending earnings are captured online payments for visits that are not completed yet. New withdrawal reservations and paid withdrawals reduce available funds. A full/partial withdrawal amount does not need to match any appointment amount. No additional fee is charged when withdrawing.

The flow is:

1. Dentist enters an amount between the current minimum and available balance, reviews the approved account ending and confirms the request. The backend saves that account snapshot and reserves the amount atomically.
2. Active admins receive an in-app notification linking to **Withdrawals**. The queue supports search, status filters, pagination and 20/50/100 rows per page.
3. Admin opens the request and approves or declines it. Declining requires a reason and releases its reservation. Approval keeps it reserved; it sends no money and does not mean Paid. A higher minimum configured later does not invalidate an already accepted request.
4. Admin starts processing after rechecking the wallet and approved account. The full requested amount is transferred outside Dentra to the saved account. **Record transfer as paid** requires confirmation, a unique bank reference and an IST transfer date between the request date and today. The bank remains the authority for actual credit.
5. A bank-confirmed failed transfer keeps its reservation. Admin can retry processing or cancel with a reason after confirming no money moved. A processing request cannot be declined or cancelled directly. Paid, declined and cancelled records are final.

Dentists receive an in-app `wallet_withdrawal_updated` notification for each committed admin decision: approval, decline, processing, Paid, failure or cancellation. Mobile and web show the amount, state and decline/failure/cancellation reason, and open the withdrawal details. New events refresh active Wallet balance, request-history and request-detail queries, even if another device already marked the notification read. Repeated inbox polls do not trigger repeat banners or refreshes. Notifications share the decision transaction and retries, so failed decisions leave no notification and identical action retries do not duplicate alerts. Payloads omit bank account numbers and transfer references. These updates use the existing foreground inbox; background dentist phone push remains separate.

Every request/action has a UUID retry key; identical retries return the existing result. Actions also use the last-read version. All wallet reservations for one dentist serialize on the dentist row, including earlier manual batch operations. Changed payout accounts block approval/processing; the request must be declined/cancelled and submitted again. Decline/cancel/failure reasons, state changes and audit entries commit together. Bank details stay out of the general audit feed and dentist/list responses show only the account ending. Only admin detail includes the full transfer account. Private queries have no unused cache retention and logout clears account caches.

Refunds and closed visits remove the affected earnings from availability. If committed/paid withdrawals exceed eligible earnings, Wallet shows an earnings adjustment and available balance stays zero. Admin cannot approve/start further transfers while there is a shortfall. A transfer that actually happened can still be recorded after explicitly acknowledging a later adjustment; its financial history is preserved. New eligible earnings offset that shortfall. This also accounts for affected paid legacy batches, using their saved net amounts. It does not collect pay-at-clinic dues or initiate a bank debit.

The earlier manual batch ledger remains accessible via **Earlier payout batches**, preserving saved fees, accounts, receipts and activity. Its existing reserved/paid amounts cannot be withdrawn again. The old Create batch page redirects to withdrawal requests. Once wallet policy is configured, the old batch-creation API rejects new batches; existing batch progress and identical retries still work. Bank references are unique across both ledgers.

API routes:

- `GET /dentists/me/wallet`: private balance, policy and masked approved account.
- `GET/POST /dentists/me/withdrawals`: own history and new amount-based request. Creation accepts `{requestId, accountApprovalId, amountPaise}`.
- `GET /dentists/me/withdrawals/{withdrawalId}`: owner-only details; unrelated and missing IDs both return 404.
- `GET/PATCH /admin/wallet-settings`: global policy with optimistic versioning and explicit unpriced-booking assignment.
- `GET /admin/withdrawals`, `GET /admin/withdrawals/{withdrawalId}`, `POST /admin/withdrawals/{withdrawalId}/actions`: review and manual transfer progress.

Migration `1792846800000_dentist_wallet.sql` adds settings, withdrawal records/events, a shared transfer-reference registry and nullable transaction fee snapshots. It is applied locally with fee/minimum unset. Run `npm run migrate -- up` on other databases. Existing payment statuses, assigned payout amounts and clinic receipts are preserved. No native rebuild is needed.

Manual verification with disposable test records: configure a test fee/minimum; explicitly price earlier unpriced online bookings if desired; complete a captured online visit; request less than/at the minimum and more than available; submit a valid request; verify admin notification and reservation. Decline it with a reason and check the released balance. Use a separate request to test approval, processing and synthetic transfer recording. Never send a real transfer merely to test these screens. Check retries, changed bank details, another dentist's scope, history paging and logout cleanup.

Automated coverage includes `dentra-api/test/e2e/wallet.e2e-spec.ts`, all three clients' wallet component tests, and the earlier payout/payment suites. Tests use synthetic data, mocked provider calls and a disposable database schema. They cover exact balances, global fee snapshots, explicit backfills and audit rollback, minimum changes, concurrent reservations/retries, ownership, refund adjustments, legacy reservations, references, notifications, review and cache cleanup. They do not prove a bank transfer.

## Patient behaviour

- New online bookings hold their slot for 15 minutes. Failed attempts can retry the same order during that window.
- Unpaid holds expire and release the slot. Existing bookings with no checkout deadline and pay-at-clinic bookings are preserved.
- Cancelling a captured payment immediately cancels the appointment and saves a full refund request in the same database transaction. The API does not call the provider inside that transaction.
- `refund_pending` displays **Refund processing**. `refunded` appears only after a processed gateway response or signed webhook. `refund_failed` displays **Refund needs attention** and a support link.
- A late capture after cancellation/expiry queues a refund. It never restores the appointment or takes the slot from another patient.

## Background processing

Keep the API running. Refund delivery ticks every 10 seconds; payment reconciliation and unpaid hold expiry tick every 30 seconds. Workers are disabled automatically in tests and invoked explicitly there.

Each refund request has a persisted UUID, amount and payment reference. Submission retries send the same UUID in `X-Refund-Idempotency` and the same body, following [Razorpay's idempotent refund API](https://razorpay.com/docs/api/refunds/normal-refunds-idempotent). The installed Node SDK strips this header, so the adapter uses bounded HTTP requests for refunds and status reads.

Refund jobs have recoverable leases for multiple workers/restarts. Submission errors retry with exponential backoff, stopping after eight attempts with a visible failed state. Once a gateway refund ID exists, the worker polls that refund instead of submitting again; this also recovers missing refund webhooks. Pending refunds can take longer than the submission retry window, so status polling continues until a final state.

Order reconciliation checks new unresolved online orders once per minute for up to seven days. Captures use the same locked transitions and amount/currency checks as webhooks. If reconciliation confirms a capture after its hold has already expired, the payment is refunded rather than restoring the booking. A provider outage can therefore delay payment confirmation and lead to cancellation/refund after the hold expires.

Admin Payments separates paid, processing-refund, failed-refund and completed-refund totals. **Recheck refund** requeues the saved failed request and adds an audit entry. It preserves its request key; an existing gateway refund ID causes a status read. A gateway-confirmed failed refund may require action in the Razorpay dashboard; this button does not create a new refund with another key. Partial refunds are not managed here and never count as a full refund.

## Setup and manual test

1. Apply `npm run migrate -- up` in `dentra-api`. Migration `1792242000000_payment_refunds` adds the refund queue, statuses and nullable checkout fields without rewriting existing transactions.
2. Configure matching Razorpay test keys and the webhook secret in the API. Subscribe the reachable `/payments/webhook` URL to `payment.captured`, `payment.failed`, `refund.created`, `refund.processed` and `refund.failed`. See [Razorpay payment webhooks](https://razorpay.com/docs/webhooks/payments/). Provider polling can recover missing confirmations, but webhook delivery remains the preferred path.
3. Create a new patient booking and complete Razorpay test checkout. Confirm the patient and Admin Payments both show **Paid**. A dismissed checkout must keep the booking awaiting payment until its hold expires.
4. Cancel the paid appointment. Confirm the slot is available and both clients show **Refund processing** until the provider confirms completion; test-mode processing may finish quickly. Confirm only one refund request exists in the Razorpay dashboard. Repeating cancellation must not create another request.
5. Confirm **Refunded** only after provider processing. If the provider rejects the refund, confirm **Refund needs attention** and the admin recheck action.
6. For the consultation journey, use a separate paid video booking: check the dentist notification, join the call from dentist web and patient mobile, save clinical notes/chart, sign a prescription, complete the visit, and open the patient's visit summary and records.

Automated tests use an isolated PostgreSQL schema and mocked outbound provider calls. They cover signatures, exact amounts, duplicate/out-of-order events, concurrent cancellation/capture, retries, expired leases, missing confirmations, checkout expiry, admin recovery/auditing and the clinical completion flow. They do not prove real Razorpay checkout or bank processing. Real SMS remains deferred.
