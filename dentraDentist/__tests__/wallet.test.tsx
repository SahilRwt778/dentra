import React from 'react';
import { Text, TextInput } from 'react-native';
import Renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { AxiosError } from 'axios';
import { api } from '../src/api/client';
import { session } from '../src/features/auth/session';
import { createStoreHarness } from '../test-utils/store';
import { dentraApi } from '../src/store/dentraApi';
import { WalletScreen } from '../src/features/wallet/WalletScreen';
import { RequestWithdrawalScreen } from '../src/features/wallet/RequestWithdrawalScreen';
import { WithdrawalScreen } from '../src/features/wallet/WithdrawalScreen';
import { withdrawalPaise } from '../src/features/wallet/wallet-format';
import { Button } from '../src/components/ui/Button';
import type {
  DentistWallet,
  RequestWithdrawal,
  WithdrawalDetail,
  WithdrawalQuery,
} from '../src/common/types/wallet';

jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => true,
  usePreventRemove: jest.fn(),
}));
const navigate = jest.fn();
let state: ReturnType<typeof createStoreHarness>, tree: ReactTestRenderer;
let wallet: DentistWallet, detail: WithdrawalDetail;
let requests: { path: string; params?: WithdrawalQuery }[],
  writes: RequestWithdrawal[];
let fail: boolean, loseResponse: boolean, applied: boolean;
async function flush() {
  for (let i = 0; i < 8; i++)
    await new Promise<void>(resolve => setImmediate(resolve));
}
async function mount(mode: 'wallet' | 'request' | 'detail' = 'wallet') {
  await act(async () => {
    const navigation = { navigate } as never;
    tree = Renderer.create(
      state.wrap(
        mode === 'request' ? (
          <RequestWithdrawalScreen
            navigation={navigation}
            route={{ key: 'request', name: 'RequestWithdrawal' }}
          />
        ) : mode === 'detail' ? (
          <WithdrawalScreen
            navigation={navigation}
            route={{
              key: 'detail',
              name: 'Withdrawal',
              params: { withdrawalId: detail.id },
            }}
          />
        ) : (
          <WalletScreen
            navigation={navigation}
            route={{ key: 'wallet', name: 'Wallet' }}
          />
        ),
      ),
    );
    await flush();
  });
}
function text() {
  return tree.root
    .findAllByType(Text)
    .map(node => node.props.children)
    .flat(Infinity)
    .filter(value => typeof value === 'string' || typeof value === 'number')
    .join(' ')
    .replace(/\s+/g, ' ');
}
function button(title: string) {
  return tree.root
    .findAllByType(Button)
    .find(node => node.props.title === title)!;
}
async function press(title: string) {
  await act(async () => {
    await button(title).props.onPress();
    await flush();
  });
}
async function amount(value: string) {
  await act(async () =>
    tree.root.findByType(TextInput).props.onChangeText(value),
  );
}
beforeEach(async () => {
  await session.signIn({
    accessToken: 'synthetic-wallet-access',
    refreshToken: 'synthetic-wallet-refresh',
    expiresInSeconds: 900,
  });
  state = createStoreHarness();
  tree = undefined as never;
  requests = [];
  writes = [];
  fail = false;
  loseResponse = false;
  applied = false;
  navigate.mockClear();
  wallet = {
    availablePaise: 10000,
    reservedPaise: 0,
    withdrawnPaise: 0,
    pendingPaise: 9000,
    eligibleGrossPaise: 11111,
    eligibleFeePaise: 1111,
    unpricedCount: 0,
    unpricedGrossPaise: 0,
    shortfallPaise: 0,
    configured: true,
    feeBps: 1000,
    minimumWithdrawalPaise: 1000,
    version: 1,
    account: {
      approvalId: 'approved-test',
      last4: '9012',
      ifsc: 'TEST0001234',
    },
  };
  detail = {
    id: 'synthetic-withdrawal',
    dentistId: 'test-dentist',
    dentistName: 'Synthetic Dentist',
    amountPaise: 2500,
    minimumPaise: 1000,
    status: 'rejected',
    version: 2,
    accountLast4: '9012',
    bankIfsc: 'TEST0001234',
    bankReference: null,
    paidOn: null,
    createdAt: '2026-10-24T10:00:00Z',
    updatedAt: '2026-10-24T10:00:00Z',
    account: null,
    approvalId: 'approved-test',
    accountChanged: false,
    wallet,
    events: [
      {
        id: 'event-one',
        status: 'rejected',
        note: 'Please verify your payout details',
        createdAt: '2026-10-24T10:00:00Z',
      },
    ],
  };
  api.defaults.adapter = async config => {
    const reply = (data: unknown) => ({
      config,
      data,
      status: 200,
      statusText: 'OK',
      headers: {},
    });
    if (config.method === 'post') {
      const body = JSON.parse(config.data) as RequestWithdrawal;
      writes.push(body);
      if (!applied) {
        applied = true;
        wallet = {
          ...wallet,
          availablePaise: wallet.availablePaise - body.amountPaise,
          reservedPaise: body.amountPaise,
        };
        detail = {
          ...detail,
          id: body.requestId,
          amountPaise: body.amountPaise,
          status: 'requested',
          version: 1,
          wallet,
        };
      }
      if (loseResponse) {
        loseResponse = false;
        throw new AxiosError('Lost response', 'ERR_NETWORK', config);
      }
      return reply(detail);
    }
    requests.push({ path: config.url!, params: config.params });
    if (fail) throw new AxiosError('Offline', 'ERR_NETWORK', config);
    if (config.url === '/dentists/me/wallet') return reply(wallet);
    if (config.url === '/dentists/me/withdrawals') {
      const params = config.params as WithdrawalQuery;
      return reply({
        items: params.status === 'paid' ? [] : [detail],
        total: params.status === 'paid' ? 0 : 21,
        nextPage: params.page === 2 || params.status === 'paid' ? null : 2,
      });
    }
    return reply(detail);
  };
});
afterEach(async () => {
  await act(async () => {
    tree?.unmount();
    state.cleanup();
  });
});

