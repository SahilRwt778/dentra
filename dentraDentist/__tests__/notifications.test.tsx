import { createStoreHarness } from '../test-utils/store';
import React from 'react';
import { AppState, Text } from 'react-native';
import ReactTestRenderer, {
  act,
  type ReactTestRenderer as Renderer,
} from 'react-test-renderer';
import { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { api } from '../src/api/client';
import { session } from '../src/features/auth/session';
import {
  NotificationsProvider,
  useNotifications,
} from '../src/features/notifications/NotificationsProvider';
import { NotificationBell } from '../src/features/notifications/NotificationBell';
import { NotificationsScreen } from '../src/features/notifications/NotificationsScreen';
import { DayAppointments } from '../src/features/appointments/DayAppointments';
import { TodayQueue } from '../src/features/today/TodayQueue';
import { NotificationBanner } from '../src/features/notifications/NotificationBanner';
import { dentraApi } from '../src/store/dentraApi';
import { Button } from '../src/components/ui/Button';
import type {
  BookingNotification,
  DentistNotification,
  WalletWithdrawalNotification,
} from '../src/common/types/api';

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => true,
  useNavigation: () => ({ navigate: mockNavigate }),
}));
const originalState = AppState.currentState;
const originalDescriptor = Object.getOwnPropertyDescriptor(
  AppState,
  'currentState',
);
const first: BookingNotification = {
  id: 'notice-one',
  type: 'appointment_booked',
  appointmentId: 'visit-one',
  patientName: 'Patient One',
  date: '2026-10-18',
  time: '10:00',
  appointmentType: 'video',
  createdAt: '2026-10-18T08:00:00Z',
  readAt: null,
};
const second = {
  ...first,
  id: 'notice-two',
  appointmentId: 'visit-two',
  patientName: 'Patient Two',
  createdAt: '2026-10-18T09:00:00Z',
};
let latest: DentistNotification[];
let older: DentistNotification[];
let nextCursor: string | null;
let calls: InternalAxiosRequestConfig[];
let renderer: Renderer;
let state: ReturnType<typeof createStoreHarness>;
let inbox: ReturnType<typeof useNotifications>;
function Probe() {
  inbox = useNotifications();
  return null;
}
function text() {
  return renderer.root
    .findAllByType(Text)
    .map(node => node.props.children)
    .flat()
    .join(' ');
}
async function flush() {
  for (let n = 0; n < 5; n++)
    await new Promise<void>(resolve => setImmediate(resolve));
}
function reply(config: InternalAxiosRequestConfig, data: unknown) {
  return { config, data, status: 200, statusText: 'OK', headers: {} };
}
async function mount(children: React.ReactNode = <NotificationBell />) {
  await act(async () => {
    renderer = ReactTestRenderer.create(
      state.wrap(
        <NotificationsProvider>
          <Probe />
          {children}
        </NotificationsProvider>,
      ),
    );
    await flush();
  });
}
function screen() {
  return (
    <NotificationsScreen
      navigation={{ navigate: mockNavigate } as never}
      route={{ key: 'notifications', name: 'Notifications' }}
    />
  );
}
async function press(title: string) {
  await act(async () => {
    renderer.root
      .findAllByType(Button)
      .find(node => node.props.title === title)!
      .props.onPress();
    await flush();
  });
}
beforeEach(async () => {
  state = createStoreHarness();
  Object.defineProperty(AppState, 'currentState', {
    configurable: true,
    writable: true,
    value: 'active',
  });
  await session.signIn({
    accessToken: 'access',
    refreshToken: 'refresh',
    expiresInSeconds: 900,
  });
  jest.clearAllMocks();
  latest = [{ ...first }];
  older = [];
  nextCursor = null;
  calls = [];
  api.defaults.adapter = async config => {
    calls.push(config);
    if (config.url === '/appointments')
      return reply(config, { items: [], nextPage: null });
    if (config.url === '/notifications')
      return reply(config, {
        items: config.params?.cursor ? older : latest,
        nextCursor: config.params?.cursor ? null : nextCursor,
        unreadCount: [...latest, ...older].filter(item => !item.readAt).length,
      });
    if (config.url?.endsWith('/read')) {
      const id = config.url.split('/')[2];
      latest = latest.map(item =>
        item.id === id ? { ...item, readAt: '2026-10-18T10:00:00Z' } : item,
      );
      older = older.map(item =>
        item.id === id ? { ...item, readAt: '2026-10-18T10:00:00Z' } : item,
      );
      return reply(
        config,
        [...latest, ...older].find(item => item.id === id),
      );
    }
    return reply(config, {});
  };
});
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
  state.cleanup();
  await session.clear();
  jest.useRealTimers();
  if (originalDescriptor)
    Object.defineProperty(AppState, 'currentState', originalDescriptor);
  else
    Object.defineProperty(AppState, 'currentState', { value: originalState });
});

