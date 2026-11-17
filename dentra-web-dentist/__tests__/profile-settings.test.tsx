import Renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { ProfileSettings } from '../src/components/settings/profile-settings';

const mocks = vi.hoisted(() => ({ update: vi.fn(), toast: vi.fn() }));
let profile: {
  fullName: string;
  qualification: string;
  profilePhotoUrl: string | null;
};
vi.mock('../src/api/generated-api', () => ({
  useGetDentistsMeQuery: () => ({ data: profile }),
  usePatchDentistsMeMutation: () => [mocks.update, { isLoading: false }],
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: mocks.toast } }));

let tree: ReactTestRenderer;
const photo = new File(['synthetic photo'], 'profile.png', {
  type: 'image/png',
});
function button(label: string) {
  return tree.root
    .findAllByType('button')
    .find((node) => node.children.join('') === label)!;
}
async function click(label: string) {
  await act(async () => button(label).props.onClick());
}
async function select(file = photo) {
  await act(async () => {
    tree.root
      .findByProps({ 'aria-label': 'Choose profile photo' })
      .props.onChange({
        target: { files: [file], value: file.name },
      });
  });
}
async function save() {
  await act(async () => {
    await tree.root
      .findByType('form')
      .props.onSubmit({ preventDefault: vi.fn() });
  });
}
async function edit() {
  await act(async () => {
    tree = Renderer.create(<ProfileSettings />);
  });
  await click('Edit profile');
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:photo-preview');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  profile = {
    fullName: 'Dentist One',
    qualification: 'BDS',
    profilePhotoUrl: '/profile-photos/current',
  };
  mocks.update.mockImplementation(({ dentistSelfUpdate: body }) => ({
    unwrap: async () => {
      profile = {
        ...profile,
        profilePhotoUrl:
          body instanceof FormData ? '/profile-photos/replaced' : null,
      };
      return profile;
    },
  }));
});
afterEach(async () => {
  await act(async () => tree?.unmount());
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

test.each([null, '/profile-photos/current'])(
  'adds or replaces a profile photo only when the form is saved (previous: %s)',
  async (previous) => {
    profile.profilePhotoUrl = previous;
    await edit();
    await select();
    expect(tree.root.findByType('img').props.src).toBe('blob:photo-preview');
    expect(mocks.update).not.toHaveBeenCalled();
    await save();
    const body = mocks.update.mock.calls[0][0].dentistSelfUpdate as FormData;
    expect(body).toBeInstanceOf(FormData);
    expect(body.get('profilePhoto')).toEqual(photo);
    expect(JSON.parse(body.get('details') as string)).toMatchObject({
      qualification: 'BDS',
    });
    expect(tree.root.findAllByType('form')).toHaveLength(0);
    expect(tree.root.findByType('img').props.src).toContain(
      '/profile-photos/replaced',
    );
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:photo-preview');
  },
);

test('can undo or cancel photo removal, and only removes the saved photo on submit', async () => {
  await edit();
  const remove = () =>
    tree.root
      .findByProps({ 'aria-label': 'Remove profile photo' })
      .props.onClick();
  await act(async () => remove());
  expect(tree.root.findAllByType('img')).toHaveLength(0);
  expect(mocks.update).not.toHaveBeenCalled();
  await click('Undo photo change');
  expect(tree.root.findByType('img').props.src).toContain(
    '/profile-photos/current',
  );
  await act(async () => remove());
  await click('Cancel');
  expect(tree.root.findByType('img').props.src).toContain(
    '/profile-photos/current',
  );
  expect(mocks.update).not.toHaveBeenCalled();
  await click('Edit profile');
  await act(async () => remove());
  await save();
  expect(mocks.update.mock.calls[0][0].dentistSelfUpdate).toMatchObject({
    removeProfilePhoto: true,
  });
  expect(tree.root.findAllByType('img')).toHaveLength(0);
});

test('keeps a selected image available for retry if saving fails', async () => {
  mocks.update.mockReturnValue({
    unwrap: () =>
      Promise.reject({ data: { message: 'Could not save photo.' } }),
  });
  await edit();
  await select();
  await save();
  expect(mocks.toast).toHaveBeenCalledWith('Could not save photo.');
  expect(tree.root.findByType('img').props.src).toBe('blob:photo-preview');
  expect(tree.root.findAllByType('form')).toHaveLength(1);
  expect(profile.profilePhotoUrl).toBe('/profile-photos/current');
});

test('rejects a PDF or oversized image without replacing the current preview', async () => {
  await edit();
  for (const invalid of [
    new File(['pdf'], 'report.pdf', { type: 'application/pdf' }),
    new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'large.png', {
      type: 'image/png',
    }),
  ]) {
    await select(invalid);
    expect(
      tree.root.findByProps({ role: 'alert' }).children.join(''),
    ).toContain('up to 5 MB');
    expect(tree.root.findByType('img').props.src).toContain(
      '/profile-photos/current',
    );
  }
  expect(mocks.update).not.toHaveBeenCalled();
});
