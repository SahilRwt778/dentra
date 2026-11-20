import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import type { AppConfig } from '@config/configuration';
import type { GatewayPayment, GatewayRefund } from './razorpay-gateway.service';
import {
  SDK_SIGNATURE_COMMANDS,
  validatePayuSdkSignature,
} from './payu-sdk-signature';

export type PayuCheckoutData = {
  key: string;
  transactionId: string;
  amount: string;
  productInfo: string;
  firstName: string;
  email: string;
  phone: string;
  environment: '0' | '1';
  userCredential: string;
  android_surl: string;
  android_furl: string;
  ios_surl: string;
  ios_furl: string;
  additionalParam: {
    udf1: string;
    udf2: string;
    udf3: string;
    udf4: string;
    udf5: string;
  };
};
export type PayuHashRequest = {
  hashName: string;
  hashString: string;
  hashType?: 'V1' | 'V2';
  postSalt?: string;
};

const READ_COMMANDS = new Set([
  'payment_related_details_for_mobile_sdk',
  'vas_for_mobile_sdk',
  'get_checkout_details',
  'getEmiAmountAccordingToInterest',
  'getBinInfo',
  'check_isDomestic',
  'get_eligible_payment_options',
  'validateVPA',
  'get_sdk_configuration',
]);

export function payuAmount(paise: number): string {
  if (!Number.isSafeInteger(paise) || paise <= 0)
    throw new BadRequestException('Invalid payment amount.');
  return `${Math.floor(paise / 100)}.${String(paise % 100).padStart(2, '0')}`;
}
export function payuPaise(value: unknown): number {
  if (typeof value !== 'string' && typeof value !== 'number')
    throw new Error('Invalid PayU amount.');
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(String(value));
  if (!match) throw new Error('Invalid PayU amount.');
  const paise =
    Number(match[1]) * 100 + Number((match[2] || '').padEnd(2, '0'));
  if (!Number.isSafeInteger(paise) || paise <= 0)
    throw new Error('Invalid PayU amount.');
  return paise;
}
export function payuPaymentHashString(data: PayuCheckoutData): string {
  const udf = data.additionalParam;
  return (
    [
      data.key,
      data.transactionId,
      data.amount,
      data.productInfo,
      data.firstName,
      data.email,
      udf.udf1,
      udf.udf2,
      udf.udf3,
      udf.udf4,
      udf.udf5,
      '',
      '',
      '',
      '',
      '',
    ].join('|') + '|'
  );
}

@Injectable()
export class PayuGatewayService {
  private readonly settings: AppConfig['payu'];
  constructor(config: ConfigService<AppConfig>) {
    this.settings = config.get('payu', { infer: true })!;
  }
  get key() {
    return this.settings.key;
  }
  get environment() {
    return this.settings.environment;
  }
  get configured() {
    return !!(this.key && this.settings.salt && this.settings.publicApiUrl);
  }
  assertConfigured() {
    if (!this.configured)
      throw new ServiceUnavailableException(
        'PayU is not configured. Please contact support.',
      );
    const url = new URL(this.settings.publicApiUrl);
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      throw new ServiceUnavailableException(
        'PayU requires a public HTTPS API URL.',
      );
  }

  async createOrder(amountPaise: number) {
    this.assertConfigured();
    payuAmount(amountPaise);
    // PayU merchant transaction IDs must be alphanumeric and at most 25 characters.
    return { orderId: randomBytes(12).toString('hex') };
  }

  checkoutData(input: {
    orderId: string;
    amountPaise: number;
    patientId: string;
    firstName: string;
    email: string;
    phone: string;
  }): PayuCheckoutData {
    this.assertConfigured();
    if ([input.firstName, input.email].some((value) => value.includes('|')))
      throw new BadRequestException(
        'Please update your profile name or email before checkout.',
      );
    const callback = `${this.settings.publicApiUrl}/payments/payu/callback`;
    return {
      key: this.key,
      transactionId: input.orderId,
      amount: payuAmount(input.amountPaise),
      productInfo: 'Dentra consultation',
      firstName: input.firstName,
      email: input.email,
      phone: input.phone,
      environment: this.environment === 'live' ? '0' : '1',
      userCredential: `${this.key}:${input.patientId}`,
      android_surl: `${callback}/success`,
      android_furl: `${callback}/failure`,
      ios_surl: `${callback}/success`,
      ios_furl: `${callback}/failure`,
      additionalParam: {
        udf1: input.patientId,
        udf2: '',
        udf3: '',
        udf4: '',
        udf5: '',
      },
    };
  }

