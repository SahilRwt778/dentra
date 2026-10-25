import React from 'react';
import { Alert, Switch, Text } from 'react-native';
import Renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { api } from '../src/api/client';
import { session } from '../src/features/auth/session';
import { createStoreHarness } from '../test-utils/store';
import { TimeOffScreen } from '../src/features/settings/availability/TimeOffScreen';
import { WorkingDaysField } from '../src/features/settings/availability/WorkingDaysField';
import { DateField } from '../src/components/forms/DateField';
import { TimeField } from '../src/components/forms/TimeField';
import { Button } from '../src/components/ui/Button';
import { dentraApi } from '../src/store/dentraApi';
import { dateKey, addDays } from '../src/common/utils/date';
import type { TimeOff, TimeOffPreview } from '../src/common/types/availability';

const navigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => true,
  usePreventRemove: jest.fn(),
}));
let tree: ReactTestRenderer;
let state: ReturnType<typeof createStoreHarness>;
let periods: TimeOff[];
let affected: TimeOffPreview;
let writes: { method: string; path: string; body: Record<string, unknown> }[];
let failCreate: 'conflict' | 'network' | null;
let failList: boolean;
let hold: Promise<void> | undefined;
let slotReads: number;
const path = '/dentists/me/time-off';

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
        <TimeOffScreen
          navigation={{ navigate } as never}
          route={{ key: 'leave', name: 'TimeOff' }}
        />,
      ),
    );
    await flush();
  });
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
function text() {
  return tree.root
    .findAllByType(Text)
    .map(node => node.props.children)
    .flat(Infinity)
    .filter(value => typeof value === 'string')
    .join(' ');
}
async function changeDate(date: string) {
  await act(async () => {
    tree.root.findAllByType(DateField)[0].props.onChange(date);
    await flush();
  });
}
beforeEach(async () => {
  state = createStoreHarness();
  tree = undefined as never;
  periods = [];
  affected = { total: 0, appointments: [] };
  writes = [];
  failCreate = null;
  failList = false;
  hold = undefined;
  slotReads = 0;
  navigate.mockClear();
  jest.spyOn(Alert, 'alert');
  await session.signIn({
    accessToken: 'synthetic-availability',
    refreshToken: 'synthetic-refresh',
    expiresInSeconds: 900,
  });
  api.defaults.adapter = async config => {
    if (config.method === 'get') {
      if (config.url?.endsWith('/slots')) {
        slotReads++;
        return reply(config, {
          date: dateKey(),
          slots: periods.length ? [] : ['10:00'],
        });
      }
      if (failList) throw new AxiosError('Offline', 'ERR_NETWORK', config);
      return reply(config, [...periods]);
    }
    const body = JSON.parse(config.data || '{}');
    writes.push({ method: config.method!, path: config.url!, body });
    if (hold) await hold;
    if (config.url?.endsWith('/preview')) return reply(config, affected);
    if (config.method === 'delete') {
      periods = periods.filter(period => !config.url?.endsWith(period.id));
      return reply(config, null);
    }
    if (failCreate === 'network')
      throw new AxiosError('Offline', 'ERR_NETWORK', config);
    if (failCreate === 'conflict')
      throw new AxiosError(
        'New booking',
        'ERR_BAD_REQUEST',
        config,
        undefined,
        {
          ...reply(config, {
            message: 'Move or cancel appointments, then check again.',
          }),
          status: 409,
        },
      );
    const period = {
      ...body,
      id: body.requestId,
      fromTime: body.fromTime ?? null,
      toTime: body.toTime ?? null,
      reason: body.reason ?? null,
    };
    periods.push(period);
    return reply(config, period);
  };
});
afterEach(async () => {
  await act(async () => {
    tree?.unmount();
    state.cleanup();
  });
  jest.restoreAllMocks();
});

test('requires a preview before saving all-day leave and refreshes its list and cached booking slots', async () => {
  const slots = state.store.dispatch(
    dentraApi.endpoints.getAppointmentSlots.initiate({
      dentistId: 'dentist-test',
      type: 'video',
      date: dateKey(),
    }),
  );
  await slots;
  await mount();
  expect(text()).toContain('No time off scheduled');
  await press('Check affected appointments');
  expect(writes).toHaveLength(1);
  expect(writes[0]).toMatchObject({
    path: `${path}/preview`,
    body: { startDate: dateKey(), endDate: dateKey(), allDay: true },
  });
  expect(writes[0].body).not.toHaveProperty('fromTime');
  expect(text()).toContain('Ready to block this period');
  await press('Confirm time off');
  expect(writes[1].body.requestId).toMatch(/^[a-f0-9-]{36}$/);
  expect(periods).toHaveLength(1);
  expect(text()).toContain('Time off saved');
  expect(button('Remove time off')).toBeDefined();
  expect(slotReads).toBeGreaterThan(1);
  slots.unsubscribe();
});

