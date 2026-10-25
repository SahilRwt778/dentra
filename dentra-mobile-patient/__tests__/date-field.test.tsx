import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import { Platform } from 'react-native';
import DateTimePicker, {
  DateTimePickerAndroid,
  type AndroidNativeProps,
} from '@react-native-community/datetimepicker';
import { DateField } from '../src/components/date-field';
import { Button } from '../src/components/ui';

let tree: Renderer.ReactTestRenderer;
const changed = jest.fn();
const minimumDate = new Date(1901, 0, 1);
const maximumDate = new Date(2026, 9, 17, 23, 59, 59);

async function renderPicker(value = '') {
  await act(async () => {
    tree = Renderer.create(
      <DateField
        label="Date of birth"
        value={value}
        onChange={changed}
        initialDate={new Date(2000, 0, 1)}
        minimumDate={minimumDate}
        maximumDate={maximumDate}
      />,
    );
  });
}

async function openPicker() {
  await act(async () => {
    tree.root
      .findAllByProps({ accessibilityLabel: 'Date of birth' })
      .find(field => typeof field.props.onPress === 'function')!
      .props.onPress();
  });
}

afterEach(async () => {
  await act(async () => tree?.unmount());
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

test('Android opens a bounded date picker and preserves the selected local calendar date', async () => {
  jest.replaceProperty(Platform, 'OS', 'android');
  await renderPicker('1995-04-14');
  await openPicker();
  const options = jest.mocked(DateTimePickerAndroid.open).mock
    .calls[0][0] as AndroidNativeProps;
  expect(options.mode).toBe('date');
  expect(options.minimumDate).toBe(minimumDate);
  expect(options.maximumDate).toBe(maximumDate);
  expect(options.value.getFullYear()).toBe(1995);
  expect(options.value.getMonth()).toBe(3);
  expect(options.value.getDate()).toBe(14);

  const picked = new Date(2010, 6, 4, 0, 0);
  await act(async () => {
    options.onValueChange!(
      { nativeEvent: { timestamp: picked.getTime(), utcOffset: 330 } },
      picked,
    );
  });
  expect(changed).toHaveBeenCalledWith('2010-07-04');
});

test('Android cancellation keeps an empty birth date empty', async () => {
  jest.replaceProperty(Platform, 'OS', 'android');
  await renderPicker();
  await openPicker();
  const options = jest.mocked(DateTimePickerAndroid.open).mock
    .calls[0][0] as AndroidNativeProps;
  await act(async () => options.onDismiss!());
  expect(changed).not.toHaveBeenCalled();
});

test('iOS commits a selected date only after confirmation and preserves the original on cancel', async () => {
  jest.replaceProperty(Platform, 'OS', 'ios');
  await renderPicker('1995-04-14');
  await openPicker();
  const picked = new Date(2011, 2, 12);
  await act(async () => {
    tree.root.findByType(DateTimePicker).props.onValueChange({}, picked);
  });
  expect(changed).not.toHaveBeenCalled();
  await act(async () => {
    tree.root
      .findAllByType(Button)
      .find(button => button.props.title === 'Cancel')!
      .props.onPress();
  });
  expect(changed).not.toHaveBeenCalled();

  await openPicker();
  const selected = tree.root.findByType(DateTimePicker).props.value;
  expect(selected.getFullYear()).toBe(1995);
  await act(async () =>
    tree.root.findByType(DateTimePicker).props.onValueChange({}, picked),
  );
  await act(async () => {
    tree.root
      .findAllByType(Button)
      .find(button => button.props.title === 'Select date')!
      .props.onPress();
  });
  expect(changed).toHaveBeenCalledWith('2011-03-12');
});
