import { NativeEventEmitter, type EmitterSubscription } from 'react-native';
import PayUBizSdk from 'payu-non-seam-less-react';
import { preparePayuCheckout } from '@/api/payment-checkout';
import { errorMessage } from '@/api/errors';
import { API_BASE_URL } from '@/config';
import { refreshSession } from '@/auth/session';
import { setAccessToken } from '@/store/auth-slice';
import { store } from '@/store/store';
import { colors } from '@/theme';

type HashRequest = {
  hashName: string;
  hashString: string;
  hashType?: string;
  postSalt?: string;
};
let checkoutOpen = false;

function checkoutError(event: unknown): Error {
  const response = event as
    | { errorMsg?: unknown; errorCode?: unknown }
    | undefined;
  const message =
    typeof response?.errorMsg === 'string' ? response.errorMsg.trim() : '';
  const code = response?.errorCode;
  const reference =
    (typeof code === 'string' &&
      code !== 'null' &&
      code !== 'undefined' &&
      code !== '') ||
    typeof code === 'number'
      ? ` (PayU ${code})`
      : '';
  return new Error(
    `${
      message || 'PayU checkout could not open. Please try again.'
    }${reference}`,
  );
}

/** Native checkout events only finish the UI; the appointment is confirmed separately by the API. */
export async function openPayuCheckout(appointmentId: string) {
  const sdk = PayUBizSdk;
  if (!sdk?.openCheckoutScreen || !sdk.makeHttpRequest)
    throw new Error('Rebuild the patient app to enable PayU checkout.');
  if (checkoutOpen) throw new Error('Payment checkout is already open.');
  checkoutOpen = true;
  try {
    // Start with a fresh access token before native checkout temporarily owns networking.
    const freshAccessToken = await refreshSession();
    if (freshAccessToken) store.dispatch(setAccessToken(freshAccessToken));
    const checkout = await preparePayuCheckout(appointmentId);
    return await new Promise<void>((resolve, reject) => {
      const emitter = new NativeEventEmitter(sdk);
      const subscriptions: EmitterSubscription[] = [];
      let finished = false;
      let pendingHashes = 0;
      let hashError: Error | undefined;
      let sdkError: Error | undefined;
      const finish = (error?: Error) => {
        if (finished) return;
        finished = true;
        subscriptions.forEach(subscription => subscription.remove());
        if (error) reject(error);
        else resolve();
      };
      const failAfterPendingHashes = (error: Error) => {
        sdkError = hashError ?? error;
        // PayU asks for several hashes together. Answer the remaining requests
        // before removing listeners, otherwise its loading screen stays open.
        if (pendingHashes === 0) finish(sdkError);
      };
      // Success/failure/cancel can race the provider callback. Always verify server status afterward.
      subscriptions.push(
        emitter.addListener('onPaymentSuccess', () => finish()),
        emitter.addListener('onPaymentFailure', () =>
          finish(
            new Error(
              'Payment was not completed. Please check its status before retrying.',
            ),
          ),
        ),
        emitter.addListener('onPaymentCancel', () =>
          finish(
            Object.assign(
              new Error(
                'Payment cancelled. You can retry from your appointment.',
              ),
              { code: 'PAYMENT_CANCELLED' },
            ),
          ),
        ),
      );
      subscriptions.push(
        emitter.addListener('onError', event =>
          failAfterPendingHashes(checkoutError(event)),
        ),
        emitter.addListener('generateHash', event => {
          if (finished) return;
          const request = event as HashRequest;
          // Checkout Pro 3.4 names its normal payment signature "payment_source".
          // Keep the API's canonical name and return the hash under the SDK name.
          const apiRequest = {
            ...request,
            hashName:
              request.hashName === 'payment_source'
                ? 'payment'
                : request.hashName,
          };
          const token = store.getState().auth.accessToken;
          pendingHashes += 1;
          // RN 0.82+ must use native networking while PayU owns the checkout activity.
          // The backend validates ownership, amount, customer and permitted commands.
          sdk
            .makeHttpRequest(
              `${API_BASE_URL}/payments/appointments/${appointmentId}/hash`,
              'POST',
              JSON.stringify(apiRequest),
              {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token ?? ''}`,
              },
            )
            .then(response => {
              if (finished) return;
              const body =
                typeof response === 'string' ? JSON.parse(response) : response;
              if (
                !body ||
                typeof body.hash !== 'string' ||
                !/^[a-f\d]{64,128}$/i.test(body.hash)
              )
                throw new Error(
                  errorMessage(
                    { data: body },
                    'Could not verify PayU checkout. Please try again.',
                  ),
                );
              sdk.hashGenerated({ [request.hashName]: body.hash });
            })
            .catch(error => {
              if (finished) return;
              hashError ??= new Error(
                errorMessage(
                  error,
                  'Could not verify PayU checkout. Please try again.',
                ),
              );
              // Release the SDK callback and preserve the API reason for its onError event.
              sdk.hashGenerated({ [request.hashName]: '' });
              failAfterPendingHashes(hashError);
            })
            .finally(() => {
              pendingHashes -= 1;
              if (!finished && sdkError && pendingHashes === 0)
                finish(sdkError);
            });
        }),
      );
      try {
        sdk.openCheckoutScreen({
          payUPaymentParams: checkout.payUPaymentParams,
          payUCheckoutProConfig: {
            merchantName: 'Dentra',
            primaryColor: colors.accent,
          },
        });
      } catch {
        finish(new Error('PayU checkout could not open. Please try again.'));
      }
    });
  } finally {
    checkoutOpen = false;
  }
}
