# PayU setup for Dentra

New online bookings use PayU. Existing Razorpay transactions keep their original provider for verification, refunds and history. Clinic payments, wallet calculations and the three-day follow-up pass retain their existing rules.

## 1. Create a merchant account

Create a PayU India merchant account through the [official PayU dashboard](https://onboarding.payu.in/). Complete the account details requested by PayU. Use Test Mode while integrating; production activation and merchant verification are separate steps controlled by PayU.

Find the **merchant key and salt** for your test account in the dashboard's payment gateway integration settings. The [PayU production checklist](https://docs.payu.in/docs/integration-checklist-merchant-hosted-checkout) describes the Key Salt Details section and switching to live credentials. Never paste the salt into chat, Git, a mobile environment file, or a web frontend.

## 2. Configure the API

Add these values to `dentra-api/.env` for local API testing, or to Render → dentra-api → Environment for hosted API testing:

```dotenv
PAYMENT_PROVIDER=payu
PAYU_ENVIRONMENT=test
PAYU_MERCHANT_KEY=your_test_merchant_key
PAYU_MERCHANT_SALT=your_test_merchant_salt
PUBLIC_API_URL=https://dentra-api-gwo6.onrender.com
```

`PUBLIC_API_URL` must be the public HTTPS origin of the API the app uses, with no trailing API route. When using a local API, provide a public HTTPS tunnel URL that forwards to that API so PayU can reach its callbacks. Never use localhost or the emulator's `10.0.2.2` for PayU callbacks.

The API starts without PayU credentials, but new online booking/checkout returns an unavailable message until the configuration is complete. No credentials are included in the repository.

Keep `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` and `RAZORPAY_WEBHOOK_SECRET` configured while historical Razorpay payments or unresolved refunds remain. Keep their existing `/payments/webhook` registration. They are used only for transactions belonging to Razorpay when PayU is selected for new bookings.

## 3. Apply the additive database migration

Run the existing migration workflow against your intended database before starting the updated API:

```bash
cd dentra-api
npm run migrate -- up
```

The migration `1795046400000_payu_gateway.sql` adds the payment provider and a server-owned checkout snapshot. Existing rows are labelled Razorpay; it does not delete or convert payments. For a fresh database, use the updated `schema.sql` instead.

If you normally apply SQL through Supabase SQL Editor, apply **only the Up Migration section** of that file. The Down Migration section intentionally raises an error to prevent deleting financial metadata.

## 4. Configure callbacks and webhooks

The mobile SDK receives these redirect URLs from the backend:

```text
Success: https://dentra-api-gwo6.onrender.com/payments/payu/callback/success
Failure: https://dentra-api-gwo6.onrender.com/payments/payu/callback/failure
```

In PayU's webhook settings, register payment success/failure events at:

```text
https://dentra-api-gwo6.onrender.com/payments/payu/webhook
```

Register refund events at:

```text
https://dentra-api-gwo6.onrender.com/payments/payu/refund-webhook
```

Use your actual API origin for all three routes. Payment callbacks require a valid PayU reverse hash, and the API then verifies capture directly with PayU. Refund callbacks are only hints: a refund of a known saved payment is fetched from PayU before its status changes. Background reconciliation remains active for delayed/missed callbacks. See [PayU webhook setup](https://docs.payu.in/docs/create-a-new-webhook).

## 5. Rebuild Patient Mobile

PayU is a native SDK, so a Metro reload alone cannot add it:

```bash
cd dentra-mobile-patient
npm ci --legacy-peer-deps
cd ios
pod install
cd ..
```

Then run Android/iOS using your usual commands. The `postinstall` script applies the pinned PayU 4.3.0 compatibility patch: Android uses platform TLS certificate validation, and checkout payloads are removed from the SDK's HTTP logs. Do not bypass this script with `--ignore-scripts` when installing dependencies.

Both new PayU checkout and legacy Razorpay checkout are supported in this app. Deploy the API/migration with `PAYMENT_PROVIDER=razorpay` first if older app builds are still in use. Install the updated app on your testing devices, then switch the API to `PAYMENT_PROVIDER=payu` and restart/redeploy it. The Render blueprint defaults new deployments to PayU; keep the provider setting consistent with this rollout order.

Use automatic capture with no PayU additional charges or split-payment configuration; the integration confirms the exact consultation amount.

Patients must have a valid email in Profile and an Indian ten-digit mobile number to start PayU checkout. If email is missing, the API tells them to add it; it does not invent a customer email.

## 6. Test before going live

Use a disposable appointment through the same API environment configured above. Test:

1. Successful checkout → Paid in Patient Mobile and Admin Payments, with no duplicate charge.
2. Failed checkout and cancellation → a retry remains possible on the same unpaid appointment.
3. Close/background the app after paying → the backend still confirms the payment.
4. Delayed callback → payment refresh/background reconciliation finds the capture.
5. Cancel a paid booking → refund pending, then refunded after provider confirmation.
6. A payment captured after slot expiry/cancellation → refund queued; the old slot is not reopened.
7. Existing Razorpay payments still display and reconcile with Razorpay.

Use PayU's current [test payment instructions](https://docs.payu.in/docs/reactnative-checkoutpro-android-integration). Test-mode UPI intent/in-app flows have restrictions; a simulator success screen is not a real bank debit or OTP flow. Do not use real card details for sandbox tests.

The automated suites mock PayU and Razorpay; they do not create charges or issue actual refunds. Merchant credentials and a real sandbox checkout are still required to verify your account's enabled payment modes and callback delivery.

### If checkout stays on Processing

PayU Checkout Pro 3.4 (included in the pinned React Native SDK) requests `get_checkout_details`, `get_sdk_configuration`, `get_all_offer_details`, and `quickPayEvent` during initialization. The last two use a `JSON body|HTTP date|` signing string, instead of the older `merchant key|command|argument|` format. Both formats are signed on the API with the merchant salt; the JSON requests are restricted to the saved checkout's amount and customer.

Deploy the updated API hash handler before testing the updated mobile JavaScript. An older API rejects the offer/Quick Pay requests, which prevents checkout from initializing. The mobile handler also finishes pending hash callbacks before releasing its listeners, and retains the API error when verification fails.

This fix requires an API redeployment and a patient app JavaScript reload. It needs no new database migration or native SDK installation if PayU 4.3.0 is already built into the app. If the native SDK itself has not been installed yet, follow step 5 above.

## 7. Go live when ready

After PayU activates the merchant account and test checkout/refunds work, replace the test key/salt with live credentials and set `PAYU_ENVIRONMENT=live` on the API. The backend supplies the correct SDK environment; no salt belongs in the app. Confirm the live webhook registration and run an authorized low-value payment/refund test.

PayU collecting patient payments does not automatically transfer dentist wallet balances. The existing withdrawal approval/transfer workflow remains separate.
