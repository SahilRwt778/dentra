import React from 'react';
import Renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import {
  AppState,
  BackHandler,
  Image,
  Modal,
  TextInput,
  StyleSheet,
} from 'react-native';
import { CallChat, type NativeChatClient } from '@dentra/video/src/CallChat';
import type { ChatPage } from '@dentra/call-core';

const photo = {
  uri: 'file:///private/photo.jpg',
  name: 'Photo.jpg',
  type: 'image/jpeg',
  size: 1024,
};
const client: NativeChatClient = {
  requestId: jest.fn(() => 'stable-retry'),
  list: jest.fn(async () => ({ items: [], hasMore: false })),
  send: jest.fn(),
  pick: jest.fn(async () => photo),
  download: jest.fn(),
  openFile: jest.fn(),
};
let tree: ReactTestRenderer;
async function press(label: string) {
  await act(async () => {
    tree.root
      .findAll(
        node =>
          node.props.accessibilityLabel === label &&
          typeof node.props.onPress === 'function',
      )[0]
      .props.onPress();
  });
}
beforeEach(async () => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  // Restoring a spy on the preset's mock also clears its subscription implementation.
  jest.mocked(AppState.addEventListener).mockReturnValue({ remove: jest.fn() });
  await act(async () => {
    tree = Renderer.create(
      <CallChat
        appointmentId="visit"
        client={client}
        visible
        onClose={jest.fn()}
        onUnread={jest.fn()}
      />,
    );
  });
});
afterEach(async () => {
  await act(async () => tree.unmount());
  jest.clearAllTimers();
  jest.useRealTimers();
});

test('a chosen photo has a compact preview and can be removed before anything is sent', async () => {
  await press('Add attachment');
  await press('Gallery');
  const image = tree.root.findByType(Image);
  expect(image.props.source.uri).toBe(photo.uri);
  expect(StyleSheet.flatten(image.props.style)).toMatchObject({
    width: 64,
    height: 64,
  });
  expect(client.send).not.toHaveBeenCalled();
  await press('Remove attachment');
  expect(tree.root.findAllByType(Image)).toHaveLength(0);
  expect(
    tree.root.findAll(
      node =>
        node.props.accessibilityLabel === 'Send chat message' &&
        typeof node.props.onPress === 'function',
    )[0].props.disabled,
  ).toBe(true);
});

test('one attachment button reveals Gallery, Camera and File without changing the draft', async () => {
  expect(
    tree.root.findAllByProps({ testID: 'chat-attachment-options' }),
  ).toHaveLength(0);
  await act(async () =>
    tree.root.findByType(TextInput).props.onChangeText('Keep this caption'),
  );
  await press('Add attachment');
  for (const label of ['Gallery', 'Camera', 'File']) {
    expect(
      tree.root.findAll(node => node.props.accessibilityLabel === label).length,
    ).toBeGreaterThan(0);
  }
  await press('Close attachment options');
  expect(tree.root.findByType(TextInput).props.value).toBe('Keep this caption');
  expect(client.pick).not.toHaveBeenCalled();
});

test('taking a photo pauses and restores the call camera and previews it before sending', async () => {
  const setEnabled = jest.fn(async () => undefined);
  await act(async () =>
    tree.update(
      <CallChat
        appointmentId="visit"
        client={client}
        visible
        onClose={jest.fn()}
        onUnread={jest.fn()}
        callCamera={{ enabled: true, setEnabled }}
      />,
    ),
  );
  await press('Add attachment');
  await press('Camera');
  expect(setEnabled.mock.calls).toEqual([[false], [true]]);
  expect(client.pick).toHaveBeenCalledWith('camera');
  expect(tree.root.findByType(Image).props.source.uri).toBe(photo.uri);
  expect(client.send).not.toHaveBeenCalled();
});

test('cancelling the file picker keeps an already selected photo and caption', async () => {
  await press('Add attachment');
  await press('Gallery');
  await act(async () =>
    tree.root.findByType(TextInput).props.onChangeText('My photo'),
  );
  jest.mocked(client.pick).mockResolvedValueOnce(undefined);
  await press('Add attachment');
  await press('File');
  expect(client.pick).toHaveBeenLastCalledWith('file');
  expect(tree.root.findByType(Image).props.source.uri).toBe(photo.uri);
  expect(tree.root.findByType(TextInput).props.value).toBe('My photo');
  expect(client.send).not.toHaveBeenCalled();
});

