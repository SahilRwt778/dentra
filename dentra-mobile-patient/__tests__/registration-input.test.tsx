import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import { RegisterScreen } from '../src/screens/RegisterScreen';
import { DateField } from '../src/components/date-field';
import { Field } from '../src/components/ui';

jest.mock('../src/api/patients', () => ({
  useRegisterPatientMutation: () => [jest.fn(), { isLoading: false }],
}));
jest.mock('../src/auth/auth-context', () => ({
  useAuth: () => ({ logout: jest.fn() }),
}));
let tree: Renderer.ReactTestRenderer;
afterEach(async () => {
  await act(async () => tree?.unmount());
});

test('guardian mobile is controlled and capped at ten digits on the registration form', async () => {
  await act(async () => {
    tree = Renderer.create(<RegisterScreen />);
  });
  await act(async () =>
    tree.root
      .findByType(DateField)
      .props.onChange(`${new Date().getFullYear() - 10}-01-01`),
  );
  const guardian = () =>
    tree.root
      .findAllByType(Field)
      .find(node => node.props.label === 'Guardian’s mobile number')!;
  await act(async () => guardian().props.onChangeText('guardian12a34'));
  expect(guardian().props.value).toBe('1234');
  await act(async () => guardian().props.onChangeText('98765abc43210123'));
  expect(guardian().props.value).toBe('9876543210');
  expect(guardian().props.maxLength).toBe(10);
});
