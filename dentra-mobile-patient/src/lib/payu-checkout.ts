import { NativeEventEmitter, type EmitterSubscription } from 'react-native';
import PayUBizSdk from 'payu-non-seam-less-react';
import { preparePayuCheckout } from '@/api/payment-checkout';
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
      const finish = (error?: Error) => {
        if (finished) return;
        finished = true;
        subscriptions.forEach(subscription => subscription.remove());
        if (error) reject(error);
        else resolve();
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
        emitter.addListener('onError', () =>
          finish(new Error('PayU checkout could not open. Please try again.')),
        ),
        emitter.addListener('generateHash', event => {
          const request = event as HashRequest;
          const token = store.getState().auth.accessToken;
          // RN 0.82+ must use native networking while PayU owns the checkout activity.
          // The backend validates ownership, amount, customer and permitted commands.
          sdk
            .makeHttpRequest(
              `${API_BASE_URL}/payments/appointments/${appointmentId}/hash`,
              'POST',
              JSON.stringify(request),
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
                throw new Error('Invalid checkout verification response.');
              sdk.hashGenerated({ [request.hashName]: body.hash });
            })
            .catch(() => {
              // Unblock the SDK's pending callback so it can display its normal failure screen.
              if (!finished) sdk.hashGenerated({ [request.hashName]: '' });
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
