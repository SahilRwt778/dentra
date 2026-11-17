import React from 'react';
import Renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import FastImage from 'react-native-fast-image';
import { createChatMediaLoader, type ChatAttachment } from '@dentra/call-core';
import { ChatAttachment as AttachmentCard } from '@dentra/video/src/ChatAttachment';

let tree: ReactTestRenderer;
const file: ChatAttachment = {
  id: 'image',
  name: 'Dentist photo.jpg',
  mimeType: 'image/jpeg',
  sizeBytes: 1024,
};
afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
});

test('patient chat shows a protected photo inline using FastImage and opens it on tap', async () => {
  const download = jest.fn(async () => ({ uri: 'file:///private/photo.jpg' }));
  const loader = createChatMediaLoader(download);
  const open = jest.fn();
  await act(async () => {
    tree = Renderer.create(
      <AttachmentCard
        file={file}
        loader={loader}
        visible
        opening={false}
        onOpen={open}
      />,
    );
  });
  expect(tree.root.findByType(FastImage).props).toMatchObject({
    source: { uri: 'file:///private/photo.jpg', cache: 'web' },
    objectFit: 'contain',
  });
  const button = tree.root.findAll(
    node =>
      node.props.accessibilityLabel === 'View photo: Dentist photo.jpg' &&
      typeof node.props.onPress === 'function',
  )[0];
  await act(async () => button.props.onPress());
  expect(open).toHaveBeenCalledTimes(1);
  expect(download).toHaveBeenCalledTimes(1);
  loader.clear();
});

test('a preview failure offers a retry instead of a broken or text-only photo', async () => {
  const download = jest
    .fn()
    .mockRejectedValueOnce(new Error('Offline'))
    .mockResolvedValue({ uri: 'file:///private/retry.jpg' });
  const loader = createChatMediaLoader(download);
  await act(async () => {
    tree = Renderer.create(
      <AttachmentCard
        file={file}
        loader={loader}
        visible
        opening={false}
        onOpen={jest.fn()}
      />,
    );
  });
  const retry = tree.root.findAll(
    node =>
      node.props.accessibilityLabel === 'Retry photo: Dentist photo.jpg' &&
      typeof node.props.onPress === 'function',
  )[0];
  await act(async () => retry.props.onPress());
  expect(tree.root.findByType(FastImage).props.source.uri).toBe(
    'file:///private/retry.jpg',
  );
  expect(download).toHaveBeenCalledTimes(2);
  loader.clear();
});
