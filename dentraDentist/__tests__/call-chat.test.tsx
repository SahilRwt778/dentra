import React from 'react';
import Renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { Image, TextInput, StyleSheet } from 'react-native';
import { CallChat, type NativeChatClient } from '@dentra/video/src/CallChat';

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
