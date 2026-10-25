import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { MemoryRouter, useLocation } from 'react-router-dom';
import Renderer, {
  act,
  type ReactTestRenderer,
  type ReactTestInstance,
} from 'react-test-renderer';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { toast } from 'sonner';
import {
  dentraApi,
  type Notification,
  type WalletWithdrawalNotification,
} from '../src/api/generated-api';
import authReducer from '../src/store/auth-slice';
import { NotificationBell } from '../src/components/notification-bell';

vi.mock('@/auth/refresh-token-storage', () => ({
  getRefreshToken: () => null,
  setRefreshToken: vi.fn(),
  clearRefreshToken: vi.fn(),
}));
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn() }),
}));

let tree: ReactTestRenderer, store: ReturnType<typeof makeStore>;
let latest: Notification[],
  older: Notification[],
  nextCursor: string | null,
  failRead: boolean;
let requests: { path: string; method: string; body?: unknown }[];
const withdrawal: WalletWithdrawalNotification = {
  id: 'wallet-notice',
  type: 'wallet_withdrawal_updated',
  withdrawalId: 'withdrawal-one',
  amountPaise: 2500,
  status: 'rejected',
  reason: 'Please confirm the account holder',
  createdAt: '2026-10-24T10:00:00Z',
  readAt: null,
};
function makeStore() {
  return configureStore({
    enhancers: (defaults) => defaults({ autoBatch: false }),
    reducer: { auth: authReducer, [dentraApi.reducerPath]: dentraApi.reducer },
    middleware: (defaults) => defaults().concat(dentraApi.middleware),
  });
}
function Location() {
  return <output>{useLocation().pathname}</output>;
}
async function flush() {
  for (let i = 0; i < 8; i++)
    await new Promise<void>((resolve) => setImmediate(resolve));
}
async function mount() {
  await act(async () => {
    tree = Renderer.create(
      <Provider store={store}>
        <MemoryRouter>
          <NotificationBell />
          <Location />
        </MemoryRouter>
      </Provider>,
    );
    await flush();
  });
}
function text() {
  return JSON.stringify(tree.toJSON());
}
function nodeText(node: ReactTestInstance): string {
  return node.children
    .map((child) => (typeof child === 'string' ? child : nodeText(child)))
    .join('');
}
async function click(label: string) {
  await act(async () => {
    tree.root
      .findAllByType('button')
      .find(
        (node) =>
          node.props['aria-label']?.startsWith(label) ||
          nodeText(node).includes(label),
      )!
      .props.onClick();
    await flush();
  });
}
async function reload() {
  await act(async () => {
    await store.dispatch(
      dentraApi.endpoints.getNotifications.initiate(
        {},
        { forceRefetch: true, subscribe: false },
      ),
    );
    await flush();
  });
}
beforeEach(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  tree = undefined as never;
  store = makeStore();
  latest = [];
  older = [];
  nextCursor = null;
  failRead = false;
  requests = [];
  vi.clearAllMocks();
  vi.stubGlobal('document', {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
  vi.stubGlobal(
    'fetch',
    vi.fn(async (request: Request) => {
      const url = new URL(request.url);
      const rawBody = request.method !== 'GET' ? await request.text() : '';
      const body = rawBody ? JSON.parse(rawBody) : undefined;
      requests.push({ path: url.pathname, method: request.method, body });
      if (url.pathname === '/notifications')
        return Response.json({
          items: url.searchParams.has('cursor') ? older : latest,
          nextCursor: url.searchParams.has('cursor') ? null : nextCursor,
          unreadCount: [...latest, ...older].filter((item) => !item.readAt)
            .length,
        });
      if (url.pathname.endsWith('/read')) {
        if (failRead)
          return Response.json(
            { message: 'Synthetic failure' },
            { status: 500 },
          );
        const id = url.pathname.split('/')[2];
        latest = latest.map((item) =>
          item.id === id ? { ...item, readAt: '2026-10-24T10:05:00Z' } : item,
        );
        older = older.map((item) =>
          item.id === id ? { ...item, readAt: '2026-10-24T10:05:00Z' } : item,
        );
        return Response.json(
          [...latest, ...older].find((item) => item.id === id),
        );
      }
      if (url.pathname === '/notifications/read-all') {
        latest = latest.map((item) => ({
          ...item,
          readAt: '2026-10-24T10:05:00Z',
        }));
        older = older.map((item) => ({
          ...item,
          readAt: '2026-10-24T10:05:00Z',
        }));
        return Response.json({ markedRead: 2 });
      }
      return Response.json({});
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

test.each([
  ['approved', 'Withdrawal approved'],
  ['rejected', 'Withdrawal declined'],
  ['paid', 'Withdrawal paid'],
] as const)(
  'shows a %s withdrawal alongside bookings and opens its request',
  async (status, title) => {
    latest = [
      {
        ...withdrawal,
        status,
        reason: status === 'rejected' ? withdrawal.reason : null,
      },
      {
        id: 'booking',
        type: 'appointment_booked',
        appointmentId: 'appointment-one',
        patientName: 'Synthetic Patient',
        date: '2026-10-24',
        time: '10:00',
        appointmentType: 'video',
        createdAt: '2026-10-24T09:00:00Z',
        readAt: null,
      },
    ];
    await mount();
    await click('Notifications,');
    expect(text()).toContain(title);
    expect(text()).toContain('New appointment');
    if (status === 'rejected') expect(text()).toContain(withdrawal.reason);
    await click(title);
    expect(tree.root.findByType('output').children.join('')).toBe(
      '/wallet/withdrawals/withdrawal-one',
    );
    expect(
      requests.some((r) => r.path === '/notifications/wallet-notice/read'),
    ).toBe(true);
  },
);

test('fresh withdrawal events refresh active wallet queries once, including events read on another device', async () => {
  const subscriptions = [
    store.dispatch(dentraApi.endpoints.getDentistWallet.initiate()),
    store.dispatch(
      dentraApi.endpoints.listDentistWithdrawals.initiate({
        page: 1,
        limit: 20,
      }),
    ),
    store.dispatch(
      dentraApi.endpoints.getDentistWithdrawal.initiate({
        withdrawalId: 'withdrawal-one',
      }),
    ),
  ];
  await Promise.all(subscriptions);
  const paths = [
    '/dentists/me/wallet',
    '/dentists/me/withdrawals',
    '/dentists/me/withdrawals/withdrawal-one',
  ];
  try {
    await mount();
    const before = paths.map(
      (path) => requests.filter((r) => r.path === path).length,
    );
    latest = [{ ...withdrawal, readAt: '2026-10-24T10:01:00Z' }];
    await reload();
    paths.forEach((path, i) =>
      expect(requests.filter((r) => r.path === path)).toHaveLength(
        before[i] + 1,
      ),
    );
    expect(toast).not.toHaveBeenCalled();
    await reload();
    paths.forEach((path, i) =>
      expect(requests.filter((r) => r.path === path)).toHaveLength(
        before[i] + 1,
      ),
    );
  } finally {
    subscriptions.forEach((query) => query.unsubscribe());
  }
});

test('a fresh update offers a toast link and opens the request when marking read fails', async () => {
  await mount();
  latest = [withdrawal];
  failRead = true;
  await reload();
  expect(toast).toHaveBeenCalledWith(
    'Withdrawal declined',
    expect.objectContaining({
      description: expect.stringContaining(withdrawal.reason!),
    }),
  );
  const options = vi.mocked(toast).mock.calls[0][1]!;
  await act(async () => {
    (options.action as { onClick: () => void }).onClick();
    await flush();
  });
  expect(tree.root.findByType('output').children.join('')).toBe(
    '/wallet/withdrawals/withdrawal-one',
  );
  expect(toast.error).toHaveBeenCalledWith(
    expect.stringContaining('could not be marked read'),
  );
});

test('older withdrawal notifications remain readable and mark-all uses the latest snapshot', async () => {
  latest = [withdrawal];
  older = [
    {
      ...withdrawal,
      id: 'older-wallet',
      createdAt: '2026-10-23T10:00:00Z',
      status: 'approved',
      reason: null,
    },
  ];
  nextCursor = withdrawal.id;
  await mount();
  await click('Notifications,');
  await click('Load older');
  expect(text()).toContain('Withdrawal approved');
  await click('Mark all as read');
  expect(
    requests.find((r) => r.path === '/notifications/read-all')?.body,
  ).toEqual({ through: withdrawal.id });
  expect(text()).not.toContain('notification-unread');
});
