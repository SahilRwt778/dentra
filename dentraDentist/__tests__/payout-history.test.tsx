import React from 'react';
import { Text } from 'react-native';
import Renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { AxiosError } from 'axios';
import { api } from '../src/api/client';
import { session } from '../src/features/auth/session';
import { createStoreHarness } from '../test-utils/store';
import { dentraApi } from '../src/store/dentraApi';
import { PayoutHistoryScreen } from '../src/features/payments/PayoutHistoryScreen';
import { PayoutBatchScreen } from '../src/features/payments/PayoutBatchScreen';
import { Button } from '../src/components/ui/Button';
import type {
  PayoutBatchDetail,
  PayoutBatchQuery,
} from '../src/common/types/payout-batch';

jest.mock('@react-navigation/native', () => ({ useIsFocused: () => true }));
const navigate = jest.fn();
let state: ReturnType<typeof createStoreHarness>;
let tree: ReactTestRenderer;
let requests: { path: string; params?: PayoutBatchQuery }[];
let batch: PayoutBatchDetail;
let fail: boolean;
async function flush() {
  for (let i = 0; i < 8; i++)
    await new Promise<void>(resolve => setImmediate(resolve));
}
async function mount(detail = false) {
  await act(async () => {
    tree = Renderer.create(
      state.wrap(
        detail ? (
          <PayoutBatchScreen
            navigation={{ navigate } as never}
            route={{
              key: 'payout',
              name: 'PayoutBatch',
              params: { batchId: batch.id },
            }}
          />
        ) : (
          <PayoutHistoryScreen
            navigation={{ navigate } as never}
            route={{ key: 'history', name: 'PayoutHistory' }}
          />
        ),
      ),
    );
    await flush();
  });
}
function content() {
  return tree.root
    .findAllByType(Text)
    .map(node => node.props.children)
    .flat(Infinity)
    .filter(value => typeof value === 'string' || typeof value === 'number')
    .join(' ')
    .replace(/\s+/g, ' ');
}
const button = (title: string) =>
  tree.root.findAllByType(Button).find(node => node.props.title === title)!;
async function press(title: string) {
  await act(async () => {
    button(title).props.onPress();
    await flush();
  });
}
beforeEach(async () => {
  await session.signIn({
    accessToken: 'synthetic-ledger-access',
    refreshToken: 'synthetic-ledger-refresh',
    expiresInSeconds: 900,
  });
  state = createStoreHarness();
  tree = undefined as never;
  requests = [];
  fail = false;
  navigate.mockClear();
  batch = {
    id: 'test-batch',
    dentistId: 'test-dentist',
    dentistName: 'Synthetic Dentist',
    status: 'paid',
    version: 3,
    feeBps: 1250,
    grossPaise: 10029,
    feePaise: 1254,
    netPaise: 8775,
    accountLast4: '9012',
    bankIfsc: 'TEST0001234',
    createdAt: '2026-10-24T10:00:00Z',
    updatedAt: '2026-10-24T10:00:00Z',
    bankReference: 'UTR-SYNTHETIC',
    paidOn: '2026-10-24',
    needsAttention: false,
    account: null,
    items: [
      {
        transactionId: 'test-transaction',
        appointmentId: 'test-visit',
        patientName: 'Synthetic Patient',
        amountPaise: 10029,
        feePaise: 1254,
        paymentStatus: 'paid',
        appointmentStatus: 'completed',
        released: false,
      },
    ],
    events: [
      {
        id: 'event-one',
        status: 'paid',
        note: 'Synthetic transfer recorded',
        createdAt: '2026-10-24T10:00:00Z',
      },
    ],
  };
  api.defaults.adapter = async config => {
    expect(config.method).toBe('get');
    requests.push({ path: config.url!, params: config.params });
    if (fail) throw new AxiosError('Offline', 'ERR_NETWORK', config);
    const params = config.params as PayoutBatchQuery | undefined;
    const empty = params?.status === 'cancelled';
    const data = config.url?.endsWith(batch.id)
      ? batch
      : {
          items: empty ? [] : [batch],
          total: empty ? 0 : 21,
          reservedPaise: 0,
          paidPaise: empty ? 0 : 8775,
          nextPage: params?.page === 2 || empty ? null : 2,
        };
    return { config, data, status: 200, statusText: 'OK', headers: {} };
  };
});
afterEach(async () => {
  await act(async () => {
    tree?.unmount();
    state.cleanup();
  });
});

test('loads own payout history through Axios, paginates, filters and navigates by ID', async () => {
  await mount();
  expect(requests[0]).toMatchObject({
    path: '/dentists/me/payout-batches',
    params: { page: 1, limit: 20 },
  });
  expect(content()).toContain('₹87.75');
  expect(content()).toContain('Account ending 9012');
  await press('View payout');
  expect(navigate).toHaveBeenCalledWith('PayoutBatch', { batchId: batch.id });
  await press('Next page');
  expect(requests.at(-1)!.params!.page).toBe(2);
  await press('Paid');
  expect(requests.at(-1)!.params).toMatchObject({ page: 1, status: 'paid' });
  await press('Cancelled');
  expect(content()).toContain('No payouts for these filters');
  expect(button('Next page').props.disabled).toBe(true);
});
test('shows saved fee, transfer evidence and included appointments without bank account numbers', async () => {
  await mount(true);
  expect(requests[0].path).toBe('/dentists/me/payout-batches/test-batch');
  expect(content()).toContain('12.50%');
  expect(content()).toContain('UTR-SYNTHETIC');
  expect(content()).toContain('Synthetic transfer recorded');
  expect(content()).toContain('Ending 9012');
  expect(content()).not.toContain('123456789012');
  await press('Open appointment');
  expect(navigate).toHaveBeenCalledWith('Appointment', {
    appointmentId: 'test-visit',
  });
});
test('retries load errors and hides stale receipt details after a denied refresh', async () => {
  fail = true;
  await mount(true);
  expect(content()).toContain('Could not load payout');
  fail = false;
  await press('Try again');
  expect(content()).toContain('UTR-SYNTHETIC');
  api.defaults.adapter = async config => {
    throw new AxiosError('Not found', 'ERR_BAD_REQUEST', config, undefined, {
      config,
      data: { message: 'Payout unavailable' },
      status: 404,
      statusText: 'Not found',
      headers: {},
    });
  };
  await act(async () => {
    await state.store
      .dispatch(
        dentraApi.endpoints.getPayoutBatch.initiate(batch.id, {
          forceRefetch: true,
        }),
      )
      .unwrap()
      .catch(() => null);
    await flush();
  });
  expect(content()).toContain('Could not load payout');
  expect(content()).not.toContain('UTR-SYNTHETIC');
});
test('refreshes payout data on invalidation and removes it on account cache reset', async () => {
  await mount();
  const before = requests.length;
  await act(async () => {
    state.store.dispatch(dentraApi.util.invalidateTags(['Payout']));
    await flush();
  });
  expect(requests.length).toBeGreaterThan(before);
  await act(async () => {
    tree.unmount();
    state.cleanup();
  });
  expect(Object.keys(state.store.getState().dentraApi.queries)).toHaveLength(0);
});
