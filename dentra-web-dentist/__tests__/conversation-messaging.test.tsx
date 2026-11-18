import { expect, test } from 'vitest';
import {
  conversationMessagingLabel,
  matchesConversationFilter,
} from '@dentra/call-core';

test.each([
  { status: 'pending', canMessage: false },
  { status: 'active', canMessage: false },
  { status: 'expired', canMessage: false },
  { status: 'revoked', canMessage: false },
  { status: 'pending', canMessage: true },
  { status: 'active', canMessage: true },
])('filters by messaging permission for $status / $canMessage', (item) => {
  expect(matchesConversationFilter(item, 'all')).toBe(true);
  expect(matchesConversationFilter(item, 'open')).toBe(item.canMessage);
  expect(matchesConversationFilter(item, 'closed')).toBe(!item.canMessage);
});

test('labels match the messaging permission, including live consultation chats', () => {
  expect(
    conversationMessagingLabel({
      canMessage: false,
      expiresAt: '2099-01-01T00:00:00Z',
    }),
  ).toBe('Closed · History available');
  expect(
    conversationMessagingLabel({ canMessage: true, expiresAt: null }),
  ).toBe('Messaging open');
  expect(
    conversationMessagingLabel({
      canMessage: true,
      expiresAt: '2099-01-01T00:00:00Z',
    }),
  ).toMatch(/^Open until /);
});
