import React from 'react';
import { Text, TextInput } from 'react-native';
import Renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { api } from '../src/api/client';
import { session } from '../src/features/auth/session';
import { createStoreHarness } from '../test-utils/store';
import { PaymentsScreen } from '../src/features/payments/PaymentsScreen';
import { PaymentReceiptScreen } from '../src/features/payments/PaymentReceiptScreen';
import { PaymentCard } from '../src/features/payments/PaymentCard';
import { Button } from '../src/components/ui/Button';
import { DateField } from '../src/components/forms/DateField';
import { dentraApi } from '../src/store/dentraApi';
import { paymentsApi } from '../src/api/payments.api';
import type {
  DentistPayment,
  DentistPaymentSummary,
  PaymentsQuery,
} from '../src/common/types/payments';

jest.mock('@react-navigation/native', () => ({ useIsFocused: () => true }));
const navigate = jest.fn();
let state: ReturnType<typeof createStoreHarness>;
let tree: ReactTestRenderer;
let requests: { path: string; params?: PaymentsQuery }[];
let fail: boolean;
let hold: { source?: string; promise: Promise<void> } | undefined;
let summary: DentistPaymentSummary;
let clinic: DentistPayment;
let online: DentistPayment;

function reply(config: InternalAxiosRequestConfig, data: unknown) {
  return { config, data, status: 200, statusText: 'OK', headers: {} };
}
async function flush() {
  for (let i = 0; i < 8; i++)
    await new Promise<void>(resolve => setImmediate(resolve));
}
async function mount(receipt = false) {
  await act(async () => {
    tree = Renderer.create(
      state.wrap(
        receipt ? (
          <PaymentReceiptScreen
            navigation={{ navigate } as never}
            route={{
              key: 'receipt',
              name: 'PaymentReceipt',
              params: { transactionId: clinic.id },
            }}
          />
        ) : (
          <PaymentsScreen
            navigation={{ navigate } as never}
            route={{ key: 'payments', name: 'Payments' }}
          />
        ),
      ),
    );
    await flush();
  });
}
const button = (title: string) =>
  tree.root.findAllByType(Button).find(node => node.props.title === title)!;
async function press(title: string) {
  await act(async () => {
    await button(title).props.onPress();
    await flush();
  });
}
function content() {
  return tree.root
    .findAllByType(Text)
    .map(node => node.props.children)
    .flat(Infinity)
    .filter(value => typeof value === 'string' || typeof value === 'number')
    .join(' ');
}
beforeEach(async () => {
  state = createStoreHarness();
  tree = undefined as never;
  requests = [];
  fail = false;
  hold = undefined;
  navigate.mockClear();
  clinic = {
    id: 'clinic-transaction',
    appointmentId: 'clinic-visit',
    patientName: 'Synthetic Clinic Patient',
    appointmentDate: '2026-10-24',
    appointmentTime: '10:00',
    appointmentType: 'clinic',
    appointmentStatus: 'completed',
    clinicName: 'Test clinic',
    source: 'clinic',
    method: 'pay_at_clinic',
    status: 'paid',
    amountPaise: 50029,
    collection: {
      id: 'clinic-receipt',
      amountPaise: 50029,
      method: 'cash',
      collectedAt: '2026-10-24T10:00:00Z',
    },
    gatewayOrderId: null,
    gatewayPaymentId: null,
    gatewayRefundId: null,
    createdAt: '2026-10-20T12:00:00Z',
    updatedAt: '2026-10-24T10:00:00Z',
  };
  online = {
    ...clinic,
    id: 'online-transaction',
    appointmentId: 'online-visit',
    patientName: 'Synthetic Online Patient',
    source: 'online',
    method: 'upi',
    collection: null,
    gatewayOrderId: 'order_synthetic',
    gatewayPaymentId: 'pay_synthetic',
  };
  summary = {
    totalTransactions: 22,
    onlinePaidAmountPaise: 123029,
    clinicCollectedAmountPaise: 50029,
    dueAtClinicAmountPaise: 10001,
    pendingOnlineAmountPaise: 25029,
    refundPendingAmountPaise: 30029,
    refundFailedAmountPaise: 40029,
    refundedAmountPaise: 60029,
  };
  await session.signIn({
    accessToken: 'synthetic-report-access',
    refreshToken: 'synthetic-report-refresh',
    expiresInSeconds: 900,
  });
  api.defaults.adapter = async config => {
    expect(config.method).toBe('get');
    requests.push({ path: config.url!, params: config.params });
    const params = config.params as PaymentsQuery | undefined;
    if (hold && hold.source === params?.source) await hold.promise;
    if (fail) throw new AxiosError('Offline', 'ERR_NETWORK', config);
    if (config.url !== '/dentists/me/payments')
      return reply(config, config.url?.endsWith(clinic.id) ? clinic : online);
    const empty = params?.status === 'refunded';
    return reply(config, {
      summary: empty ? { ...summary, totalTransactions: 0 } : summary,
      items: empty
        ? []
        : params?.source === 'clinic'
        ? [clinic]
        : params?.page === 2
        ? [online]
        : [clinic, online],
      page: params?.page ?? 1,
      limit: 20,
      nextPage: params?.page === 2 || params?.source || empty ? null : 2,
    });
  };
});
afterEach(async () => {
  await act(async () => {
    tree?.unmount();
    state.cleanup();
  });
  jest.restoreAllMocks();
});

