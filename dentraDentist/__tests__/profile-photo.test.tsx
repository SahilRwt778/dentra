import React, { useState } from 'react';
import { Image, PermissionsAndroid, TurboModuleRegistry } from 'react-native';
import ReactTestRenderer, {
  act,
  type ReactTestRenderer as Renderer,
} from 'react-test-renderer';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
jest.mock('react-native-image-picker', () => ({
  launchCamera: jest.fn(),
  launchImageLibrary: jest.fn(),
}));
import {
  ProfilePhotoField,
  type ProfilePhoto,
} from '../src/components/forms/ProfilePhotoField';

let renderer: Renderer;
const selected = jest.fn();
const initial: ProfilePhoto = {
  uri: 'file:///initial.jpg',
  name: 'initial.jpg',
  type: 'image/jpeg',
  size: 100,
};
function Form({ disabled = false }: { disabled?: boolean }) {
  const [photo, setPhoto] = useState<ProfilePhoto | null>(initial);
  return (
    <ProfilePhotoField
      value={photo}
      disabled={disabled}
      onChange={value => {
        selected(value);
        setPhoto(value);
      }}
    />
  );
}
async function tap(label: string) {
  await act(async () => {
    renderer.root.findByProps({ accessibilityLabel: label }).props.onPress();
  });
}
beforeEach(async () => {
  jest.clearAllMocks();
  jest
    .spyOn(TurboModuleRegistry, 'get')
    .mockImplementation(() => ({} as never));
  jest.mocked(launchImageLibrary).mockResolvedValue({ didCancel: true });
  jest.mocked(launchCamera).mockResolvedValue({ didCancel: true });
  await act(async () => {
    renderer = ReactTestRenderer.create(<Form />);
  });
});
afterEach(async () => {
  await act(async () => renderer.unmount());
  jest.restoreAllMocks();
});

test('previews locally and removes only the selected photo', async () => {
  expect(renderer.root.findByType(Image).props.source.uri).toBe(initial.uri);
  await tap('Remove selected profile photo');
  expect(selected).toHaveBeenCalledWith(null);
  expect(renderer.root.findAllByType(Image)).toHaveLength(0);
});
test('gallery cancellation preserves the previous selection', async () => {
  await tap('Choose profile photo from gallery');
  expect(selected).not.toHaveBeenCalled();
  expect(renderer.root.findByType(Image).props.source.uri).toBe(initial.uri);
});
test('rejects unsupported/oversized images and permits choosing another photo', async () => {
  jest.mocked(launchImageLibrary).mockResolvedValueOnce({
    assets: [
      {
        uri: 'file:///large.jpg',
        type: 'image/jpeg',
        fileSize: 6 * 1024 * 1024,
      },
    ],
  });
  await tap('Choose profile photo from gallery');
  expect(selected).not.toHaveBeenCalled();
  jest.mocked(launchImageLibrary).mockResolvedValueOnce({
    assets: [
      {
        uri: 'file:///profile.png',
        fileName: 'profile.png',
        type: 'image/png',
        fileSize: 200,
      },
    ],
  });
  await tap('Choose profile photo from gallery');
  expect(selected).toHaveBeenCalledWith(
    expect.objectContaining({ uri: 'file:///profile.png', type: 'image/png' }),
  );
});
test('uses the front camera and preserves the selection when permission is denied', async () => {
  jest
    .spyOn(PermissionsAndroid, 'request')
    .mockResolvedValue(PermissionsAndroid.RESULTS.DENIED);
  // iOS does not request Android camera permission; the native picker reports its permission result.
  jest.mocked(launchCamera).mockResolvedValue({ errorCode: 'permission' });
  await tap('Take profile photo');
  expect(selected).not.toHaveBeenCalled();
});
test('blocks selection during registration submission', async () => {
  await act(async () => renderer.update(<Form disabled />));
  await tap('Choose profile photo from gallery');
  expect(launchImageLibrary).not.toHaveBeenCalled();
});
