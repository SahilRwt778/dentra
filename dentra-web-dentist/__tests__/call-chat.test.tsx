import React, { useEffect } from 'react';
import Renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import {
  useCallChat,
  type ChatClient,
  type ChatMessage,
} from '@dentra/call-core';

const item = (sequence: string, own = false): ChatMessage => ({
  id: `message-${sequence}`,
  sequence,
  requestId: `retry-${sequence}`,
  text: `Text ${sequence}`,
  own,
  senderRole: own ? 'dentist' : 'patient',
  createdAt: new Date().toISOString(),
  attachment: null,
});
let tree: ReactTestRenderer;
let chat: ReturnType<typeof useCallChat>;
const list = vi.fn<ChatClient['list']>();
const send = vi.fn<ChatClient['send']>();
const client = { list, send };
function Probe({ visible = false }: { visible?: boolean }) {
  const value = useCallChat('appointment', client, visible);
  useEffect(() => {
    chat = value;
  }, [value]);
  return null;
}
async function mount(visible = false) {
  await act(async () => {
    tree = Renderer.create(<Probe visible={visible} />);
  });
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
});
afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

test('sending does not advance the receive cursor past an unseen remote message', async () => {
  list
    .mockResolvedValueOnce({ items: [item('1')], hasMore: false })
    .mockResolvedValueOnce({
      items: [item('2'), item('3', true)],
      hasMore: false,
    });
  send.mockResolvedValue(item('3', true));
  await mount();
  await act(async () => {
    await chat.send({ requestId: 'same-retry', text: 'Hello' });
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(2000);
  });
  expect(list.mock.calls[1][1]).toEqual({ after: '1' });
  expect(chat.items.map((message) => message.sequence)).toEqual([
    '1',
    '2',
    '3',
  ]);
  expect(chat.unread).toBe(1);
  await act(async () => tree.update(<Probe visible />));
  expect(chat.unread).toBe(0);
});

test('an uncertain send retains its retry key and the server response is deduplicated against polling', async () => {
  list.mockResolvedValue({ items: [item('1')], hasMore: false });
  send
    .mockRejectedValueOnce({ data: { message: 'Connection interrupted' } })
    .mockResolvedValueOnce(item('2', true));
  await mount(true);
  const draft = { requestId: 'stable-retry', text: 'Same message' };
  await act(async () => {
    expect(await chat.send(draft)).toBe(false);
  });
  expect(chat.error).toBe('Connection interrupted');
  await act(async () => {
    expect(await chat.send(draft)).toBe(true);
  });
  expect(send.mock.calls.map((call) => call[1].requestId)).toEqual([
    'stable-retry',
    'stable-retry',
  ]);
  list.mockResolvedValue({ items: [item('2', true)], hasMore: false });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(2000);
  });
  expect(chat.items.map((message) => message.sequence)).toEqual(['1', '2']);
});

test('three uploads remain locked as one send action and a partial retry keeps each request ID', async () => {
  list.mockResolvedValue({ items: [], hasMore: false, canSend: true });
  send
    .mockReset()
    .mockResolvedValueOnce(item('1', true))
    .mockRejectedValueOnce(new Error('Upload interrupted'));
  await mount(true);
  const drafts = [1, 2, 3].map((index) => ({
    requestId: `attachment-${index}`,
    text: index === 1 ? 'Three reports' : '',
    file: new Blob(['test'], { type: 'application/pdf' }),
  }));
  await act(async () => {
    expect(await chat.sendMany(drafts)).toBe(1);
  });
  expect(send).toHaveBeenCalledTimes(2);
  expect(chat.error).toBe('Upload interrupted');
  send
    .mockResolvedValueOnce(item('2', true))
    .mockResolvedValueOnce(item('3', true));
  await act(async () => {
    expect(await chat.sendMany(drafts.slice(1))).toBe(2);
  });
  expect(send.mock.calls.map((call) => call[1].requestId)).toEqual([
    'attachment-1',
    'attachment-2',
    'attachment-2',
    'attachment-3',
  ]);
  expect(chat.items).toHaveLength(3);
});

test('more than three attachments are rejected and the warning can be dismissed', async () => {
  list.mockResolvedValue({ items: [], hasMore: false, canSend: true });
  await mount(true);
  send.mockClear();
  await act(async () => {
    expect(
      await chat.sendMany(
        [1, 2, 3, 4].map((index) => ({
          requestId: `file-${index}`,
          text: 'Report',
        })),
      ),
    ).toBe(0);
  });
  expect(send).not.toHaveBeenCalled();
  expect(chat.error).toContain('up to 3');
  await act(async () => chat.dismissError());
  expect(chat.error).toBeUndefined();
});

test('older history is merged in sequence order and unmount aborts pending requests', async () => {
  list
    .mockResolvedValueOnce({ items: [item('10'), item('11')], hasMore: true })
    .mockResolvedValueOnce({ items: [item('8'), item('9')], hasMore: false });
  await mount(true);
  await act(async () => {
    await chat.older();
  });
  expect(list.mock.calls[1][1]).toEqual({ before: '10' });
  expect(chat.items.map((message) => message.sequence)).toEqual([
    '8',
    '9',
    '10',
    '11',
  ]);
  expect(chat.hasOlder).toBe(false);
  const signal = list.mock.calls[0][2];
  await act(async () => tree.unmount());
  expect(signal.aborted).toBe(true);
});

test('a pass closing during an open conversation blocks a new send without removing history', async () => {
  list
    .mockResolvedValueOnce({
      items: [item('1')],
      hasMore: false,
      canSend: true,
    })
    .mockResolvedValue({ items: [], hasMore: false, canSend: false });
  await mount(true);
  expect(chat.canSend).toBe(true);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(2000);
  });
  expect(chat.canSend).toBe(false);
  expect(chat.items).toHaveLength(1);
  await act(async () => {
    expect(await chat.send({ requestId: 'late', text: 'Too late' })).toBe(
      false,
    );
  });
  expect(send).not.toHaveBeenCalled();
});
