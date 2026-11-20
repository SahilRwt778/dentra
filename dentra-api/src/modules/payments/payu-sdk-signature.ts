import { BadRequestException } from '@nestjs/common';
import type { PayuCheckoutData, PayuHashRequest } from './payu-gateway.service';

export const SDK_SIGNATURE_COMMANDS = new Set([
  'get_all_offer_details',
  'quickPayEvent',
]);

/** PayU 3.4 sends these read requests as JSON|HTTP-date|, without the key/command prefix. */
export function validatePayuSdkSignature(
  request: PayuHashRequest,
  checkout: PayuCheckoutData,
) {
  if (request.hashType === 'V2' || !request.hashString.endsWith('|')) invalid();
  const separator = request.hashString.lastIndexOf(
    '|',
    request.hashString.length - 2,
  );
  const json = request.hashString.slice(0, separator);
  const date = request.hashString.slice(separator + 1, -1);
  const timestamp = Date.parse(date);
  if (
    separator < 1 ||
    !Number.isFinite(timestamp) ||
    new Date(timestamp).toUTCString() !== date ||
    json.includes('|')
  )
    invalid();

  let body: Record<string, unknown>;
  try {
    body = record(JSON.parse(json));
  } catch {
    invalid();
  }
  // Do not sign an arbitrary JSON payload: the signature is reusable at PayU.
  // These schemas allow only checkout reads for the saved amount and customer.
  if (request.hashName === 'quickPayEvent') {
    onlyFields(body, [
      'amount',
      'userToken',
      'phone',
      'email',
      'requestId',
      'requestType',
      'deviceId',
      'userCredential',
    ]);
    if (
      body.requestType !== 'quickpay' ||
      body.userCredential !== checkout.userCredential ||
      typeof body.requestId !== 'string' ||
      !body.requestId.startsWith(checkout.transactionId) ||
      !/^[a-zA-Z0-9]{1,80}$/.test(body.requestId)
    )
      invalid();
    sameIfPresent(body.phone, checkout.phone);
    sameIfPresent(body.email, checkout.email);
    if (
      body.deviceId != null &&
      (typeof body.deviceId !== 'string' || body.deviceId.length > 256)
    )
      invalid();
  } else if (request.hashName === 'get_all_offer_details') {
    onlyFields(body, ['amount', 'userToken', 'userDetail']);
    if (body.userDetail != null) {
      const user = record(body.userDetail);
      onlyFields(user, ['loggedInPhoneNumber', 'isConsented']);
      sameIfPresent(user.loggedInPhoneNumber, checkout.phone);
      if (user.isConsented != null && typeof user.isConsented !== 'boolean')
        invalid();
    }
  } else invalid();

  if (
    body.userToken != null &&
    body.userToken !== '' &&
    body.userToken !== checkout.additionalParam.udf1 &&
    body.userToken !== checkout.userCredential
  )
    invalid();
  // A numeric SDK amount may omit trailing zeroes, while checkout stores two decimals.
  if (
    !['string', 'number'].includes(typeof body.amount) ||
    !/^\d+(?:\.\d{1,2})?$/.test(String(body.amount)) ||
    Number(body.amount) !== Number(checkout.amount)
  )
    invalid();
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid();
  return value as Record<string, unknown>;
}

function onlyFields(value: Record<string, unknown>, allowed: string[]) {
  if (Object.keys(value).some((key) => !allowed.includes(key))) invalid();
}

function sameIfPresent(value: unknown, expected: string) {
  if (value != null && value !== '' && value !== expected) invalid();
}

function invalid(): never {
  throw new BadRequestException(
    'PayU SDK request does not match this checkout.',
  );
}
