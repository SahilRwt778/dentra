import Renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { ProfilePhotoPreview } from '../src/components/profile-photo-preview';
import { ProfileAvatar } from '../src/components/profile-avatar';

vi.mock('react-dom', () => ({ createPortal: (children: unknown) => children }));
let tree: ReactTestRenderer;
const showModal = vi.fn();
const focus = vi.fn();
const scrollTo = vi.fn();
class PreviousFocus {
  isConnected = true;
  focus = focus;
}
const body = { style: { overflow: 'auto' } };
const options = {
  createNodeMock: (element: { type: string }) =>
    element.type === 'dialog' ? { showModal } : { scrollTo },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('HTMLElement', PreviousFocus);
  vi.stubGlobal('document', { body, activeElement: new PreviousFocus() });
});
afterEach(async () => {
  await act(async () => tree?.unmount());
  vi.unstubAllGlobals();
});
async function open() {
  await act(async () => {
    tree = Renderer.create(
      <ProfilePhotoPreview name="Asha Mehra" uri="/profile-photos/one">
        <img src="/profile-photos/one" alt="Profile" />
      </ProfilePhotoPreview>,
      options,
    );
  });
  const event = { preventDefault: vi.fn(), stopPropagation: vi.fn() };
  await act(async () =>
    tree.root
      .findByProps({
        'aria-label': "View Asha Mehra's profile photo",
      })
      .props.onClick(event),
  );
  return event;
}
test('opens an independent full-screen dialog, zooms, and closes with Escape restoring focus and scroll', async () => {
  const event = await open();
  expect(event.preventDefault).toHaveBeenCalledOnce();
  expect(event.stopPropagation).toHaveBeenCalledOnce();
  expect(showModal).toHaveBeenCalledOnce();
  expect(body.style.overflow).toBe('hidden');
  const dialog = tree.root.findByType('dialog');
  expect(dialog.props['aria-modal']).toBe('true');
  expect(dialog.findByType('img').props.src).toBe('/profile-photos/one');
  await act(async () =>
    tree.root.findByProps({ 'aria-label': 'Zoom in' }).props.onClick(),
  );
  expect(dialog.findByType('img').props.style.width).toBe('150%');
  expect(scrollTo).toHaveBeenCalledWith(0, 0);
  await act(async () =>
    dialog.props.onCancel({
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    }),
  );
  expect(tree.root.findAllByType('dialog')).toHaveLength(0);
  expect(body.style.overflow).toBe('auto');
  expect(focus).toHaveBeenCalledOnce();
});
test('close button dismisses the photo and replacing or removing it dismisses the old viewer', async () => {
  await open();
  await act(async () =>
    tree.root
      .findByProps({ 'aria-label': 'Close profile photo' })
      .props.onClick(),
  );
  expect(tree.root.findAllByType('dialog')).toHaveLength(0);
  await act(async () =>
    tree.root
      .findByProps({ 'aria-label': "View Asha Mehra's profile photo" })
      .props.onClick({
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      }),
  );
  await act(async () =>
    tree.update(
      <ProfilePhotoPreview name="Asha Mehra" uri="/profile-photos/replacement">
        <span>Photo</span>
      </ProfilePhotoPreview>,
    ),
  );
  expect(tree.root.findAllByType('dialog')).toHaveLength(0);
  await act(async () =>
    tree.update(
      <ProfilePhotoPreview>
        <span>AM</span>
      </ProfilePhotoPreview>,
    ),
  );
  expect(tree.root.findAllByType('button')).toHaveLength(0);
});
test('missing or failed avatars retain initials without a preview button', async () => {
  await act(async () => {
    tree = Renderer.create(<ProfileAvatar name="Asha Mehra" />, options);
  });
  expect(tree.root.findAllByType('button')).toHaveLength(0);
  await act(async () => {
    tree.update(
      <ProfileAvatar name="Asha Mehra" photoUrl="/profile-photos/broken" />,
    );
  });
  await act(async () => tree.root.findByType('img').props.onError());
  expect(tree.root.findAllByType('button')).toHaveLength(0);
  expect(JSON.stringify(tree.toJSON())).toContain('AM');
});
