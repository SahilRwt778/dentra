import Renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { CallChat } from '../src/components/call-chat';

const mocks = vi.hoisted(() => ({
  chat: {
    items: [],
    unread: 0,
    loading: false,
    canSend: true,
    sending: false,
    error: undefined,
    hasOlder: false,
    older: vi.fn(),
    sendMany: vi.fn(),
    dismissError: vi.fn(),
  },
}));
vi.mock('@dentra/call-core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@dentra/call-core')>()),
  useCallChat: () => mocks.chat,
}));
vi.mock('../src/api/call-chat', () => ({
  callChat: {},
  downloadChatAttachment: vi.fn(),
}));
vi.mock('../src/components/messages/chat-timeline', () => ({
  ChatTimeline: () => null,
}));

let tree: ReactTestRenderer;
let nextId = 0;
const files = [1, 2, 3].map(
  (index) =>
    new File(['synthetic'], `Photo-${index}.jpg`, { type: 'image/jpeg' }),
);
async function choose(selected: File[]) {
  await act(async () =>
    tree.root
      .findByProps({ 'aria-label': 'Choose chat photo' })
      .props.onChange({
        target: { files: selected, value: 'chosen' },
      }),
  );
}
beforeEach(async () => {
  vi.clearAllMocks();
  nextId = 0;
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('crypto', { randomUUID: () => `request-${++nextId}` });
  const document = {
    visibilityState: 'visible',
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
  vi.stubGlobal('document', document);
  vi.stubGlobal('window', { document });
  vi.spyOn(URL, 'createObjectURL').mockImplementation(
    () => `blob:photo-${++nextId}`,
  );
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
  await act(async () => {
    tree = Renderer.create(
      <CallChat
        appointmentId="visit"
        open
        embedded
        onClose={vi.fn()}
        onUnread={vi.fn()}
      />,
    );
  });
});
afterEach(async () => {
  await act(async () => tree?.unmount());
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

test('three photos are previewed, individually removable, and sent together with the caption only once', async () => {
  expect(
    tree.root.findByProps({ 'aria-label': 'Choose chat photo' }).props.multiple,
  ).toBe(true);
  expect(
    tree.root.findByProps({ 'aria-label': 'Add attachment' }).props.className,
  ).toBe('chat-attach-button');
  await choose(files);
  expect(tree.root.findAllByType('img')).toHaveLength(3);
  expect(
    tree.root.findByProps({ 'aria-label': 'Add attachment' }).props.disabled,
  ).toBe(true);
  await act(async () =>
    tree.root
      .findByProps({ 'aria-label': 'Remove attachment: Photo-2.jpg' })
      .props.onClick(),
  );
  expect(tree.root.findAllByType('img')).toHaveLength(2);
  expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
  await choose([files[1]]);
  const preview = tree.root.findAllByType('img')[0];
  await act(async () =>
    tree.root
      .findByType('textarea')
      .props.onChange({ target: { value: 'My photos' } }),
  );
  expect(tree.root.findAllByType('img')[0]).toBe(preview);
  mocks.chat.sendMany.mockResolvedValueOnce(1);
  await act(async () =>
    tree.root.findByType('form').props.onSubmit({ preventDefault: vi.fn() }),
  );
  const first = mocks.chat.sendMany.mock.calls[0][0];
  expect(first).toHaveLength(3);
  expect(first.map((draft: { text: string }) => draft.text)).toEqual([
    'My photos',
    '',
    '',
  ]);
  expect(tree.root.findAllByType('img')).toHaveLength(2);
  expect(tree.root.findByType('textarea').props.value).toBe('');
  mocks.chat.sendMany.mockResolvedValueOnce(2);
  await act(async () =>
    tree.root.findByType('form').props.onSubmit({ preventDefault: vi.fn() }),
  );
  expect(mocks.chat.sendMany.mock.calls[1][0]).toEqual(first.slice(1));
  expect(tree.root.findAllByType('img')).toHaveLength(0);
});

test('an over-limit selection preserves the draft and its warning has an X to dismiss it', async () => {
  await choose([files[0]]);
  await choose(files);
  expect(tree.root.findAllByType('img')).toHaveLength(1);
  expect(JSON.stringify(tree.toJSON())).toContain('up to 3');
  await act(async () =>
    tree.root.findByProps({ 'aria-label': 'Dismiss warning' }).props.onClick(),
  );
  expect(JSON.stringify(tree.toJSON())).not.toContain('up to 3');
  expect(tree.root.findAllByType('img')).toHaveLength(1);
});
