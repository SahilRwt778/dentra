import React from 'react';
import Renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { createChatMediaLoader, type ChatMessage } from '@dentra/call-core';
import { ChatTimeline } from '../src/components/messages/chat-timeline';

let tree: ReactTestRenderer;
const node = { scrollTop: 0, scrollHeight: 1800, clientHeight: 400 };
const loader = createChatMediaLoader(vi.fn());
const message = (id: number): ChatMessage => ({
  id: `${id}`,
  sequence: `${id}`,
  requestId: `${id}`,
  own: false,
  senderRole: 'patient',
  text: 'Message',
  createdAt: '2026-11-17T10:00:00Z',
  attachment: null,
});
const props = {
  media: loader,
  visible: true,
  loading: false,
  embedded: true,
  hasOlder: true,
  onOlder: vi.fn(),
  onAttachment: vi.fn(),
};
beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  Object.assign(node, { scrollTop: 0, scrollHeight: 1800 });
  await act(async () => {
    tree = Renderer.create(
      <ChatTimeline {...props} items={[message(2), message(3)]} />,
      {
        createNodeMock: (element) =>
          element.props.role === 'log' ? node : null,
      },
    );
  });
});
afterEach(async () => {
  await act(async () => tree.unmount());
  vi.unstubAllGlobals();
});

test('opening a conversation starts at the latest message', () => {
  expect(node.scrollTop).toBe(1800);
});
test('a received message scrolls to the end instead of leaving the recipient at an old offset', async () => {
  node.scrollTop = 200;
  await act(async () =>
    tree.root
      .findByProps({ role: 'log' })
      .props.onScroll({ currentTarget: node }),
  );
  node.scrollHeight = 2000;
  await act(async () =>
    tree.update(
      <ChatTimeline {...props} items={[message(2), message(3), message(4)]} />,
    ),
  );
  expect(node.scrollTop).toBe(2000);
});
test('prepending earlier messages preserves the reading position', async () => {
  node.scrollTop = 100;
  await act(async () => tree.root.findByType('button').props.onClick());
  node.scrollHeight = 2400;
  await act(async () =>
    tree.update(
      <ChatTimeline {...props} items={[message(1), message(2), message(3)]} />,
    ),
  );
  expect(node.scrollTop).toBe(700);
});
