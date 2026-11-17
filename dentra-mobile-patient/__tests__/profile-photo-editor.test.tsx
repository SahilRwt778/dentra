import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import { ProfilePhotoEditor } from '../src/components/profile-photo-editor';
import { ProfilePhotoField } from '../src/components/profile-photo-field';
import { Button, ErrorState, TextLink } from '../src/components/ui';

const mockUpdate = jest.fn();
jest.mock('../src/api/patients', () => ({
  useUpdatePatientMutation: () => [mockUpdate, { isLoading: false }],
}));
const existing = '/profile-photos/patient/current';
const photo = {
  uri: 'file:///replacement.png',
  name: 'profile.png',
  type: 'image/png',
};
let tree: Renderer.ReactTestRenderer;
async function open(photoUrl?: string) {
  await act(async () => {
    tree = Renderer.create(<ProfilePhotoEditor photoUrl={photoUrl} />);
  });
  await press(photoUrl ? 'Change profile photo' : 'Add profile photo');
}
async function press(title: string) {
  const button = [
    ...tree.root.findAllByType(Button),
    ...tree.root.findAllByType(TextLink),
  ].find(node => node.props.title === title)!;
  await act(async () => {
    await button.props.onPress();
  });
}
function field() {
  return tree.root.findByType(ProfilePhotoField);
}
beforeEach(() => {
  jest.clearAllMocks();
  mockUpdate.mockResolvedValue({});
});
afterEach(async () => {
  await act(async () => tree?.unmount());
});

test.each([undefined, existing])(
  'adds or replaces a photo after login, only on Save (previous: %s)',
  async photoUrl => {
    await open(photoUrl);
    await act(async () => field().props.onChange(photo));
    expect(field().props.value).toEqual(photo);
    expect(mockUpdate).not.toHaveBeenCalled();
    await press('Save photo');
    expect(mockUpdate).toHaveBeenCalledWith({}, photo);
    expect(tree.root.findAllByType(ProfilePhotoField)).toHaveLength(0);
  },
);

test('can undo or cancel removal and sends removal only when saved', async () => {
  await open(existing);
  await act(async () => field().props.onRemoveExisting());
  expect(field().props.existingUrl).toBeNull();
  await press('Undo photo change');
  expect(field().props.existingUrl).toContain(existing);
  await act(async () => field().props.onRemoveExisting());
  await press('Cancel');
  expect(mockUpdate).not.toHaveBeenCalled();
  await press('Change profile photo');
  expect(field().props.existingUrl).toContain(existing);
  await act(async () => field().props.onRemoveExisting());
  await press('Save photo');
  expect(mockUpdate).toHaveBeenCalledWith({ removeProfilePhoto: true }, null);
});

test('preserves the selected photo on a failed save so it can be retried or cancelled', async () => {
  mockUpdate.mockRejectedValue({ data: { message: 'Could not save photo.' } });
  await open(existing);
  await act(async () => field().props.onChange(photo));
  await press('Save photo');
  expect(field().props.value).toEqual(photo);
  expect(tree.root.findByType(ErrorState).props.message).toBe(
    'Could not save photo.',
  );
  await press('Cancel');
  await press('Change profile photo');
  expect(field().props.value).toBeNull();
  expect(field().props.existingUrl).toContain(existing);
});
