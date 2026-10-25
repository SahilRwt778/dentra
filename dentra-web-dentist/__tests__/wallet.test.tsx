import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import Renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import {
  dentraApi,
  type DentistWallet,
  type RequestWithdrawal,
  type WithdrawalDetail,
} from '../src/api/generated-api';
import authReducer from '../src/store/auth-slice';
import { WalletPage } from '../src/pages/wallet-page';
import { WithdrawalPage } from '../src/pages/withdrawal-page';

vi.mock('@/auth/refresh-token-storage', () => ({
  getRefreshToken: () => null,
  setRefreshToken: vi.fn(),
  clearRefreshToken: vi.fn(),
}));
let tree: ReactTestRenderer,
  store: ReturnType<typeof makeStore>,
  wallet: DentistWallet,
  detail: WithdrawalDetail;
let requests: URL[],
  writes: RequestWithdrawal[],
  fail: boolean,
  loseResponse: boolean,
  applied: boolean;
function makeStore() {
  return configureStore({
    enhancers: (defaults) => defaults({ autoBatch: false }),
    reducer: { auth: authReducer, [dentraApi.reducerPath]: dentraApi.reducer },
    middleware: (defaults) => defaults().concat(dentraApi.middleware),
  });
}
async function flush() {
  for (let i = 0; i < 8; i++)
    await new Promise<void>((resolve) => setImmediate(resolve));
}
function Location() {
  return <output>{useLocation().pathname}</output>;
}
async function mount(detailMode = false) {
  await act(async () => {
    tree = Renderer.create(
      <Provider store={store}>
        <MemoryRouter
          initialEntries={[
            detailMode ? '/wallet/withdrawals/test-withdrawal' : '/wallet',
          ]}
        >
          <Routes>
            <Route path="/wallet" element={<WalletPage />} />
            <Route
              path="/wallet/withdrawals/:withdrawalId"
              element={<WithdrawalPage />}
            />
          </Routes>
          <Location />
        </MemoryRouter>
      </Provider>,
    );
    await flush();
  });
}
function button(label: string) {
  return tree.root
    .findAllByType('button')
    .find((node) => node.children.join('') === label)!;
}
function text() {
  return JSON.stringify(tree.toJSON());
}
async function submit() {
  await act(async () => {
    tree.root.findByType('form').props.onSubmit({ preventDefault: vi.fn() });
    await flush();
  });
}
async function amount(value: string) {
  await act(async () =>
    tree.root.findByType('input').props.onChange({ target: { value } }),
  );
}
beforeEach(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  tree = undefined as never;
  store = makeStore();
  requests = [];
  writes = [];
  fail = false;
  loseResponse = false;
  applied = false;
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
    id: 'test-withdrawal',
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
  vi.stubGlobal(
    'fetch',
    vi.fn(async (request: Request) => {
      const url = new URL(request.url);
      requests.push(url);
      if (request.method === 'POST') {
        const body = await request.json();
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
          throw new Error('Synthetic lost response');
        }
        return Response.json(detail);
      }
      if (fail)
        return Response.json(
          { message: 'Wallet unavailable' },
          { status: 404 },
        );
      if (url.pathname === '/dentists/me/wallet') return Response.json(wallet);
      if (url.pathname === '/dentists/me/withdrawals') {
        const empty = url.searchParams.get('status') === 'paid';
        return Response.json({
          items: empty ? [] : [detail],
          total: empty ? 0 : 21,
          nextPage: empty || url.searchParams.get('page') === '2' ? null : 2,
        });
      }
      return Response.json(detail);
    }),
  );
});
afterEach(async () => {
  await act(async () => {
    tree?.unmount();
    store.dispatch(dentraApi.util.resetApiState());
  });
  vi.unstubAllGlobals();
});

test('shows balances and enforces decimal precision, minimum and available amount before review', async () => {
  await mount();
  expect(text()).toContain('Available balance');
  expect(text()).toContain('₹100');
  await amount('9.99');
  expect(button('Review withdrawal').props.disabled).toBe(true);
  await amount('1.001');
  expect(button('Review withdrawal').props.disabled).toBe(true);
  await amount('25.00');
  await submit();
  expect(writes).toHaveLength(0);
  expect(button('Confirm withdrawal request')).toBeDefined();
  await submit();
  expect(writes[0]).toMatchObject({
    amountPaise: 2500,
    accountApprovalId: 'approved-test',
  });
  expect(tree.root.findByType('output').children.join('')).toBe(
    `/wallet/withdrawals/${writes[0].requestId}`,
  );
});
test('retries an uncertain request with identical details after available balance drops to zero', async () => {
  loseResponse = true;
  await mount();
  await amount('100');
  await submit();
  await submit();
  expect(wallet.availablePaise).toBe(0);
  expect(button('Retry same request').props.disabled).toBe(false);
  await submit();
  expect(writes).toHaveLength(2);
  expect(writes[1]).toEqual(writes[0]);
});
test('paginates and filters withdrawal history, resetting to page one', async () => {
  await mount();
  await act(async () => {
    button('Next page').props.onClick();
    await flush();
  });
  expect(
    requests
      .filter((r) => r.pathname === '/dentists/me/withdrawals')
      .at(-1)!
      .searchParams.get('page'),
  ).toBe('2');
  await act(async () => {
    tree.root
      .findByType('select')
      .props.onChange({ target: { value: 'paid' } });
    await flush();
  });
  expect(text()).toContain('No withdrawals for these filters');
  expect(
    requests
      .filter((r) => r.pathname === '/dentists/me/withdrawals')
      .at(-1)!
      .searchParams.get('page'),
  ).toBe('1');
});
test('keeps withdrawal disabled while settings or an approved account are missing', async () => {
  wallet = {
    ...wallet,
    configured: false,
    feeBps: null,
    minimumWithdrawalPaise: null,
    account: null,
  };
  await mount();
  expect(button('Review withdrawal').props.disabled).toBe(true);
  expect(text()).toContain('configures the platform fee');
  expect(writes).toHaveLength(0);
});
test('shows a decline reason and hides old private details after a denied refresh', async () => {
  await mount(true);
  expect(text()).toContain('Please verify your payout details');
  expect(text()).not.toContain('123456789012');
  fail = true;
  await act(async () => {
    store.dispatch(dentraApi.util.invalidateTags(['Wallet']));
    await flush();
  });
  expect(text()).toContain('Wallet unavailable');
  expect(text()).not.toContain('Please verify your payout details');
});