test('a camera error still restores the call camera and preserves the draft', async () => {
  const setEnabled = jest.fn(async () => undefined);
  await act(async () =>
    tree.update(
      <CallChat
        appointmentId="visit"
        client={client}
        visible
        onClose={jest.fn()}
        onUnread={jest.fn()}
        callCamera={{ enabled: true, setEnabled }}
      />,
    ),
  );
  await act(async () =>
    tree.root.findByType(TextInput).props.onChangeText('Keep me'),
  );
  jest.mocked(client.pick).mockRejectedValueOnce(new Error('Camera denied'));
  await press('Add attachment');
  await press('Camera');
  expect(setEnabled.mock.calls).toEqual([[false], [true]]);
  expect(tree.root.findByType(TextInput).props.value).toBe('Keep me');
  expect(
    tree.root.findAll(node => node.props.accessibilityRole === 'alert').length,
  ).toBeGreaterThan(0);
});

test('an unsuccessful send keeps the draft and retry key until the same message succeeds', async () => {
  jest
    .mocked(client.send)
    .mockRejectedValueOnce(new Error('Temporary connection failure'))
    .mockResolvedValueOnce({
      id: 'sent',
      sequence: '1',
      requestId: 'stable-retry',
      text: 'Hello',
      senderRole: 'dentist',
      own: true,
      createdAt: new Date().toISOString(),
      attachment: null,
    });
  await act(async () =>
    tree.root.findByType(TextInput).props.onChangeText('Hello'),
  );
  await press('Send chat message');
  expect(tree.root.findByType(TextInput).props.value).toBe('Hello');
  await press('Send chat message');
  expect(jest.mocked(client.send).mock.calls.map(call => call[1])).toEqual([
    { requestId: 'stable-retry', text: 'Hello', file: undefined },
    { requestId: 'stable-retry', text: 'Hello', file: undefined },
  ]);
  expect(tree.root.findByType(TextInput).props.value).toBe('');
});

test('a closed consultation keeps its history and disables sending and attachments', async () => {
  const read = jest.fn(async () => undefined);
  const closed: NativeChatClient = {
    ...client,
    read,
    list: jest.fn(async () => ({
      canSend: false,
      expiresAt: '2026-11-16T10:00:00Z',
      hasMore: false,
      items: [
        {
          id: 'history',
          sequence: '10',
          requestId: 'history',
          text: 'Saved advice',
          own: false,
          senderRole: 'patient' as const,
          createdAt: '2026-11-15T10:00:00Z',
          attachment: null,
        },
      ],
    })),
  };
  await act(async () =>
    tree.update(
      <CallChat
        appointmentId="closed-case"
        client={closed}
        visible
        title="Patient"
        onClose={jest.fn()}
        onUnread={jest.fn()}
      />,
    ),
  );
  expect(JSON.stringify(tree.toJSON())).toContain('Saved advice');
  expect(JSON.stringify(tree.toJSON())).toContain('Messaging closed');
  expect(tree.root.findByType(TextInput).props.editable).toBe(false);
  expect(read).toHaveBeenCalledWith(
    'closed-case',
    '10',
    expect.any(AbortSignal),
  );
  for (const label of ['Add attachment', 'Send chat message']) {
    expect(
      tree.root.findAll(
        node =>
          node.props.accessibilityLabel === label &&
          typeof node.props.onPress === 'function',
      )[0].props.disabled,
    ).toBe(true);
  }
  await press('Send chat message');
  expect(client.send).not.toHaveBeenCalled();
});

test('messages arriving while the phone is in the background stay unread until the chat is visible', async () => {
  let change: (state: 'active' | 'background') => void = () => undefined;
  const listener = jest
    .spyOn(AppState, 'addEventListener')
    .mockImplementation((_event, handler) => {
      change = handler;
      return { remove: jest.fn() };
    });
  const read = jest.fn(async () => undefined);
  const list = jest
    .fn()
    .mockResolvedValueOnce({ items: [], hasMore: false, canSend: true })
    .mockResolvedValue({
      items: [
        {
          id: 'new',
          sequence: '11',
          requestId: 'new',
          text: 'New message',
          own: false,
          senderRole: 'patient',
          createdAt: new Date().toISOString(),
          attachment: null,
        },
      ],
      hasMore: false,
      canSend: true,
    });
  const backgroundClient: NativeChatClient = { ...client, list, read };
  try {
    await act(async () => {
      tree.unmount();
      tree = Renderer.create(
        <CallChat
          appointmentId="background-case"
          client={backgroundClient}
          visible
          onClose={jest.fn()}
          onUnread={jest.fn()}
        />,
      );
    });
    await act(async () => change('background'));
    await act(async () => {
      jest.advanceTimersByTime(2000);
    });
    expect(read).not.toHaveBeenCalled();
    await act(async () => change('active'));
    expect(read).toHaveBeenCalledWith(
      'background-case',
      '11',
      expect.any(AbortSignal),
    );
  } finally {
    listener.mockRestore();
  }
});

