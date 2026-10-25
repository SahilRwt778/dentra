import React from 'react';
import { Alert, Text } from 'react-native';
import Renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { api } from '../src/api/client';
import { session } from '../src/features/auth/session';
import { createStoreHarness } from '../test-utils/store';
import { testPatientRecord } from '../test-utils/patient';
import type { Appointment } from '../src/common/types/api';
import { AppointmentScreen } from '../src/features/appointments/AppointmentScreen';
import { Button } from '../src/components/ui/Button';
import { dentraApi } from '../src/store/dentraApi';

jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => true,
  usePreventRemove: jest.fn(),
  useNavigation: () => ({ navigate: jest.fn() }),
}));
jest.mock('../src/features/attachments/AppointmentAttachments', () => ({
  AppointmentAttachments: () => null,
}));
jest.mock('../src/features/consultation/ConsultationAction', () => ({
  ConsultationAction: () => null,
}));
jest.mock('../src/features/video/AppointmentVideoCard', () => ({
  AppointmentVideoCard: () => null,
}));

let tree: ReactTestRenderer;
let state: ReturnType<typeof createStoreHarness>;
let appointment: Appointment;
let writes: { path: string; body: Record<string, unknown> }[];
let mode: 'offline' | 'lost-response' | 'other-device' | null;
let hold: Promise<void> | undefined;
function reply(config: InternalAxiosRequestConfig, data: unknown) {
  return { config, data, status: 200, statusText: 'OK', headers: {} };
}
async function flush() {
  for (let i = 0; i < 8; i++)
    await new Promise<void>(resolve => setImmediate(resolve));
}
async function mount() {
  await act(async () => {
    tree = Renderer.create(
      state.wrap(
        <AppointmentScreen
          navigation={{} as never}
          route={{
            key: 'clinic-payment',
            name: 'Appointment',
            params: { appointmentId: appointment.id },
          }}
        />,
      ),
    );
    await flush();
  });
}
const button = (title: string) =>
  tree.root.findAllByType(Button).find(node => node.props.title === title);
async function press(title: string) {
  await act(async () => {
    await button(title)!.props.onPress();
    await flush();
  });
}
async function confirm() {
  await act(async () => {
    await jest
      .mocked(Alert.alert)
      .mock.calls.at(-1)![2]!
      .find(item => item.text === 'Confirm received')!.onPress!();
    await flush();
  });
}
function text() {
  return tree.root
    .findAllByType(Text)
    .map(node => node.props.children)
    .flat(Infinity)
    .filter(value => typeof value === 'string')
    .join(' ');
}
beforeEach(async () => {
  state = createStoreHarness();
  tree = undefined as never;
  writes = [];
  mode = null;
  hold = undefined;
  jest.spyOn(Alert, 'alert');
  appointment = {
    id: 'clinic-payment-test',
    patientId: 'patient-test',
    patientName: 'Synthetic Patient',
    patientAge: 30,
    patientGender: 'female',
    type: 'clinic',
    status: 'booked',
    date: '2027-07-22',
    time: '10:00',
    concern: 'Synthetic concern',
    painScore: 0,
    swelling: false,
    payment: {
      method: 'pay_at_clinic',
      amountPaise: 50029,
      status: 'due_at_clinic',
      collection: null,
    },
  };
  await session.signIn({
    accessToken: 'synthetic-collection-access',
    refreshToken: 'synthetic-collection-refresh',
    expiresInSeconds: 900,
  });
  api.defaults.adapter = async config => {
    if (config.method === 'get') {
      if (config.url?.startsWith('/dentists/me/patients/'))
        return reply(config, testPatientRecord());
      if (config.url === '/appointments')
        return reply(config, { items: [appointment], nextPage: null });
      return reply(config, { ...appointment });
    }
    const body = JSON.parse(config.data || '{}');
    writes.push({ path: config.url!, body });
    if (hold) await hold;
    if (mode === 'offline')
      throw new AxiosError('Offline', 'ERR_NETWORK', config);
    appointment = {
      ...appointment,
      payment: {
        ...appointment.payment!,
        status: 'paid',
        collection: {
          id: mode === 'other-device' ? 'another-receipt' : body.requestId,
          method: mode === 'other-device' ? 'card' : body.method,
          amountPaise: 50029,
          collectedAt: '2026-10-24T10:00:00Z',
        },
      },
    };
    if (mode === 'other-device')
      throw new AxiosError(
        'Already recorded',
        'ERR_BAD_REQUEST',
        config,
        undefined,
        {
          ...reply(config, { message: 'Payment was already recorded.' }),
          status: 409,
        },
      );
    if (mode === 'lost-response')
      throw new AxiosError('Timed out', 'ECONNABORTED', config);
    return reply(config, { ...appointment });
  };
});
afterEach(async () => {
  await act(async () => {
    tree?.unmount();
    state.cleanup();
  });
  jest.restoreAllMocks();
});

