import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { MemoryRouter, useLocation } from 'react-router-dom';
import Renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import {
  dentraApi,
  type WithdrawalDetail,
  type WalletSettings,
} from '../src/api/generated-api';
import authReducer from '../src/store/auth-slice';
import { WalletSettingsCard } from '../src/components/wallet-settings-card';
import { WithdrawalActions } from '../src/components/payouts/withdrawal-actions';
import { WithdrawalsPage } from '../src/pages/withdrawals-page';
import { NotificationBell } from '../src/components/notification-bell';

vi.mock('@/auth/session-refresh', () => ({ refreshSession: vi.fn() }));
vi.mock('@/auth/refresh-token-storage', () => ({
  getRefreshToken: () => null,
  setRefreshToken: vi.fn(),
  clearRefreshToken: vi.fn(),
}));
let tree: ReactTestRenderer,
  store: ReturnType<typeof makeStore>,
  settings: WalletSettings,
  withdrawal: WithdrawalDetail;
let requests: URL[],
  writes: Record<string, unknown>[],
  loseResponse: boolean,
  conflict: boolean;
const refresh = vi.fn();
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
async function mount(
  mode: 'settings' | 'actions' | 'queue' | 'notifications' = 'settings',
) {
  await act(async () => {
    tree = Renderer.create(
      <Provider store={store}>
        <MemoryRouter>
          {mode === 'settings' ? (
            <WalletSettingsCard />
          ) : mode === 'actions' ? (
            <WithdrawalActions withdrawal={withdrawal} refresh={refresh} />
          ) : mode === 'queue' ? (
            <WithdrawalsPage />
          ) : (
            <NotificationBell />
          )}
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
    .find(
      (node) =>
        node.children.join('') === label || node.props['aria-label'] === label,
    )!;
}
async function click(label: string) {
  await act(async () => {
    button(label).props.onClick();
    await flush();
  });
}
async function submit() {
  await act(async () => {
    tree.root.findByType('form').props.onSubmit({ preventDefault: vi.fn() });
    await flush();
  });
}
async function check(index = 0) {
  await act(async () =>
    tree.root
      .findAllByType('input')
      .filter((node) => node.props.type === 'checkbox')
      [index].props.onChange({ target: { checked: true } }),
  );
}
function text() {
  return JSON.stringify(tree.toJSON());
}
beforeEach(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  tree = undefined as never;
  store = makeStore();
  requests = [];
  writes = [];
  loseResponse = false;
  conflict = false;
  refresh.mockClear();
  settings = {
    feeBps: null,
    minimumWithdrawalPaise: null,
    version: 1,
    unpricedBookings: 2,
  };
  withdrawal = {
    id: 'withdrawal-test',
    dentistId: 'dentist-test',
    dentistName: 'Synthetic Dentist',
    amountPaise: 2500,
    minimumPaise: 1000,
    status: 'requested',
    version: 1,
    accountLast4: '9012',
    bankIfsc: 'TEST0001234',
    bankReference: null,
    paidOn: null,
    createdAt: '2026-10-24T10:00:00Z',
    updatedAt: '2026-10-24T10:00:00Z',
    approvalId: 'approved-test',
    accountChanged: false,
    account: {
      holder: 'Test Holder',
      accountNo: '123456789012',
      ifsc: 'TEST0001234',
    },
    events: [],
    wallet: {
      availablePaise: 7500,
      reservedPaise: 2500,
      withdrawnPaise: 0,
      shortfallPaise: 0,
      pendingPaise: 0,
      eligibleGrossPaise: 11111,
      eligibleFeePaise: 1111,
      unpricedCount: 0,
      unpricedGrossPaise: 0,
    },
  };
  vi.stubGlobal(
    'fetch',
    vi.fn(async (request: Request) => {
      const url = new URL(request.url);
      requests.push(url);
      if (
        url.pathname.startsWith('/notifications/') &&
        request.method === 'PATCH'
      )
        return Response.json({
          id: 'notice-test',
          type: 'wallet_withdrawal_requested',
          withdrawalId: withdrawal.id,
          dentistId: withdrawal.dentistId,
          dentistName: withdrawal.dentistName,
          amountPaise: 2500,
          readAt: '2026-10-24T10:01:00Z',
          createdAt: '2026-10-24T10:00:00Z',
        });
      if (request.method === 'POST' || request.method === 'PATCH') {
        const body = await request.json();
        writes.push(body);
        if (conflict)
          return Response.json(
            { message: 'These details changed. Reopen the form.' },
            { status: 409 },
          );
        if (loseResponse) {
          loseResponse = false;
          throw new Error('Synthetic lost response');
        }
        if (url.pathname === '/admin/wallet-settings') {
          settings = {
            ...settings,
            feeBps: body.feeBps,
            minimumWithdrawalPaise: body.minimumWithdrawalPaise,
            version: 2,
          };
          return Response.json(settings);
        }
        return Response.json(withdrawal);
      }
      if (url.pathname === '/admin/wallet-settings')
        return Response.json(settings);
      if (url.pathname === '/notifications')
        return Response.json({
          items: [
            {
              id: 'notice-test',
              type: 'wallet_withdrawal_requested',
              withdrawalId: withdrawal.id,
              dentistId: withdrawal.dentistId,
              dentistName: withdrawal.dentistName,
              amountPaise: 2500,
              readAt: null,
              createdAt: '2026-10-24T10:00:00Z',
            },
          ],
          unreadCount: 1,
          nextCursor: null,
        });
      return Response.json({
        items: [withdrawal],
        total: 21,
        nextPage: url.searchParams.get('page') === '2' ? null : 2,
      });
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

test('leaves fee and minimum unset until entered and sends exact global values with an explicit historical-fee choice', async () => {
  await mount();
  expect(text()).toContain('Not configured');
  await click('Edit wallet settings');
  await submit();
  expect(writes).toHaveLength(0);
  expect(text()).toContain('positive minimum');
  await act(async () =>
    tree.root
      .findAllByType('input')[0]
      .props.onChange({ target: { value: '12.50' } }),
  );
  await act(async () =>
    tree.root
      .findAllByType('input')[1]
      .props.onChange({ target: { value: '500.25' } }),
  );
  await check();
  await submit();
  expect(writes[0]).toEqual({
    version: 1,
    feeBps: 1250,
    minimumWithdrawalPaise: 50025,
    applyToUnpriced: true,
  });
  expect(text()).toContain('Wallet settings saved');
});
test('keeps the original settings version while editing after a conflict', async () => {
  settings = { ...settings, feeBps: 1000, minimumWithdrawalPaise: 1000 };
  await mount();
  await click('Edit wallet settings');
  conflict = true;
  settings = { ...settings, version: 2 };
  await submit();
  expect(text()).toContain('details changed');
  await submit();
  expect(writes.map((write) => write.version)).toEqual([1, 1]);
});
test('requires approval confirmation and retries an uncertain decision using the same request', async () => {
  await mount('actions');
  await submit();
  expect(writes).toHaveLength(0);
  loseResponse = true;
  await check();
  await submit();
  expect(button('Retry same request')).toBeDefined();
  await submit();
  expect(writes).toHaveLength(2);
  expect(writes[1]).toEqual(writes[0]);
  expect(writes[0]).toMatchObject({ version: 1, action: 'approved' });
  expect(writes[0]).not.toHaveProperty('feeBps');
});
test('requires a decline reason and allows declining an account that changed', async () => {
  withdrawal = { ...withdrawal, accountChanged: true };
  await mount('actions');
  expect(button('Save decision').props.disabled).toBe(true);
  await act(async () =>
    tree.root
      .findByType('select')
      .props.onChange({ target: { value: 'rejected' } }),
  );
  await check();
  await submit();
  expect(writes).toHaveLength(0);
  await act(async () =>
    tree.root
      .findByType('textarea')
      .props.onChange({ target: { value: 'Update your bank details' } }),
  );
  await submit();
  expect(writes[0]).toMatchObject({
    action: 'rejected',
    note: 'Update your bank details',
  });
});
test('requires bank evidence and adjustment acknowledgement when recording a paid transfer', async () => {
  withdrawal = {
    ...withdrawal,
    status: 'processing',
    version: 3,
    wallet: { ...withdrawal.wallet, shortfallPaise: 1000 },
  };
  await mount('actions');
  await check(1);
  await submit();
  expect(writes).toHaveLength(0);
  await act(async () =>
    tree.root
      .findAllByType('input')
      .find((node) => node.props.maxLength === 100)!
      .props.onChange({ target: { value: ' utr-wallet ' } }),
  );
  await check();
  await submit();
  expect(writes[0]).toMatchObject({
    action: 'paid',
    version: 3,
    reference: 'UTR-WALLET',
    acknowledgeChanges: true,
  });
});
test('paginates the request queue, applies filters and keeps full bank details out of the table', async () => {
  await mount('queue');
  expect(text()).not.toContain('123456789012');
  await click('Next page');
  expect(requests.at(-1)!.searchParams.get('page')).toBe('2');
  await act(async () => {
    tree.root
      .findAllByType('select')[0]
      .props.onChange({ target: { value: 'paid' } });
    await flush();
  });
  expect(requests.at(-1)!.searchParams.get('page')).toBe('1');
  expect(requests.at(-1)!.searchParams.get('status')).toBe('paid');
});
test('opens withdrawal requests from the admin notification bell', async () => {
  vi.stubGlobal('document', {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
  await mount('notifications');
  const trigger = tree.root
    .findAllByType('button')
    .find((node) =>
      String(node.props['aria-label']).startsWith('Notifications'),
    )!;
  await act(async () => {
    trigger.props.onClick();
    await flush();
  });
  expect(text()).toContain('Wallet withdrawal request');
  await act(async () => {
    tree.root
      .findAllByType('button')
      .find((node) => node.props.className === 'notification-item')!
      .props.onClick();
    await flush();
  });
  expect(tree.root.findByType('output').children.join('')).toBe(
    '/withdrawals/withdrawal-test',
  );
});
