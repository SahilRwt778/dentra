import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import Renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, afterEach, test, expect, vi } from 'vitest';
import {
  dentraApi,
  useGetAppointmentsByAppointmentIdQuery,
  type Appointment,
} from '../src/api/generated-api';
import authReducer from '../src/store/auth-slice';
import { AppointmentPaymentCard } from '../src/components/payments/appointment-payment-card';

vi.mock('@/auth/refresh-token-storage', () => ({
  getRefreshToken: () => null,
  setRefreshToken: vi.fn(),
  clearRefreshToken: vi.fn(),
}));
let tree: ReactTestRenderer;
let store: ReturnType<typeof makeStore>;
let appointment: Appointment;
let writes: Record<string, unknown>[];
let mode: 'offline' | 'lost-response' | 'conflict' | null;
function makeStore() {
  return configureStore({
    enhancers: defaults => defaults({ autoBatch: false }),
    reducer: { auth: authReducer, [dentraApi.reducerPath]: dentraApi.reducer },
    middleware: (defaults) => defaults().concat(dentraApi.middleware),
  });
}
function Harness() {
  const { currentData } = useGetAppointmentsByAppointmentIdQuery({
    appointmentId: 'test-clinic-payment',
  });
  return currentData ? (
    <AppointmentPaymentCard appointment={currentData} />
  ) : null;
}
async function flush() {
  for (let i = 0; i < 8; i++)
    await new Promise<void>((resolve) => setImmediate(resolve));
}
async function mount() {
  await act(async () => {
    tree = Renderer.create(
      <Provider store={store}>
        <Harness />
      </Provider>,
    );
    await flush();
  });
}
function button(label: string) {
  return tree.root
    .findAllByType('button')
    .find((item) => item.children.join('') === label);
}
async function click(label: string) {
  await act(async () => {
    button(label)!.props.onClick();
    await flush();
  });
}
async function choose(method: string) {
  await act(async () =>
    tree.root
      .findByType('select')
      .props.onChange({ target: { value: method } }),
  );
}
async function submit() {
  await act(async () => {
    tree.root.findByType('form').props.onSubmit({ preventDefault: vi.fn() });
    await flush();
  });
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
  writes = [];
  mode = null;
  appointment = {
    id: 'test-clinic-payment',
    patientName: 'Synthetic Patient',
    type: 'clinic',
    status: 'booked',
    payment: {
      amountPaise: 50029,
      method: 'pay_at_clinic',
      status: 'due_at_clinic',
      collection: null,
    },
  };
  vi.stubGlobal(
    'fetch',
    vi.fn(async (request: Request) => {
      if (request.method === 'GET') return Response.json(appointment);
      const body = await request.json();
      writes.push(body);
      if (mode === 'offline') throw new Error('Synthetic network failure');
      appointment = {
        ...appointment,
        payment: {
          ...appointment.payment!,
          status: 'paid',
          collection: {
            id: mode === 'conflict' ? 'other-device-receipt' : body.requestId,
            amountPaise: 50029,
            method: mode === 'conflict' ? 'card' : body.method,
            collectedAt: '2026-10-24T10:00:00Z',
          },
        },
      };
      if (mode === 'conflict')
        return Response.json(
          { message: 'Payment was already recorded.' },
          { status: 409 },
        );
      if (mode === 'lost-response') throw new Error('Synthetic timeout');
      return Response.json(appointment);
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

test('opens a confirmation form, requires a method, and records the exact booked amount', async () => {
  await mount();
  await click('Mark as paid');
  expect(button('Confirm received')!.props.disabled).toBe(true);
  expect(writes).toEqual([]);
  await choose('upi');
  await submit();
  expect(writes).toHaveLength(1);
  expect(writes[0]).toMatchObject({ amountPaise: 50029, method: 'upi' });
  expect(writes[0].requestId).toMatch(/^[a-f0-9-]{36}$/);
  expect(text()).toContain('Paid at clinic');
  expect(text()).toContain('UPI');
  expect(text()).toContain('IST');
  expect(button('Mark as paid')).toBeUndefined();
});
test('going back does not record money', async () => {
  await mount();
  await click('Mark as paid');
  await choose('cash');
  await click('Go back');
  expect(writes).toEqual([]);
  expect(tree.root.findAllByType('form')).toHaveLength(0);
});
test('keeps the same request ID for a retry after a network failure', async () => {
  mode = 'offline';
  await mount();
  await click('Mark as paid');
  await choose('cash');
  await submit();
  expect(writes).toHaveLength(1);
  expect(text()).toContain('Could not record payment');
  const previous = writes[0];
  mode = null;
  await submit();
  expect(writes[1]).toEqual(previous);
  expect(text()).toContain('Paid at clinic');
});
test.each(['lost-response', 'conflict'] as const)(
  'reconciles %s against the server receipt',
  async (failure) => {
    mode = failure;
    await mount();
    await click('Mark as paid');
    await choose('cash');
    await submit();
    expect(writes).toHaveLength(1);
    expect(text()).toContain('Paid at clinic');
    expect(button('Mark as paid')).toBeUndefined();
    if (failure === 'conflict') expect(text()).toContain('Card');
  },
);
test('hides collection for online and cancelled appointments, while completed visits remain collectible', async () => {
  appointment = { ...appointment, status: 'cancelled' };
  await mount();
  expect(button('Mark as paid')).toBeUndefined();
  await act(async () => {
    appointment = {
      ...appointment,
      status: 'booked',
      payment: { ...appointment.payment, method: 'upi', status: 'pending' },
    };
    await store.dispatch(
      dentraApi.util.upsertQueryData(
        'getAppointmentsByAppointmentId',
        { appointmentId: appointment.id! },
        appointment,
      ),
    );
  });
  expect(button('Mark as paid')).toBeUndefined();
  await act(async () => {
    appointment = {
      ...appointment,
      status: 'completed',
      payment: {
        ...appointment.payment,
        method: 'pay_at_clinic',
        status: 'due_at_clinic',
      },
    };
    await store.dispatch(
      dentraApi.util.upsertQueryData(
        'getAppointmentsByAppointmentId',
        { appointmentId: appointment.id! },
        appointment,
      ),
    );
  });
  expect(button('Mark as paid')).toBeDefined();
});