test('shows net balances, opens requests and history, paginates and filters', async () => {
  await mount();
  expect(text()).toContain('₹100');
  expect(text()).toContain('Withdrawal amount reserved');
  await press('Request withdrawal');
  expect(navigate).toHaveBeenCalledWith('RequestWithdrawal');
  await press('View withdrawal');
  expect(navigate).toHaveBeenCalledWith('Withdrawal', {
    withdrawalId: detail.id,
  });
  await press('Next page');
  expect(
    requests.filter(r => r.path === '/dentists/me/withdrawals').at(-1)!.params!
      .page,
  ).toBe(2);
  await press('Paid');
  expect(text()).toContain('No withdrawals for these filters');
  expect(requests.at(-1)!.params).toMatchObject({ page: 1, status: 'paid' });
});
test('validates amounts and reviews the approved account before posting exact paise', async () => {
  await mount('request');
  await amount('1.001');
  expect(button('Review withdrawal').props.disabled).toBe(true);
  await amount('9.99');
  expect(button('Review withdrawal').props.disabled).toBe(true);
  await amount('25.00');
  await press('Review withdrawal');
  expect(writes).toHaveLength(0);
  expect(text()).toContain('No additional platform fee');
  await press('Confirm withdrawal request');
  expect(writes[0]).toMatchObject({
    amountPaise: 2500,
    accountApprovalId: 'approved-test',
  });
  expect(writes[0].requestId).toMatch(/^[a-f0-9-]{36}$/);
  expect(navigate).toHaveBeenCalledWith('Withdrawal', {
    withdrawalId: writes[0].requestId,
  });
});
test('recovers a lost response with the same request even after its reservation reduces available balance to zero', async () => {
  loseResponse = true;
  await mount('request');
  await amount('100');
  await press('Review withdrawal');
  await press('Confirm withdrawal request');
  expect(wallet.availablePaise).toBe(0);
  expect(button('Retry same request').props.disabled).toBe(false);
  expect(button('Edit amount').props.disabled).toBe(true);
  await press('Retry same request');
  expect(writes).toHaveLength(2);
  expect(writes[1]).toEqual(writes[0]);
  expect(navigate).toHaveBeenCalledTimes(1);
});
test('disables requests without policy or approved bank details', async () => {
  wallet = {
    ...wallet,
    configured: false,
    feeBps: null,
    minimumWithdrawalPaise: null,
  };
  await mount();
  expect(button('Request withdrawal').props.disabled).toBe(true);
  expect(text()).toContain('configures the platform fee');
  await act(async () => {
    await state.store.dispatch(
      dentraApi.util.upsertQueryData('getWallet', undefined, {
        ...wallet,
        configured: true,
        feeBps: 1000,
        minimumWithdrawalPaise: 1000,
        account: null,
      }),
    );
  });
  expect(button('Request withdrawal').props.disabled).toBe(true);
  expect(button('Manage payout details')).toBeDefined();
});
test('shows decline reasons and hides saved details after a denied refresh', async () => {
  await mount('detail');
  expect(text()).toContain('Please verify your payout details');
  expect(text()).toContain('Ending 9012');
  expect(text()).not.toContain('123456789012');
  api.defaults.adapter = async config => {
    throw new AxiosError('Denied', 'ERR_BAD_REQUEST', config, undefined, {
      config,
      data: { message: 'Withdrawal unavailable' },
      status: 404,
      statusText: 'Not found',
      headers: {},
    });
  };
  await act(async () => {
    await state.store
      .dispatch(
        dentraApi.endpoints.getWithdrawal.initiate(detail.id, {
          forceRefetch: true,
        }),
      )
      .unwrap()
      .catch(() => null);
    await flush();
  });
  expect(text()).toContain('Could not load withdrawal');
  expect(text()).not.toContain('Please verify your payout details');
});
test('retries failed wallet reads and removes wallet data on account cache reset', async () => {
  fail = true;
  await mount();
  expect(text()).toContain('Could not load wallet');
  fail = false;
  await press('Try again');
  expect(text()).toContain('Available balance');
  await act(async () => {
    tree.unmount();
    state.cleanup();
  });
  expect(Object.keys(state.store.getState().dentraApi.queries)).toHaveLength(0);
  expect(withdrawalPaise('0.01')).toBe(1);
  expect(withdrawalPaise('1e3')).toBeNull();
});