test('loads scoped collections and separate refund totals, paginates and opens receipt IDs', async () => {
  await mount();
  expect(requests[0]).toMatchObject({
    path: '/dentists/me/payments',
    params: { page: 1, limit: 20 },
  });
  expect(content()).toContain('₹500.29');
  expect(content()).toContain('Refund processing');
  expect(content()).toContain('Refund needs attention');
  await act(async () =>
    tree.root.findAllByType(PaymentCard)[0].props.onPress(),
  );
  expect(navigate).toHaveBeenCalledWith('PaymentReceipt', {
    transactionId: clinic.id,
  });
  await press('Next page');
  expect(requests.at(-1)!.params!.page).toBe(2);
  expect(tree.root.findAllByType(PaymentCard)).toHaveLength(1);
  expect(button('Next page').props.disabled).toBe(true);
  expect(content()).toContain('22');
});

test('applies date, status, source and literal search filters together, resetting pagination', async () => {
  await mount();
  await press('Next page');
  await press('Show filters');
  await press('At clinic');
  await press('Paid');
  await act(async () => {
    tree.root.findByType(TextInput).props.onChangeText('  clinic-receipt  ');
    tree.root.findAllByType(DateField)[0].props.onChange('2026-10-01');
    tree.root.findAllByType(DateField)[1].props.onChange('2026-10-24');
  });
  expect(requests.at(-1)!.params!.page).toBe(2); // Changes are applied explicitly.
  await press('Apply filters');
  expect(requests.at(-1)!.params).toMatchObject({
    page: 1,
    source: 'clinic',
    status: 'paid',
    q: 'clinic-receipt',
    from: '2026-10-01',
    to: '2026-10-24',
  });
  await press('Clear filters');
  expect(requests.at(-1)!.params).toMatchObject({ page: 1, limit: 20 });
  expect(requests.at(-1)!.params!.source).toBeUndefined();
  expect(tree.root.findAllByType(DateField)[0].props.value).toBeNull();
});

test('rejects an inverted date range without requesting another report and handles empty results', async () => {
  await mount();
  await press('Show filters');
  await act(async () => {
    tree.root.findAllByType(DateField)[0].props.onChange('2026-10-24');
    tree.root.findAllByType(DateField)[1].props.onChange('2026-10-01');
  });
  const before = requests.length;
  await press('Apply filters');
  expect(requests).toHaveLength(before);
  expect(content()).toContain('start date must be');
  await press('Clear filters');
  await press('Refunded');
  await press('Apply filters');
  expect(content()).toContain('No matching payments');
  expect(button('Next page').props.disabled).toBe(true);
});

test('retries a load error and hides the previous page while a new filter request is pending', async () => {
  fail = true;
  await mount();
  expect(content()).toContain('Could not load payments');
  fail = false;
  await press('Try again');
  await press('Show filters');
  let release!: () => void;
  hold = {
    source: 'clinic',
    promise: new Promise<void>(resolve => {
      release = resolve;
    }),
  };
  await press('At clinic');
  await act(async () => {
    button('Apply filters').props.onPress();
    await flush();
  });
  expect(content()).toContain('Loading payments');
  expect(tree.root.findAllByType(PaymentCard)).toHaveLength(0);
  await act(async () => {
    release();
    await flush();
  });
  expect(
    tree.root.findAllByType(PaymentCard).map(node => node.props.payment.id),
  ).toEqual([clinic.id]);
});

test('shows private receipt details, links to the appointment and hides stale data after a denied read', async () => {
  await mount(true);
  expect(content()).toContain('clinic-receipt');
  expect(content()).toContain('At clinic · Cash');
  expect(content()).toContain('IST');
  await press('Open appointment');
  expect(navigate).toHaveBeenCalledWith('Appointment', {
    appointmentId: clinic.appointmentId,
  });
  api.defaults.adapter = async config => {
    throw new AxiosError('Unavailable', 'ERR_BAD_REQUEST', config, undefined, {
      ...reply(config, { message: 'Payment unavailable' }),
      status: 404,
    });
  };
  await act(async () => {
    await state.store
      .dispatch(
        dentraApi.endpoints.getPayment.initiate(clinic.id, {
          forceRefetch: true,
        }),
      )
      .unwrap()
      .catch(() => null);
    await flush();
  });
  expect(content()).toContain('Could not load payment');
  expect(content()).not.toContain('clinic-receipt');
});

test('refreshes report queries after a recorded collection invalidates appointment payments', async () => {
  await mount();
  const previous = requests.length;
  await act(async () => {
    state.store.dispatch(dentraApi.util.invalidateTags(['Appointments']));
    await flush();
  });
  expect(requests.length).toBeGreaterThan(previous);
});

test('requests online references by transaction ID and removes payment data on session cache reset', async () => {
  const response = await paymentsApi.get(online.id);
  expect(response.gatewayPaymentId).toBe('pay_synthetic');
  await mount();
  await act(async () => {
    tree.unmount();
    state.store.dispatch(dentraApi.util.resetApiState());
  });
  expect(
    dentraApi.endpoints.getPayments.select({ page: 1, limit: 20 })(
      state.store.getState(),
    ).data,
  ).toBeUndefined();
});
