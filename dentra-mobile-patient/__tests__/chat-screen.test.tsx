import React from 'react';
import Renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { Modal, TextInput } from 'react-native';
import { CallChat } from '@dentra/video/src/CallChat';
import { ChatScreen } from '../src/screens/ChatScreen';
import type { PatientScreenProps } from '../src/navigation/types';

let mockFocused = true;
jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => mockFocused,
}));
jest.mock('../src/api/consultation-cases', () => ({
  useConsultationCaseQuery: () => ({
    currentData: {
      id: 'case',
      originalAppointmentId: 'visit',
      dentistName: 'Test dentist',
      expiresAt: null,
    },
  }),
}));
jest.mock('../src/api/call-chat', () => ({
  callChat: {
    requestId: () => 'draft',
    list: jest.fn(async () => ({ items: [], hasMore: false, canSend: true })),
  },
}));
let tree: ReactTestRenderer;
const goBack = jest.fn();
const props = {
  route: { params: { caseId: 'case' } },
  navigation: { goBack },
} as unknown as PatientScreenProps<'Chat'>;
beforeEach(async () => {
  mockFocused = true;
  jest.clearAllMocks();
  jest.useFakeTimers();
  await act(async () => {
    tree = Renderer.create(<ChatScreen {...props} />);
  });
});
afterEach(async () => {
  await act(async () => tree.unmount());
  jest.useRealTimers();
});
test('opening a patient inbox conversation uses the navigation screen without a second modal', async () => {
  expect(tree.root.findByType(CallChat).props.presentation).toBe('screen');
  expect(tree.root.findAllByType(Modal)).toHaveLength(0);
  const back = tree.root.findAll(
    node =>
      node.props.accessibilityLabel === 'Back' &&
      typeof node.props.onPress === 'function',
  )[0];
  await act(async () => back.props.onPress());
  expect(goBack).toHaveBeenCalledTimes(1);
});
test('losing focus preserves the chat surface and draft during the navigation transition', async () => {
  const chat = tree.root.findByType(CallChat);
  await act(async () =>
    tree.root.findByType(TextInput).props.onChangeText('Unsent message'),
  );
  mockFocused = false;
  await act(async () => tree.update(<ChatScreen {...props} />));
  expect(tree.root.findByType(CallChat)).toBe(chat);
  expect(tree.root.findByType(CallChat).props.visible).toBe(false);
  expect(tree.root.findByType(TextInput).props.value).toBe('Unsent message');
  expect(tree.root.findAllByType(Modal)).toHaveLength(0);
});
