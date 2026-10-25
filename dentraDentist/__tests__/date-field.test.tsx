import React from 'react';
import { Modal } from 'react-native';
import Renderer, { act } from 'react-test-renderer';
import { DateField } from '../src/components/forms/DateField';
import { Button } from '../src/components/ui/Button';

let tree: Renderer.ReactTestRenderer;
const change = jest.fn();
async function mount(value: string | null = null, disabled = false) {
  await act(async () => {
    tree = Renderer.create(
      <DateField
        label="Follow-up date"
        value={value}
        onChange={change}
        minimumDate="2026-10-24"
        disabled={disabled}
      />,
    );
  });
}
function action(label: string) {
  return tree.root.findAll(
    node =>
      node.props.accessibilityLabel === label &&
      typeof node.props.onPress === 'function',
  )[0];
}
async function press(label: string) {
  await act(async () => {
    const target =
      action(label) ??
      tree.root.findAllByType(Button).find(node => node.props.title === label)!;
    target.props.onPress();
  });
}
afterEach(async () => {
  await act(async () => tree?.unmount());
  change.mockClear();
});

test('opens a bounded calendar, changes month and commits only after confirmation', async () => {
  await mount();
  await press('Follow-up date');
  expect(action('23 Oct 2026').props.disabled).toBe(true);
  expect(action('24 Oct 2026').props.disabled).toBe(false);
  expect(action('Previous month').props.disabled).toBe(true);
  await press('Next month');
  await press('1 Nov 2026');
  expect(change).not.toHaveBeenCalled();
  await press('Select date');
  expect(change).toHaveBeenCalledWith('2026-11-01');
  expect(tree.root.findByType(Modal).props.visible).toBe(false);
});

test('cancel and phone Back preserve the original, and a saved date can be cleared explicitly', async () => {
  await mount('2026-11-01');
  await press('Follow-up date');
  await press('2 Nov 2026');
  await press('Cancel');
  expect(change).not.toHaveBeenCalled();
  await press('Follow-up date');
  expect(action('1 Nov 2026').props.accessibilityState.selected).toBe(true);
  await act(async () => tree.root.findByType(Modal).props.onRequestClose());
  expect(change).not.toHaveBeenCalled();
  await press('Clear follow-up date');
  expect(change).toHaveBeenCalledWith(null);
});

test('completed visits keep their date visible without allowing date selection or clearing', async () => {
  await mount('2026-10-01', true);
  expect(action('Follow-up date').props.accessibilityValue.text).toBe(
    '1 Oct 2026',
  );
  expect(action('Follow-up date').props.disabled).toBe(true);
  await press('Follow-up date');
  expect(tree.root.findByType(Modal).props.visible).toBe(false);
  expect(tree.root.findAllByType(Button)).toHaveLength(0);
  expect(change).not.toHaveBeenCalled();
});

test('leap day and year navigation produce calendar strings without a timezone conversion', async () => {
  await mount('2028-02-28');
  await press('Follow-up date');
  await press('29 Feb 2028');
  await press('Select date');
  expect(change).toHaveBeenCalledWith('2028-02-29');
  await act(async () =>
    tree.update(
      <DateField
        label="Follow-up date"
        value="2026-12-31"
        onChange={change}
        minimumDate="2026-10-24"
      />,
    ),
  );
  await press('Follow-up date');
  await press('Next month');
  await press('1 Jan 2027');
  await press('Select date');
  expect(change).toHaveBeenLastCalledWith('2027-01-01');
});
