import React from 'react';
import FastImage from 'react-native-fast-image';
import Renderer, { act } from 'react-test-renderer';
import { AppImage } from '@dentra/video/src/AppImage';

let tree: Renderer.ReactTestRenderer;
afterEach(async () => {
  await act(async () => tree?.unmount());
});

test('uses FastImage while preserving private image headers and server cache policy', async () => {
  const onError = jest.fn();
  const source = {
    uri: 'https://example.test/private-photo?signature=synthetic',
    headers: { Authorization: 'Bearer synthetic' },
  };
  await act(async () => {
    tree = Renderer.create(
      <AppImage
        source={source}
        onError={onError}
        accessibilityLabel="Profile photo"
      />,
    );
  });
  const image = tree.root.findByType(FastImage);
  expect(image.props.source).toEqual({ ...source, cache: 'web' });
  expect(image.props.objectFit).toBe('cover');
  expect(image.props.transition).toBe(false);
  expect(image.props.accessibilityLabel).toBe('Profile photo');
  const failure = { nativeEvent: { error: 'Synthetic image error' } };
  image.props.onError(failure);
  expect(onError).toHaveBeenCalledWith(failure);
});

test('resets a reused image when its URI changes so another user’s image cannot remain visible', async () => {
  await act(async () => {
    tree = Renderer.create(
      <AppImage source={{ uri: 'https://example.test/first-user.jpg' }} />,
    );
  });
  expect(tree.root.findByType(FastImage).props.recyclingKey).toBe(
    'https://example.test/first-user.jpg',
  );
  await act(async () => {
    tree.update(
      <AppImage source={{ uri: 'https://example.test/second-user.jpg' }} />,
    );
  });
  expect(tree.root.findByType(FastImage).props.recyclingKey).toBe(
    'https://example.test/second-user.jpg',
  );
});

test('keeps downloaded photo previews fitted and accepts local file URIs and bundled assets', async () => {
  await act(async () => {
    tree = Renderer.create(
      <AppImage
        source={{ uri: 'file:///private/photo.jpg' }}
        objectFit="contain"
      />,
    );
  });
  expect(tree.root.findByType(FastImage).props.source.uri).toBe(
    'file:///private/photo.jpg',
  );
  expect(tree.root.findByType(FastImage).props.objectFit).toBe('contain');
  await act(async () => {
    tree.update(<AppImage source={123} />);
  });
  expect(tree.root.findByType(FastImage).props.source).toBe(123);
});