test.each(['Cash', 'UPI', 'Card'])(
  'confirms the full fee received by %s, writes one receipt and refreshes appointment cache',
  async method => {
    const cache = state.store.dispatch(
      dentraApi.endpoints.getDayAppointments.initiate({
        date: appointment.date,
        page: 1,
      }),
    );
    await cache;
    await mount();
    expect(button('Mark as paid')!.props.disabled).toBe(true);
    await press(method);
    await press('Mark as paid');
    expect(writes).toEqual([]);
    const alert = jest.mocked(Alert.alert).mock.calls.at(-1)!;
    expect(alert[1]).toContain('₹500.29');
    expect(alert[1]).toContain(method);
    await confirm();
    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatchObject({
      path: `/appointments/${appointment.id}/clinic-payment`,
      body: { amountPaise: 50029, method: method.toLowerCase() },
    });
    expect(writes[0].body.requestId).toMatch(/^[a-f0-9-]{36}$/);
    expect(text()).toContain('Paid at clinic');
    expect(text()).toContain('Payment recorded.');
    expect(button('Mark as paid')).toBeUndefined();
    expect(
      dentraApi.endpoints.getDayAppointments.select({
        date: appointment.date,
        page: 1,
      })(state.store.getState()).data!.items[0].payment!.status,
    ).toBe('paid');
    cache.unsubscribe();
  },
);

test('cancelling confirmation leaves the payment due and allows another confirmation', async () => {
  await mount();
  await press('Cash');
  await press('Mark as paid');
  await act(async () =>
    jest.mocked(Alert.alert).mock.calls.at(-1)![2]![0].onPress!(),
  );
  expect(writes).toHaveLength(0);
  expect(text()).toContain('due at clinic');
  await press('Mark as paid');
  await confirm();
  expect(writes).toHaveLength(1);
});

test('recovers a committed receipt when the response is lost', async () => {
  mode = 'lost-response';
  await mount();
  await press('UPI');
  await press('Mark as paid');
  await confirm();
  expect(text()).toContain('Payment recorded.');
  expect(button('Mark as paid')).toBeUndefined();
  expect(writes).toHaveLength(1);
});

test('retains the request ID and selected method when retrying an offline recording', async () => {
  mode = 'offline';
  await mount();
  await press('Cash');
  await press('Mark as paid');
  await confirm();
  expect(text()).toContain('Check your connection');
  const first = writes[0].body;
  mode = null;
  await press('Mark as paid');
  await confirm();
  expect(writes[1].body).toEqual(first);
  expect(text()).toContain('Payment recorded.');
});

test('shows another device’s receipt after a conflict without recording twice', async () => {
  mode = 'other-device';
  await mount();
  await press('Cash');
  await press('Mark as paid');
  await confirm();
  expect(text()).toContain('Payment was already recorded');
  expect(text()).toContain('Card');
  expect(writes).toHaveLength(1);
  expect(button('Mark as paid')).toBeUndefined();
});

test('cannot collect cancelled, video or online appointments; completed clinic visits can be collected', async () => {
  for (const changes of [
    { status: 'cancelled' },
    { type: 'video' },
    { payment: { ...appointment.payment, method: 'upi', status: 'pending' } },
  ]) {
    appointment = {
      ...appointment,
      type: 'clinic',
      status: 'booked',
      payment: {
        method: 'pay_at_clinic',
        amountPaise: 50029,
        status: 'due_at_clinic',
      },
      ...changes,
    } as Appointment;
    await mount();
    expect(button('Mark as paid')).toBeUndefined();
    await act(async () => {
      tree.unmount();
      state.cleanup();
    });
  }
  appointment = {
    ...appointment,
    status: 'completed',
    payment: {
      method: 'pay_at_clinic',
      amountPaise: 50029,
      status: 'due_at_clinic',
    },
  };
  await mount();
  expect(button('Mark as paid')).toBeDefined();
});

test('ignores rapid confirmation taps while the recording is pending', async () => {
  await mount();
  await press('Cash');
  await press('Mark as paid');
  let release!: () => void;
  hold = new Promise<void>(resolve => {
    release = resolve;
  });
  const confirmAction = jest
    .mocked(Alert.alert)
    .mock.calls.at(-1)![2]!
    .find(item => item.text === 'Confirm received')!;
  let pending: unknown[] = [];
  await act(async () => {
    pending = [confirmAction.onPress!(), confirmAction.onPress!()];
    await flush();
  });
  expect(writes).toHaveLength(1);
  await act(async () => {
    release();
    await Promise.all(pending);
    await flush();
  });
  expect(text()).toContain('Payment recorded.');
});