  /** Only an owned, unexpired checkout may call this. Never expose a general-purpose salt signer. */
  sdkHash(request: PayuHashRequest, data: PayuCheckoutData): string {
    this.assertConfigured();
    if (
      data.key !== this.key ||
      data.environment !== (this.environment === 'live' ? '0' : '1')
    )
      throw new BadRequestException(
        'Checkout configuration changed. Please try again.',
      );
    if (request.postSalt)
      throw new BadRequestException(
        'Additional charges and split payments are not enabled.',
      );
    if (request.hashName === 'payment') {
      if (
        request.hashType === 'V2' ||
        request.hashString !== payuPaymentHashString(data)
      )
        throw new BadRequestException(
          'Payment parameters do not match the booking.',
        );
    } else if (SDK_SIGNATURE_COMMANDS.has(request.hashName)) {
      validatePayuSdkSignature(request, data);
    } else {
      const prefix = `${this.key}|${request.hashName}|`;
      if (
        !READ_COMMANDS.has(request.hashName) ||
        !request.hashString.startsWith(prefix) ||
        !request.hashString.endsWith('|')
      )
        throw new BadRequestException('Unsupported checkout hash request.');
      const argument = request.hashString.slice(prefix.length, -1);
      // A command has exactly one signed argument. Extra pipes could turn a
      // read-command hash into a payment hash for an attacker-chosen transaction.
      if (argument.includes('|'))
        throw new BadRequestException('Invalid checkout command argument.');
      // No other account's saved payment instruments may be queried.
      if (
        request.hashName === 'payment_related_details_for_mobile_sdk' &&
        argument !== data.userCredential
      )
        throw new BadRequestException('Checkout customer does not match.');
    }
    return request.hashType === 'V2'
      ? createHmac('sha256', this.settings.salt)
          .update(request.hashString)
          .digest('hex')
      : createHash('sha512')
          .update(request.hashString + this.settings.salt)
          .digest('hex');
  }

  /** PayU posts form-encoded responses. Verify reverse hash, then read authoritative status from PayU. */
  verifyResponse(body: Record<string, unknown>): boolean {
    if (
      !this.settings.salt ||
      body.key !== this.key ||
      typeof body.hash !== 'string' ||
      !/^[a-f\d]{128}$/i.test(body.hash)
    )
      return false;
    const fields = [
      'status',
      'udf5',
      'udf4',
      'udf3',
      'udf2',
      'udf1',
      'email',
      'firstname',
      'productinfo',
      'amount',
      'txnid',
      'key',
    ];
    if (
      fields.some(
        (field) => body[field] !== undefined && typeof body[field] !== 'string',
      )
    )
      return false;
    if (body.splitInfo || body.additionalCharges || body.additional_charges)
      return false;
    const value = (field: string) => String(body[field] ?? '');
    const source = [
      this.settings.salt,
      value('status'),
      '',
      '',
      '',
      '',
      '',
      ...fields.slice(1).map(value),
    ].join('|');
    const expected = createHash('sha512').update(source).digest();
    return timingSafeEqual(expected, Buffer.from(body.hash, 'hex'));
  }

  async fetchOrderPayments(orderId: string): Promise<GatewayPayment[]> {
    const response = await this.command('verify_payment', orderId);
    const detail = object(object(response.transaction_details)[orderId]);
    // A merchant transaction exists locally before the patient enters checkout.
    if (detail.status === 'Not Found') return [];
    if (!Object.keys(detail).length)
      throw new Error(
        'PayU payment verification did not return a transaction result.',
      );
    if (detail.txnid !== orderId || !detail.mihpayid) return [];
    const captured =
      detail.status === 'success' && detail.unmappedstatus === 'captured';
    return [
      {
        id: payuId(detail.mihpayid),
        order_id: orderId,
        amount: payuPaise(detail.amt ?? detail.amount),
        currency: typeof detail.currency === 'string' ? detail.currency : 'INR',
        status: captured ? 'captured' : 'pending',
      },
    ];
  }

