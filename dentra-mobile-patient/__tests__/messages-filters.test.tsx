import React from 'react';
import { FlatList, Text } from 'react-native';
import Renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { ConsultationInbox } from '@dentra/video/src/ConsultationInbox';
import { MessagesScreen } from '../src/screens/MessagesScreen';
import type { ConsultationCase } from '@dentra/call-core';

jest.mock('../src/store/hooks', () => ({ useAppDispatch: () => jest.fn() }));
let mockItems: ConsultationCase[] = [];

const mockQuery = jest.fn((_query: unknown, _options?: unknown) => ({
  currentData: { items: mockItems, nextPage: 2 },
  isFetching: false,
  refetch: jest.fn(),
}));
jest.mock('../src/api/consultation-cases', () => ({
  useConsultationCasesQuery: (query: unknown, options: unknown) =>
    mockQuery(query, options),
}));
jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => true,
  useNavigation: () => ({ navigate: jest.fn() }),
}));
let tree: ReactTestRenderer;
async function choose(label: string) {
  await act(async () =>
    tree.root
      .findAll(
        node =>
          node.props.accessibilityLabel === label &&
          typeof node.props.onPress === 'function',
      )[0]
      .props.onPress(),
  );
}
beforeEach(async () => {
  jest.clearAllMocks();
  mockItems = [];
  await act(async () => {
    tree = Renderer.create(<MessagesScreen />);
  });
});

test('Open excludes closed rows even when an older API returns a mixed page', async () => {
  mockItems = (['active', 'pending', 'expired', 'revoked'] as const).map(
    status => ({
      id: status,
      originalAppointmentId: status,
      patientId: 'patient',
      dentistId: status,
      patientName: 'Patient',
      dentistName: status,
      concern: 'Toothache',
      activatedAt: null,
      expiresAt: null,
      serverNow: new Date().toISOString(),
      status,
      canMessage: status === 'active',
      canBookFollowUp: false,
      unreadCount: 0,
      latestMessageAt: null,
    }),
  );
  await act(async () => tree.update(<MessagesScreen />));
  const rows = () =>
    tree.root
      .findByType(FlatList)
      .props.data.map((item: ConsultationCase) => item.status);
  expect(rows()).toHaveLength(4);
  await choose('Open conversations');
  expect(rows()).toEqual(['active']);
  await choose('Closed conversations');
  expect(rows()).toEqual(['pending', 'expired', 'revoked']);
  mockItems = mockItems.map(item => ({
    ...item,
    canMessage: item.status === 'pending',
  }));
  await act(async () => tree.update(<MessagesScreen />));
  await choose('Open conversations');
  expect(rows()).toEqual(['pending']);
  await choose('Closed conversations');
  expect(rows()).toEqual(['active', 'expired', 'revoked']);
  await choose('All conversations');
  expect(rows()).toHaveLength(4);
});
afterEach(async () => {
  await act(async () => tree.unmount());
});

test('All, Open and Closed request the corresponding patient inbox and show the selected filter', async () => {
  expect(mockQuery.mock.calls.at(-1)?.[0]).toEqual({ page: 1, filter: 'all' });
  await choose('Closed conversations');
  expect(tree.root.findByType(ConsultationInbox).props.filter).toBe('closed');
  expect(mockQuery.mock.calls.at(-1)?.[0]).toEqual({
    page: 1,
    filter: 'closed',
  });
  expect(
    tree.root
      .findAllByType(Text)
      .some(node => node.props.children === 'No closed conversations'),
  ).toBe(true);
  await act(async () => tree.root.findByType(ConsultationInbox).props.onNext());
  expect(mockQuery.mock.calls.at(-1)?.[0]).toEqual({
    page: 2,
    filter: 'closed',
  });
  await choose('Open conversations');
  expect(mockQuery.mock.calls.at(-1)?.[0]).toEqual({ page: 1, filter: 'open' });
  await choose('All conversations');
  expect(mockQuery.mock.calls.at(-1)?.[0]).toEqual({ page: 1, filter: 'all' });
});
