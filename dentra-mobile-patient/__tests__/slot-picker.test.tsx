import React, { useState } from 'react';
import Renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { SlotPicker } from '../src/components/slot-picker';
import { Button, Choice } from '../src/components/ui';

let mockSlots: string[];
jest.mock('../src/api/dentists', () => ({
  useDentistSlotsQuery: () => ({
    currentData: { date: '2026-11-17', slots: mockSlots },
    isFetching: false,
    refetch: jest.fn(),
  }),
}));
let tree: ReactTestRenderer;
const selected = jest.fn();
function Picker({
  date = '2026-11-17',
  expiresAt,
}: {
  date?: string;
  expiresAt?: string;
}) {
  const [time, setTime] = useState('');
  return (
    <SlotPicker
      dentistId="dentist"
      type="clinic"
      date={date}
      time={time}
      onDate={jest.fn()}
      expiresAt={expiresAt}
      onTime={value => {
        setTime(value);
        selected(value);
      }}
    />
  );
}
const labels = () =>
  tree.root.findAllByType(Choice).map(choice => choice.props.title);
beforeEach(() => {
  jest.useFakeTimers({ doNotFake: ['setImmediate'] });
  jest.setSystemTime(new Date('2026-11-17T10:09:59+05:30'));
  mockSlots = ['09:50', '10:00', '10:10', '10:20'];
  selected.mockClear();
});
afterEach(async () => {
  await act(async () => tree?.unmount());
  jest.useRealTimers();
});
test('hides elapsed slots even when the API cache still includes them', async () => {
  await act(async () => {
    tree = Renderer.create(<Picker />);
  });
  expect(labels()).not.toContain('9:50 AM');
  expect(labels()).not.toContain('10:00 AM');
  expect(labels()).toContain('10:10 AM');
  expect(labels()).toContain('10:20 AM');
});
test('removes and deselects a slot exactly at its start time without another API response', async () => {
  await act(async () => {
    tree = Renderer.create(<Picker />);
  });
  const choice = tree.root
    .findAllByType(Choice)
    .find(item => item.props.title === '10:10 AM')!;
  const chooseSlot = choice.props.onPress;
  await act(async () => chooseSlot());
  expect(selected).toHaveBeenLastCalledWith('10:10');
  await act(async () => {
    jest.advanceTimersByTime(1000);
  });
  expect(labels()).not.toContain('10:10 AM');
  expect(selected).toHaveBeenLastCalledWith('');
  expect(labels()).toContain('10:20 AM');
  // A delayed tap callback cannot select an expired slot either.
  await act(async () => chooseSlot());
  expect(selected).toHaveBeenLastCalledWith('');
});
test('allows earlier clock times tomorrow and keeps follow-up expiry filtering', async () => {
  await act(async () => {
    tree = Renderer.create(
      <Picker date="2026-11-18" expiresAt="2026-11-18T10:10:00+05:30" />,
    );
  });
  expect(labels()).toContain('9:50 AM');
  expect(labels()).toContain('10:00 AM');
  expect(labels()).not.toContain('10:10 AM');
  expect(labels()).not.toContain('10:20 AM');
});
test('shows an empty state when no future slots remain', async () => {
  mockSlots = ['09:50', '10:00'];
  await act(async () => {
    tree = Renderer.create(<Picker />);
  });
  expect(
    tree.root
      .findAllByType(Button)
      .some(button => button.props.title === 'Refresh availability'),
  ).toBe(true);
});