  async refund(
    paymentId: string,
    amountPaise: number,
    requestId: string,
  ): Promise<GatewayRefund> {
    const token = createHash('sha256')
      .update(requestId)
      .digest('hex')
      .slice(0, 23);
    // Recover an accepted submission after a timeout before reusing its fixed token.
    const previous = await this.command('check_action_status_txnid', paymentId);
    const existing = refundEntries(previous.transaction_details).find(
      (entry) => entry.token === token,
    );
    if (existing) return this.refundResponse(existing);
    const response = await this.command(
      'cancel_refund_transaction',
      paymentId,
      { var2: token, var3: payuAmount(amountPaise) },
    );
    if (
      (Number(response.status) !== 1 &&
        String(response.error_code) !== '102') ||
      !response.request_id
    )
      throw new Error(
        'PayU did not accept the refund; the saved token will be checked before retrying.',
      );
    if (response.mihpayid && payuId(response.mihpayid) !== paymentId)
      throw new Error('PayU refund payment mismatch.');
    return {
      refundId: payuId(response.request_id),
      paymentId,
      amountPaise,
      currency: 'INR',
      status: 'pending',
    };
  }

  async fetchRefund(refundId: string): Promise<GatewayRefund> {
    const response = await this.command('check_action_status', refundId);
    const entry = refundEntries(response.transaction_details).find(
      (row) => String(row.request_id) === refundId,
    );
    if (!entry) throw new Error('PayU refund status is not available yet.');
    return this.refundResponse(entry);
  }

  private refundResponse(entry: Record<string, unknown>): GatewayRefund {
    if (!entry.request_id || !entry.mihpayid || entry.action !== 'refund')
      throw new Error('Invalid PayU refund response.');
    const state = String(entry.status).trim().toLowerCase();
    return {
      refundId: payuId(entry.request_id),
      paymentId: payuId(entry.mihpayid),
      amountPaise: payuPaise(entry.amt),
      currency: 'INR',
      status:
        state === 'success'
          ? 'processed'
          : ['failure', 'failed'].includes(state)
            ? 'failed'
            : 'pending',
    };
  }

  private async command(
    command: string,
    reference: string,
    extra: Record<string, string> = {},
  ): Promise<Record<string, unknown>> {
    if (!this.key || !this.settings.salt)
      throw new ServiceUnavailableException('PayU access is not configured.');
    const hash = createHash('sha512')
      .update(`${this.key}|${command}|${reference}|${this.settings.salt}`)
      .digest('hex');
    const host =
      this.environment === 'live'
        ? 'https://info.payu.in'
        : 'https://test.payu.in';
    const response = await fetch(`${host}/merchant/postservice.php?form=2`, {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(15_000),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: new URLSearchParams({
        key: this.key,
        command,
        var1: reference,
        hash,
        ...extra,
      }).toString(),
    });
    if (!response.ok)
      throw Object.assign(new Error('PayU request failed.'), {
        statusCode: response.status,
      });
    const result: unknown = await response.json();
    if (!result || typeof result !== 'object' || Array.isArray(result))
      throw new Error('Invalid PayU response.');
    return result as Record<string, unknown>;
  }
}

function refundEntries(value: unknown): Record<string, unknown>[] {
  if (!value || typeof value !== 'object') return [];
  if ('request_id' in value) return [value as Record<string, unknown>];
  return Object.values(value).flatMap(refundEntries);
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function payuId(value: unknown): string {
  if (typeof value === 'number' && (!Number.isSafeInteger(value) || value <= 0))
    throw new Error('PayU references must not lose numeric precision.');
  if (typeof value !== 'number' && typeof value !== 'string')
    throw new Error('Invalid PayU reference.');
  const reference = String(value).trim();
  if (!/^\d{1,200}$/.test(reference))
    throw new Error('Invalid PayU reference.');
  return reference;
}