test('changing a date invalidates the preview and carries the end date forward', async () => {
  await mount();
  await press('Check affected appointments');
  const day = addDays(dateKey(), 3);
  await changeDate(day);
  expect(button('Confirm time off')).toBeUndefined();
  expect(tree.root.findAllByType(DateField)[1].props.value).toBe(day);
  await press('Check affected appointments');
  expect(writes.at(-1)!.body).toMatchObject({ startDate: day, endDate: day });
  expect(periods).toEqual([]);
});

test('shows conflicting appointments and opens their details without saving leave', async () => {
  affected = {
    total: 1,
    appointments: [
      {
        id: 'test-visit',
        patientName: 'Synthetic Patient',
        date: dateKey(),
        time: '10:00',
        type: 'clinic',
        clinicName: 'Test clinic',
      },
    ],
  };
  await mount();
  await press('Check affected appointments');
  expect(text()).toContain('1 appointments need attention');
  const link = tree.root
    .findAllByType(Button)
    .find(node => node.props.title.startsWith('Synthetic Patient'))!;
  await act(async () => link.props.onPress());
  expect(navigate).toHaveBeenCalledWith('Appointment', {
    appointmentId: 'test-visit',
  });
  expect(button('Confirm time off')).toBeUndefined();
  expect(periods).toEqual([]);
  affected = { total: 0, appointments: [] };
  await press('Check affected appointments');
  expect(button('Confirm time off')).toBeDefined();
});

test('submits a partial-day break with selected hours', async () => {
  await mount();
  await act(async () =>
    tree.root.findByType(Switch).props.onValueChange(false),
  );
  await act(async () => {
    const fields = tree.root.findAllByType(TimeField);
    fields[0].props.onChange('13:00');
    fields[1].props.onChange('14:00');
  });
  await press('Check affected appointments');
  expect(writes[0].body).toMatchObject({
    allDay: false,
    fromTime: '13:00',
    toTime: '14:00',
  });
  await press('Confirm time off');
  expect(periods[0]).toMatchObject({
    allDay: false,
    fromTime: '13:00',
    toTime: '14:00',
  });
});

test('a booking made after preview requires another check and does not save leave', async () => {
  await mount();
  await press('Check affected appointments');
  failCreate = 'conflict';
  await press('Confirm time off');
  expect(text()).toContain('Move or cancel appointments');
  expect(button('Confirm time off')).toBeUndefined();
  expect(periods).toEqual([]);
});

test('keeps the request ID on a network retry', async () => {
  await mount();
  await press('Check affected appointments');
  failCreate = 'network';
  await press('Confirm time off');
  const id = writes.at(-1)!.body.requestId;
  expect(text()).toContain('Check your connection');
  failCreate = null;
  await press('Check affected appointments');
  await press('Confirm time off');
  expect(writes.at(-1)!.body.requestId).toBe(id);
});

test('confirms removal before reopening availability', async () => {
  periods = [
    {
      id: 'leave-test',
      startDate: dateKey(),
      endDate: dateKey(),
      allDay: true,
      fromTime: null,
      toTime: null,
      reason: 'Test leave',
    },
  ];
  await mount();
  await press('Remove time off');
  expect(writes).toEqual([]);
  expect(jest.mocked(Alert.alert).mock.calls.at(-1)![2]![0].text).toBe(
    'Keep time off',
  );
  await act(async () => {
    await jest
      .mocked(Alert.alert)
      .mock.calls.at(-1)![2]!
      .find(item => item.text === 'Remove')!.onPress!();
    await flush();
  });
  expect(writes).toEqual([
    { method: 'delete', path: `${path}/leave-test`, body: {} },
  ]);
  expect(text()).toContain('No time off scheduled');
});

test('prevents duplicate preview requests while one is pending and can retry a list error', async () => {
  failList = true;
  await mount();
  expect(text()).toContain('Could not load time off');
  failList = false;
  await press('Try again');
  expect(text()).toContain('No time off scheduled');
  let release!: () => void;
  hold = new Promise<void>(resolve => {
    release = resolve;
  });
  let pending: Promise<unknown>[] = [];
  await act(async () => {
    pending = [
      button('Check affected appointments').props.onPress(),
      button('Check affected appointments').props.onPress(),
    ];
    await flush();
  });
  expect(writes).toHaveLength(1);
  await act(async () => {
    release();
    await Promise.all(pending);
    await flush();
  });
});

test('weekly controls represent explicit closed days and allow pausing every day', async () => {
  const change = jest.fn();
  await act(async () => {
    tree = Renderer.create(<WorkingDaysField value={[1]} onChange={change} />);
  });
  const monday = tree.root.findAll(
    node => node.props.accessibilityLabel === 'Monday' && node.props.onPress,
  )[0];
  expect(monday.props.accessibilityState.checked).toBe(true);
  await act(async () => monday.props.onPress());
  expect(change).toHaveBeenCalledWith([]);
});
