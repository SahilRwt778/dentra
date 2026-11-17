import React from 'react';
import { FlatList, Text } from 'react-native';
import Renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { ConsultationInbox } from '@dentra/video/src/ConsultationInbox';
import { MessagesScreen } from '../src/features/messages/MessagesScreen';
import type { ConsultationCase } from '@dentra/call-core';

let mockItems: ConsultationCase[] = [];

const mockQuery = jest.fn((_query: unknown, _options?: unknown) => ({
  currentData: { items: mockItems, nextPage: 2 },
  isFetching: false,
  refetch: jest.fn(),
}));
jest.mock('../src/store/dentraApi', () => ({
  useGetConsultationCasesQuery: (query: unknown, options: unknown) =>
    mockQuery(query, options),
}));
jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => true,
  useNavigation: () => ({ navigate: jest.fn() }),
}));
jest.mock('../src/features/notifications/NotificationBell', () => ({
  NotificationBell: () => null,
}));
jest.mock('../src/common/hooks/useForegroundRefresh', () => ({
  useForegroundRefresh: jest.fn(),
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

test('dentist inbox applies the selected tab to mixed API results', async () => {
  mockItems = (['active', 'pending', 'expired', 'revoked'] as const).map(
    status => ({
      id: status,
      originalAppointmentId: status,
      patientId: status,
      dentistId: 'dentist',
      patientName: status,
      dentistName: 'Dentist',
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
  expect(rows()).toEqual(['active', 'pending']);
  await choose('Closed conversations');
  expect(rows()).toEqual(['expired', 'revoked']);
  await choose('All conversations');
  expect(rows()).toHaveLength(4);
});
afterEach(async () => {
  await act(async () => tree.unmount());
});

test('dentist inbox filters persist through pagination and changing filter resets to page one', async () => {
  expect(mockQuery.mock.calls.at(-1)?.[0]).toEqual({ page: 1, filter: 'all' });
  await choose('Open conversations');
  expect(mockQuery.mock.calls.at(-1)?.[0]).toEqual({ page: 1, filter: 'open' });
  await act(async () => tree.root.findByType(ConsultationInbox).props.onNext());
  expect(mockQuery.mock.calls.at(-1)?.[0]).toEqual({ page: 2, filter: 'open' });
  await choose('Closed conversations');
  expect(mockQuery.mock.calls.at(-1)?.[0]).toEqual({
    page: 1,
    filter: 'closed',
  });
  expect(
    tree.root
      .findAllByType(Text)
      .some(node => node.props.children === 'No closed conversations'),
  ).toBe(true);
  await choose('All conversations');
  expect(mockQuery.mock.calls.at(-1)?.[0]).toEqual({ page: 1, filter: 'all' });
});
