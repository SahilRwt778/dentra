import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import { LoginScreen } from '../src/screens/LoginScreen';
import { Button, ErrorState, Field } from '../src/components/ui';

const mockRequestOtp = jest.fn();
const mockVerifyOtp = jest.fn();
jest.mock('../src/auth/auth-context', () => ({
  useAuth: () => ({ requestOtp: mockRequestOtp, verifyOtp: mockVerifyOtp }),
}));

let tree: Renderer.ReactTestRenderer;

async function requestCode() {
  mockRequestOtp.mockResolvedValue({
    otpId: 'test-otp',
    resendAfterSeconds: 30,
  });
  await act(async () => {
    tree = Renderer.create(<LoginScreen />);
  });
  await act(async () =>
    tree.root.findByType(Field).props.onChangeText('9876543210'),
  );
  await act(async () => {
    await tree.root
      .findAllByType(Button)
      .find(button => button.props.title === 'Send code')!
      .props.onPress();
  });
}

function verifyButton() {
  return tree.root
    .findAllByType(Button)
    .find(button => button.props.title === 'Verify and continue')!;
}

afterEach(async () => {
  await act(async () => tree?.unmount());
  jest.resetAllMocks();
});

test('requires four digits, keeps a leading zero, and sends the code to backend verification', async () => {
  mockVerifyOtp.mockResolvedValue({});
  await requestCode();
  expect(tree.root.findByType(Field).props.maxLength).toBe(4);
  expect(tree.root.findByType(Field).props.placeholder).toBe('4-digit code');
  expect(verifyButton().props.disabled).toBe(true);
  await act(async () => tree.root.findByType(Field).props.onChangeText('012'));
  expect(verifyButton().props.disabled).toBe(true);
  await act(async () => {
    await verifyButton().props.onPress();
  });
  expect(mockVerifyOtp).not.toHaveBeenCalled();

  await act(async () =>
    tree.root.findByType(Field).props.onChangeText('0a12356'),
  );
  expect(tree.root.findByType(Field).props.value).toBe('0123');
  expect(verifyButton().props.disabled).toBe(false);
  await act(async () => {
    await verifyButton().props.onPress();
  });
  expect(mockVerifyOtp).toHaveBeenCalledWith('test-otp', '0123');
});

test('treats 1111 like any other code and displays a backend rejection', async () => {
  mockVerifyOtp.mockResolvedValue({ error: 'That code is incorrect.' });
  await requestCode();
  await act(async () => tree.root.findByType(Field).props.onChangeText('1111'));
  await act(async () => {
    await verifyButton().props.onPress();
  });
  expect(mockVerifyOtp).toHaveBeenCalledWith('test-otp', '1111');
  expect(tree.root.findByType(ErrorState).props.message).toBe(
    'That code is incorrect.',
  );
});
