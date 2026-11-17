import Renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { CreateDentistDialog } from '../src/components/create-dentist-dialog';
import { AdminProfileCard } from '../src/components/admin-profile-card';

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  error: vi.fn(),
}));
const profile = {
  name: 'Admin',
  email: 'admin@example.test',
  phone: '+919876543210',
  version: 1,
};
vi.mock('../src/api/generated-api', () => ({
  usePostAdminDentistsMutation: () => [mocks.create, { isLoading: false }],
  useGetAdminMeQuery: () => ({ data: profile }),
  usePatchAdminMeMutation: () => [mocks.update, { isLoading: false }],
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: mocks.error } }));
vi.mock('../src/components/modal', () => ({
  Modal: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? children : null,
}));
let tree: ReactTestRenderer;
const phone = () =>
  tree.root.findAllByType('input').find((node) => node.props.type === 'tel')!;
async function click(label: string) {
  const button = tree.root.findAllByType('button').find(
    (node) =>
      node.children
        .filter((child) => typeof child === 'string')
        .join('')
        .trim() === label,
  )!;
  await act(async () => button.props.onClick());
}
async function type(value: string) {
  await act(async () => phone().props.onChange({ target: { value } }));
}
async function submit() {
  await act(async () => {
    await tree.root
      .findByType('form')
      .props.onSubmit({ preventDefault: vi.fn() });
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  mocks.create.mockReturnValue({
    unwrap: () =>
      Promise.resolve({ fullName: 'Dentist', status: 'pending_review' }),
  });
  mocks.update.mockReturnValue({ unwrap: () => Promise.resolve(profile) });
});
afterEach(async () => {
  await act(async () => tree?.unmount());
  vi.unstubAllGlobals();
});

test('admin-created dentist mobile input removes letters, caps digits, and validates before sending E.164', async () => {
  await act(async () => {
    tree = Renderer.create(<CreateDentistDialog />);
  });
  await click('Add dentist');
  await type('ab9876');
  expect(phone().props.value).toBe('9876');
  expect(phone().props.maxLength).toBe(10);
  await submit();
  expect(mocks.create).not.toHaveBeenCalled();
  await type('98765abc432109999');
  expect(phone().props.value).toBe('9876543210');
  await submit();
  expect(mocks.create.mock.calls[0][0].adminCreateDentist.mobile).toBe(
    '+919876543210',
  );
});

test('admin profile displays a saved country-coded phone as ten digits and validates changes', async () => {
  await act(async () => {
    tree = Renderer.create(<AdminProfileCard />);
  });
  await click('Edit');
  expect(phone().props.value).toBe('9876543210');
  await type('abc123');
  await submit();
  expect(mocks.update).not.toHaveBeenCalled();
  expect(tree.root.findByProps({ role: 'alert' }).children.join('')).toContain(
    '10-digit',
  );
  await type('9999abc000001234');
  expect(phone().props.value).toBe('9999000001');
  await submit();
  expect(mocks.update.mock.calls[0][0].adminProfileUpdate.phone).toBe(
    '+919999000001',
  );
});

test('an optional admin phone can be cleared without sending an incomplete country code', async () => {
  await act(async () => {
    tree = Renderer.create(<AdminProfileCard />);
  });
  await click('Edit');
  await type('');
  await submit();
  expect(mocks.update.mock.calls[0][0].adminProfileUpdate.phone).toBeNull();
});