test('the bell displays backend unread count and opens the notification inbox', async () => {
  await mount();
  const bell = renderer.root
    .findAll(node => typeof node.props.onPress === 'function')
    .find(node => node.props.accessibilityLabel === 'Notifications, 1 unread')!;
  await act(async () => bell.props.onPress());
  expect(mockNavigate).toHaveBeenCalledWith('Notifications');
  expect(inbox.notice).toBeNull();
});

test('new bookings produce one banner and refresh the Today summary and queue', async () => {
  await mount(
    <TodayQueue date="2026-10-18" dentistName="Synthetic Dentist" hour={9} />,
  );
  const before = calls.filter(call => call.url === '/appointments').length;
  expect(inbox.bookingVersion).toBe(0);
  latest = [second, ...latest];
  await act(async () => {
    await inbox.reload();
    await flush();
  });
  expect(inbox.notice?.id).toBe(second.id);
  expect(inbox.bookingVersion).toBe(1);
  expect(calls.filter(call => call.url === '/appointments').length).toBe(
    before + 1,
  );
  await act(async () => {
    await inbox.reload();
    await flush();
  });
  expect(inbox.bookingVersion).toBe(1);
});

test('opening a notification marks it read and navigates using its appointment id', async () => {
  await mount(screen());
  const row = renderer.root
    .findAll(node => typeof node.props.onPress === 'function')
    .find(node =>
      node.props.accessibilityLabel?.startsWith('Unread. Patient One'),
    )!;
  await act(async () => {
    row.props.onPress();
    await flush();
  });
  expect(mockNavigate).toHaveBeenCalledWith('Appointment', {
    appointmentId: 'visit-one',
  });
  expect(
    calls.some(
      call =>
        call.url === '/notifications/notice-one/read' &&
        call.method === 'patch',
    ),
  ).toBe(true);
  expect(inbox.data?.unreadCount).toBe(0);
});

test('the appointment still opens if marking the notification read fails', async () => {
  const normal = api.defaults.adapter as (
    config: InternalAxiosRequestConfig,
  ) => Promise<ReturnType<typeof reply>>;
  api.defaults.adapter = async config => {
    if (config.url?.endsWith('/read'))
      throw new AxiosError('Offline', 'ERR_NETWORK');
    return normal(config);
  };
  await mount(screen());
  await act(async () => {
    renderer.root
      .findAll(node => typeof node.props.onPress === 'function')
      .find(node =>
        node.props.accessibilityLabel?.startsWith('Unread. Patient One'),
      )!
      .props.onPress();
    await flush();
  });
  expect(mockNavigate).toHaveBeenCalledWith('Appointment', {
    appointmentId: 'visit-one',
  });
  expect(text()).toContain('Could not mark the notification read.');
  expect(inbox.data?.unreadCount).toBe(1);
});

const withdrawal: WalletWithdrawalNotification = {
  id: 'wallet-notice',
  type: 'wallet_withdrawal_updated',
  withdrawalId: 'withdrawal-one',
  amountPaise: 2500,
  status: 'rejected',
  reason: 'Please confirm your bank details',
  createdAt: '2026-10-24T10:00:00Z',
  readAt: null,
};

test.each([
  ['approved', 'Withdrawal approved'],
  ['rejected', 'Withdrawal declined'],
  ['paid', 'Withdrawal paid'],
] as const)(
  'renders a %s withdrawal update and opens its request even if marking read fails',
  async (status, title) => {
    latest = [
      {
        ...withdrawal,
        status,
        reason: status === 'rejected' ? withdrawal.reason : null,
      },
    ];
    const normal = api.defaults.adapter as (
      config: InternalAxiosRequestConfig,
    ) => Promise<ReturnType<typeof reply>>;
    api.defaults.adapter = async config => {
      if (config.url?.endsWith('/read'))
        throw new AxiosError('Offline', 'ERR_NETWORK');
      return normal(config);
    };
    await mount(screen());
    expect(text()).toContain(title);
    expect(text()).toContain('₹25');
    if (status === 'rejected') expect(text()).toContain(withdrawal.reason);
    await act(async () => {
      renderer.root
        .findAll(node => typeof node.props.onPress === 'function')
        .find(node =>
          node.props.accessibilityLabel?.startsWith(`Unread. ${title}`),
        )!
        .props.onPress();
      await flush();
    });
    expect(mockNavigate).toHaveBeenCalledWith('Withdrawal', {
      withdrawalId: withdrawal.withdrawalId,
    });
    expect(text()).toContain('Could not mark the notification read.');
  },
);

