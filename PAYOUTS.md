# Dentist payout details

Dentist Web → **Settings → Payout details → Add details** collects the account holder name, account number and confirmation, IFSC, PAN, and optional GSTIN. Verified dentists can submit their own details. Format validation and matching account confirmation happen on the server as well as in the form; this does not verify ownership with a bank.

Dentist Mobile → **Profile → Payout details → Manage** provides the same workflow with the prototype's card layout. Dentists can submit details, check pending/approved status, view rejection reasons, and correct/resubmit. A pending change keeps the previously approved account visible. Mobile uses the shared authenticated Axios client and Redux query cache; form values and account confirmation remain local to the screen.

Admin Web → **Payout review** lists pending requests, 20 per page. **Review payout details** opens the dentist's detail page at the payout section, showing the current approved account beside the submitted proposal. Admin can approve the exact proposal or reject it with a reason visible to the dentist.

Approval replaces the approved bank and tax fields in one transaction with the review decision and audit event. Payout review is independent of onboarding: a payout request does not change the dentist's verified status or appointment access. While an update is pending or rejected, the existing approved details remain active. Rejected requests can be corrected and resubmitted. Only one pending request per dentist is allowed, including concurrent submissions. Stale forms and repeated or competing admin decisions return a conflict instead of overwriting newer information.

Bank and tax identifiers are available only through the dentist's own authenticated account and admin detail views. Queue rows and general audit entries omit them. Account confirmation is never stored. Private payout responses use `Cache-Control: no-store`. Web and mobile status views check for review changes every 15 seconds while focused and support manual refresh. Mobile pauses that check while editing, retains the original request version, removes unused payout cache entries, and clears account data on logout. No payout approval initiates a transfer; gateway disbursements are a separate integration.

## Backend

- `GET /dentists/me/payout-details`: approved details plus the latest request.
- `POST /dentists/me/payout-requests`: submit a proposal. Send the last observed request ID as `previousRequestId`, or null for the first submission.
- `GET /admin/dentists/{dentistId}/payout-details`: private admin review view.
- `GET /admin/payout-requests?status=pending&page=1`: paginated requests; `approved` and `rejected` are also supported for API history queries.
- `POST /admin/payout-requests/{requestId}/approve`: approve an immutable pending proposal.
- `POST /admin/payout-requests/{requestId}/reject`: reject with a reason of 3–1000 characters.

For an existing database, run `npm run migrate -- up` from `dentra-api`. Migration `1792256400000_dentist_payout_requests.sql` adds the request table and indexes; existing approved details and all other records remain intact. Fresh installations use the matching definition in `schema.sql`.

## Verification

From `dentra-api`:

```sh
npm run test:e2e -- --runTestsByPath test/e2e/payouts.e2e-spec.ts test/e2e/admin.e2e-spec.ts
```

The runner creates and removes a disposable PostgreSQL schema. Tests cover roles and account state, validation, public-data isolation, pending account preservation, approval, rejection and correction, stale submissions, concurrent decisions, pagination, and transactional rollback when audit logging fails.

From `dentra-web-dentist`, run `npm test` for payout form and existing video navigation tests. Payout tests cover confirmation mismatch, pending state, corrected resubmission, clearing confirmation, and retaining the original request version while polling updates the page.

From `dentraDentist`, run `npm test -- --watchman=false --runInBand` for mobile settings and payout tests. They cover form validation, approval/rejection responses, preserved approved details during review, correction and resubmission, stale request conflicts, duplicate taps, lost-response retry, confirmation cleanup, and unused cache removal. These tests use synthetic responses; the live mobile-to-admin workflow still needs a manual device check.
