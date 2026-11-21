import React from 'react';
import { Modal } from 'react-native';
import FastImage from 'react-native-fast-image';
import Renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { ProfileAvatar } from '@dentra/video/src/ProfileAvatar';
import { Avatar } from '../src/components/ui';

const photo = '/profile-photos/one?signature=test';
let tree: ReactTestRenderer;
afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
});

test.each(['profile', 'conversation'])(
  '%s avatar opens the full image without opening its parent card and closes with Back',
  async kind => {
    await act(async () => {
      tree = Renderer.create(
        kind === 'profile' ? (
          <Avatar name="Asha Mehra" photoUrl={photo} />
        ) : (
          <ProfileAvatar
            name="Asha Mehra"
            photoUrl={photo}
            apiBaseUrl="https://api.example.test"
          />
        ),
      );
    });
    expect(tree.root.findAllByType(Modal)).toHaveLength(0);
    const stopPropagation = jest.fn();
    await act(async () =>
      tree.root
        .findByProps({
          accessibilityLabel: "View Asha Mehra's profile photo",
        })
        .props.onPress({ stopPropagation }),
    );
    expect(stopPropagation).toHaveBeenCalledTimes(1);
    expect(tree.root.findByType(Modal).props.presentationStyle).toBe(
      'fullScreen',
    );
    const image = tree.root
      .findAllByType(FastImage)
      .find(node => node.props.objectFit === 'contain');
    expect(image?.props.source.uri).toContain(photo);
    await act(async () =>
      tree.root.findByProps({ accessibilityLabel: 'Zoom in' }).props.onPress(),
    );
    expect(
      tree.root
        .findByProps({ accessibilityLabel: 'Zoom percentage' })
        .props.children.join(''),
    ).toBe('150%');
    await act(async () => tree.root.findByType(Modal).props.onRequestClose());
    expect(tree.root.findAllByType(Modal)).toHaveLength(0);
  },
);

test('initials and failed photos do not open a blank viewer', async () => {
  await act(async () => {
    tree = Renderer.create(<Avatar name="Asha Mehra" />);
  });
  expect(
    tree.root.findAllByProps({
      accessibilityLabel: "View Asha Mehra's profile photo",
    }),
  ).toHaveLength(0);
  await act(async () => {
    tree.update(<Avatar name="Asha Mehra" photoUrl={photo} />);
  });
  await act(async () => tree.root.findByType(FastImage).props.onError());
  expect(
    tree.root.findAllByProps({
      accessibilityLabel: "View Asha Mehra's profile photo",
    }),
  ).toHaveLength(0);
  expect(tree.root.findAllByType(Modal)).toHaveLength(0);
});