test('in-call chat keeps its modal presentation', () => {
  expect(tree.root.findAllByType(Modal)).toHaveLength(1);
  expect(tree.root.findByType(Modal).props.animationType).toBe('slide');
});

test('a standalone conversation renders inline and its back icon returns to navigation', async () => {
  const onClose = jest.fn();
  await act(async () =>
    tree.update(
      <CallChat
        appointmentId="visit"
        client={client}
        visible
        presentation="screen"
        title="Patient"
        onClose={onClose}
        onUnread={jest.fn()}
      />,
    ),
  );
  expect(tree.root.findAllByType(Modal)).toHaveLength(0);
  await press('Back');
  expect(onClose).toHaveBeenCalledTimes(1);
});

test('loading conversation history never briefly labels an open conversation closed', async () => {
  let finish!: (page: ChatPage) => void;
  const pending: NativeChatClient = {
    ...client,
    list: jest.fn(
      () =>
        new Promise<ChatPage>(resolve => {
          finish = resolve;
        }),
    ),
  };
  await act(async () =>
    tree.update(
      <CallChat
        key="loading"
        appointmentId="loading"
        client={pending}
        visible
        presentation="screen"
        subtitle="Open for follow-up"
        onClose={jest.fn()}
        onUnread={jest.fn()}
      />,
    ),
  );
  expect(JSON.stringify(tree.toJSON())).toContain('Loading messages');
  expect(JSON.stringify(tree.toJSON())).not.toContain('Messaging closed');
  expect(tree.root.findByType(TextInput).props.editable).toBe(false);
  await act(async () => {
    finish({ items: [], hasMore: false, canSend: true });
  });
  expect(JSON.stringify(tree.toJSON())).toContain('Open for follow-up');
  expect(tree.root.findByType(TextInput).props.editable).toBe(true);
});

test('Android Back closes an inline attachment menu or photo before leaving the conversation', async () => {
  let hardwareBack!: Parameters<typeof BackHandler.addEventListener>[1];
  const listener = jest
    .spyOn(BackHandler, 'addEventListener')
    .mockImplementation((_event, callback) => {
      hardwareBack = callback;
      return { remove: jest.fn() };
    });
  const onClose = jest.fn();
  const photos: NativeChatClient = {
    ...client,
    list: jest.fn(
      async (): Promise<ChatPage> => ({
        canSend: true,
        hasMore: false,
        items: [
          {
            id: 'photo-message',
            sequence: '1',
            requestId: 'photo-message',
            text: '',
            own: false,
            senderRole: 'patient',
            createdAt: '2026-11-17T10:00:00Z',
            attachment: {
              id: 'photo',
              name: 'Photo.jpg',
              mimeType: 'image/jpeg',
              sizeBytes: 1024,
            },
          },
        ],
      }),
    ),
    download: jest.fn(async () => '/private/photo.jpg'),
  };
  try {
    await act(async () =>
      tree.update(
        <CallChat
          key="photo-screen"
          appointmentId="photos"
          client={photos}
          visible
          presentation="screen"
          onClose={onClose}
          onUnread={jest.fn()}
        />,
      ),
    );
    await press('Add attachment');
    await act(async () => {
      expect(
        hardwareBack({ type: 'hardwareBackPress', timeStamp: Date.now() }),
      ).toBe(true);
    });
    expect(
      tree.root.findAllByProps({ testID: 'chat-attachment-options' }),
    ).toHaveLength(0);
    expect(JSON.stringify(tree.toJSON())).toContain('View photo');
    const photoButton = tree.root.findAll(
      node =>
        node.props.accessibilityRole === 'button' &&
        typeof node.props.onPress === 'function' &&
        node.findAll(child => child.props.children === 'View photo').length > 0,
    )[0];
    await act(async () => {
      await photoButton.props.onPress();
    });
    expect(tree.root.findByType(Image).props.source.uri).toBe(
      'file:///private/photo.jpg',
    );
    await act(async () => {
      expect(
        hardwareBack({ type: 'hardwareBackPress', timeStamp: Date.now() }),
      ).toBe(true);
    });
    expect(tree.root.findAllByType(Image)).toHaveLength(0);
    expect(tree.root.findByType(TextInput)).toBeDefined();
    expect(onClose).not.toHaveBeenCalled();
    await press('Back');
    expect(onClose).toHaveBeenCalledTimes(1);
  } finally {
    listener.mockRestore();
  }
});
