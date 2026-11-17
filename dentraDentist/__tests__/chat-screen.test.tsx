import React from 'react';
import Renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { Modal, TextInput } from 'react-native';
import { CallChat } from '@dentra/video/src/CallChat';
import { ChatScreen } from '../src/features/messages/ChatScreen';

let mockFocused = true;
jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => mockFocused,
}));
jest.mock('../src/store/dentraApi', () => ({
  useGetConsultationCaseQuery: () => ({
    currentData: {
      id: 'case',
      originalAppointmentId: 'visit',
      patientName: 'Test patient',
      expiresAt: null,
    },
  }),
}));
jest.mock('../src/api/call-chat.api', () => ({
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
} as unknown as Parameters<typeof ChatScreen>[0];
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
test('opening a dentist inbox conversation uses the navigation screen without a second modal', async () => {
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