test('new withdrawal updates refresh wallet queries once without refreshing appointment queues', async () => {
  const walletQuery = state.store.dispatch(
    dentraApi.endpoints.getWallet.initiate(),
  );
  const historyQuery = state.store.dispatch(
    dentraApi.endpoints.getWithdrawals.initiate({ page: 1, limit: 20 }),
  );
  const detailQuery = state.store.dispatch(
    dentraApi.endpoints.getWithdrawal.initiate(withdrawal.withdrawalId),
  );
  await Promise.all([walletQuery, historyQuery, detailQuery]);
  const walletPaths = [
    '/dentists/me/wallet',
    '/dentists/me/withdrawals',
    `/dentists/me/withdrawals/${withdrawal.withdrawalId}`,
  ];
  try {
    await mount(
      <>
        <DayAppointments date="2026-10-18" />
        <NotificationBanner onOpen={mockNavigate} />
      </>,
    );
    const before = walletPaths.map(
      path => calls.filter(call => call.url === path).length,
    );
    const appointmentReads = calls.filter(
      call => call.url === '/appointments',
    ).length;
    latest = [withdrawal, ...latest];
    await act(async () => {
      await inbox.reload();
      await flush();
    });
    expect(text()).toContain('Withdrawal declined');
    expect(text()).toContain(withdrawal.reason);
    expect(inbox.bookingVersion).toBe(0);
    walletPaths.forEach((path, i) =>
      expect(calls.filter(call => call.url === path)).toHaveLength(
        before[i] + 1,
      ),
    );
    expect(calls.filter(call => call.url === '/appointments')).toHaveLength(
      appointmentReads,
    );
    await act(async () => {
      await inbox.reload();
      await flush();
    });
    walletPaths.forEach((path, i) =>
      expect(calls.filter(call => call.url === path)).toHaveLength(
        before[i] + 1,
      ),
    );
    await act(async () => {
      inbox.dismissNotice();
      await flush();
    });
    expect(inbox.notice).toBeNull();
  } finally {
    walletQuery.unsubscribe();
    historyQuery.unsubscribe();
    detailQuery.unsubscribe();
  }
});

test('notification pagination uses backend cursors and can return to the latest page', async () => {
  nextCursor = first.id;
  older = [{ ...first, id: 'older-notice', patientName: 'Older Patient' }];
  await mount(screen());
  await press('Older');
  expect(calls.at(-1)?.params).toEqual({ cursor: first.id });
  expect(text()).toContain('Older Patient');
  await press('Newer');
  expect(text()).toContain('Patient One');
  expect(text()).not.toContain('Older Patient');
});

test('mark all uses the displayed snapshot and leaves a later booking unread', async () => {
  const normal = api.defaults.adapter as (
    config: InternalAxiosRequestConfig,
  ) => Promise<ReturnType<typeof reply>>;
  api.defaults.adapter = async config => {
    if (config.url === '/notifications/read-all') {
      calls.push(config);
      expect(JSON.parse(config.data)).toEqual({ through: first.id });
      latest = [{ ...second }, { ...first, readAt: '2026-10-18T10:00:00Z' }];
      return reply(config, { markedRead: 1 });
    }
    return normal(config);
  };
  await mount(screen());
  await press('Mark all as read');
  expect(inbox.data?.unreadCount).toBe(1);
  expect(
    inbox.data?.items.find(item => item.id === second.id)?.readAt,
  ).toBeNull();
});

test('notification polling pauses in the background and resumes when foregrounded', async () => {
  jest.useFakeTimers({ doNotFake: ['setImmediate'] });
  await mount();
  const initial = calls.length;
  Object.defineProperty(AppState, 'currentState', {
    configurable: true,
    writable: true,
    value: 'background',
  });
  await act(async () => {
    await jest.advanceTimersByTimeAsync(30000);
    await flush();
  });
  expect(calls).toHaveLength(initial);
  Object.defineProperty(AppState, 'currentState', {
    configurable: true,
    writable: true,
    value: 'active',
  });
  await act(async () => {
    await jest.advanceTimersByTimeAsync(10000);
    await flush();
  });
  expect(calls.length).toBeGreaterThan(initial);
});

test('leaving an older inbox page during mark-all does not restart its request after unmount', async () => {
  nextCursor = first.id;
  older = [{ ...first, id: 'older-notice' }];
  const normal = api.defaults.adapter as (
    config: InternalAxiosRequestConfig,
  ) => Promise<ReturnType<typeof reply>>;
  let finish!: () => void;
  const wait = new Promise<void>(resolve => {
    finish = resolve;
  });
  api.defaults.adapter = async config => {
    if (config.url === '/notifications/read-all') {
      await wait;
      return reply(config, { markedRead: 2 });
    }
    return normal(config);
  };
  await mount(screen());
  await press('Older');
  const olderRequests = calls.filter(
    call => call.url === '/notifications' && call.params?.cursor,
  ).length;
  await act(async () => {
    renderer.root
      .findAllByType(Button)
      .find(node => node.props.title === 'Mark all as read')!
      .props.onPress();
    await flush();
  });
  await act(async () => {
    renderer.update(
      state.wrap(
        <NotificationsProvider>
          <Probe />
          <NotificationBell />
        </NotificationsProvider>,
      ),
    );
    await flush();
  });
  await act(async () => {
    finish();
    await flush();
  });
  expect(
    calls.filter(call => call.url === '/notifications' && call.params?.cursor),
  ).toHaveLength(olderRequests);
});
