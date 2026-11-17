import Renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { RescheduleModal } from '../src/components/reschedule-modal';

const mocks = vi.hoisted(() => ({
  slots: vi.fn(),
  reschedule: vi.fn(),
  refetch: vi.fn(),
  close: vi.fn(),
}));
vi.mock('../src/api/generated-api', () => ({
  useGetDentistsByDentistIdSlotsQuery: mocks.slots,
  usePostAppointmentsByAppointmentIdRescheduleMutation: () => [
    mocks.reschedule,
    { isLoading: false },
  ],
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

let tree: ReactTestRenderer;
let availability: Map<string, string[]>;
let pendingDate: string | null;
let failedDate: string | null;
const today = '2026-11-17';
const tomorrow = '2026-11-18';
function modal(type: 'clinic' | 'video' = 'clinic') {
  return (
    <RescheduleModal
      appointmentId="appointment-one"
      dentistId="dentist-one"
      clinicId={type === 'clinic' ? 'clinic-one' : null}
      type={type}
      onClose={mocks.close}
    />
  );
}
function button(label: string) {
  return tree.root
    .findAllByType('button')
    .find((node) => node.children.join('') === label)!;
}
async function click(label: string) {
  await act(async () => {
    await button(label).props.onClick();
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-17T09:00:00+05:30'));
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  availability = new Map([
    [today, ['11:00', '12:00']],
    [tomorrow, ['13:00']],
  ]);
  pendingDate = null;
  failedDate = null;
  mocks.slots.mockImplementation(({ date }: { date: string }) => ({
    currentData:
      date === pendingDate
        ? undefined
        : { date, slots: availability.get(date) ?? [] },
    // RTK Query retains the previous argument's `data` during a new request.
    data: { date: today, slots: availability.get(today) },
    isFetching: date === pendingDate,
    error:
      date === failedDate
        ? { data: { message: 'Availability unavailable.' } }
        : undefined,
    refetch: mocks.refetch,
  }));
  mocks.reschedule.mockReturnValue({ unwrap: () => Promise.resolve({}) });
});
afterEach(async () => {
  await act(async () => tree?.unmount());
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

test.each(['clinic', 'video'] as const)(
  'starts with Today and confirms a same-day %s slot',
  async (type) => {
    await act(async () => {
      tree = Renderer.create(modal(type));
    });
    expect(button('Today').props['aria-pressed']).toBe(true);
    expect(mocks.slots.mock.calls[0][0]).toEqual({
      date: today,
      dentistId: 'dentist-one',
      type,
      clinicId: type === 'clinic' ? 'clinic-one' : undefined,
    });
    await click('11:00 AM');
    await click('Confirm new time');
    expect(mocks.reschedule).toHaveBeenCalledWith({
      appointmentId: 'appointment-one',
      body: { date: today, time: '11:00' },
    });
    expect(mocks.close).toHaveBeenCalledOnce();
  },
);

test('changing days clears the selected time and does not show the previous day’s slots while loading', async () => {
  await act(async () => {
    tree = Renderer.create(modal());
  });
  await click('11:00 AM');
  pendingDate = tomorrow;
  await click('Tomorrow');
  expect(button('11:00 AM')).toBeUndefined();
  expect(button('Confirm new time').props.disabled).toBe(true);
  expect(JSON.stringify(tree.toJSON())).toContain('Checking available times');
  pendingDate = null;
  await act(async () => tree.update(modal()));
  expect(button('Confirm new time').props.disabled).toBe(true);
  await click('1:00 PM');
  await click('Confirm new time');
  expect(mocks.reschedule).toHaveBeenCalledWith({
    appointmentId: 'appointment-one',
    body: { date: tomorrow, time: '13:00' },
  });
});

test('keeps Today available when it has no remaining slots and allows choosing tomorrow', async () => {
  availability.set(today, []);
  await act(async () => {
    tree = Renderer.create(modal());
  });
  expect(button('Today').props['aria-pressed']).toBe(true);
  expect(JSON.stringify(tree.toJSON())).toContain(
    'No available times on this day',
  );
  expect(button('Confirm new time').props.disabled).toBe(true);
  await click('Tomorrow');
  expect(button('1:00 PM')).toBeDefined();
});

test('a failed availability request cannot confirm a slot and can be retried', async () => {
  failedDate = today;
  await act(async () => {
    tree = Renderer.create(modal());
  });
  expect(tree.root.findByProps({ role: 'alert' }).children).toContain(
    'Availability unavailable.',
  );
  expect(button('Confirm new time').props.disabled).toBe(true);
  expect(button('11:00 AM')).toBeUndefined();
  await click('Retry availability');
  expect(mocks.refetch).toHaveBeenCalledOnce();
});

test('expires a cached selected slot at its start time and blocks a delayed confirmation', async () => {
  vi.setSystemTime(new Date('2026-11-17T10:59:59+05:30'));
  await act(async () => {
    tree = Renderer.create(modal());
  });
  await click('11:00 AM');
  const confirm = button('Confirm new time').props.onClick;
  await act(async () => {
    vi.advanceTimersByTime(1000);
  });
  expect(button('11:00 AM')).toBeUndefined();
  expect(button('12:00 PM')).toBeDefined();
  expect(button('Confirm new time').props.disabled).toBe(true);
  await act(async () => {
    await confirm();
  });
  expect(mocks.reschedule).not.toHaveBeenCalled();
});
