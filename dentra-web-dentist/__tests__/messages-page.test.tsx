import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { ConsultationCase } from '../src/api/generated-api';
import type { ChatMessage } from '@dentra/call-core';
import { MessagesPage } from '../src/pages/messages-page';
import { ChatComposer } from '../src/components/messages/chat-composer';

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  send: vi.fn(),
  refetch: vi.fn(),
}));
const cases: ConsultationCase[] = [
  {
    id: 'case-a',
    originalAppointmentId: 'visit-a',
    patientId: 'patient-a',
    dentistId: 'dentist',
    patientName: 'Asha Mehra',
    dentistName: 'Dentist',
    concern: 'Toothache',
    activatedAt: '2026-11-17T10:00:00Z',
    expiresAt: '2026-11-20T10:00:00Z',
    status: 'active',
    serverNow: '2026-11-17T11:00:00Z',
    canMessage: true,
    canBookFollowUp: false,
    unreadCount: 1,
    latestMessageAt: '2026-11-17T11:00:00Z',
  },
  {
    id: 'case-b',
    originalAppointmentId: 'visit-b',
    patientId: 'patient-b',
    dentistId: 'dentist',
    patientName: 'Rohan Shah',
    dentistName: 'Dentist',
    concern: 'Check-up',
    activatedAt: null,
    expiresAt: null,
    status: 'pending',
    serverNow: '2026-11-17T11:00:00Z',
    canMessage: false,
    canBookFollowUp: false,
    unreadCount: 0,
    latestMessageAt: '2026-11-16T10:00:00Z',
  },
];
vi.mock('../src/api/generated-api', () => ({
  useGetConsultationCasesQuery: () => ({
    currentData: { items: cases, unreadCount: 1, nextPage: null },
    refetch: mocks.refetch,
    isFetching: false,
  }),
  useGetConsultationCaseQuery: (
    { caseId }: { caseId?: string },
    { skip }: { skip: boolean },
  ) => ({
    currentData: skip ? undefined : cases.find((item) => item.id === caseId),
    refetch: mocks.refetch,
  }),
}));
vi.mock('../src/api/call-chat', () => ({
  callChat: { list: mocks.list, send: mocks.send },
  downloadChatAttachment: vi.fn(),
}));
let tree: ReactTestRenderer;
const saved: ChatMessage = {
  id: 'saved',
  sequence: '1',
  requestId: 'request',
  text: 'Hello',
  own: true,
  senderRole: 'dentist',
  createdAt: '2026-11-17T11:00:00Z',
  attachment: null,
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('document', {
    visibilityState: 'visible',
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
  mocks.list.mockResolvedValue({ items: [], hasMore: false, canSend: true });
  mocks.send.mockResolvedValue(saved);
});
afterEach(async () => {
  await act(async () => tree?.unmount());
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
async function mount(path = '/messages/case-a') {
  await act(async () => {
    tree = Renderer.create(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/messages" element={<MessagesPage />} />
          <Route path="/messages/:caseId" element={<MessagesPage />} />
        </Routes>
      </MemoryRouter>,
      {
        createNodeMock: (element) =>
          element.type === 'textarea'
            ? { style: {}, scrollHeight: 44 }
            : element.type === 'div'
            ? { scrollTop: 0, scrollHeight: 300, clientHeight: 400 }
            : null,
      },
    );
  });
}
test('the conversation stays inline beside the list and Back returns to the inbox', async () => {
  await mount();
  expect(
    tree.root.findByProps({ 'aria-label': 'Conversations' }),
  ).toBeDefined();
  expect(
    tree.root.findByProps({ 'aria-label': 'Consultation chat' }).props
      .className,
  ).toContain('is-embedded');
  expect(tree.root.findAllByProps({ 'aria-label': 'Close chat' })).toHaveLength(
    0,
  );
  await act(async () =>
    tree.root
      .findByProps({ 'aria-label': 'Back to conversations' })
      .props.onClick(),
  );
  expect(
    tree.root.findAllByProps({ 'aria-label': 'Consultation chat' }),
  ).toHaveLength(0);
  expect(JSON.stringify(tree.toJSON())).toContain(
    'Your consultation conversations',
  );
});
test('search and the unread filter help find a patient conversation', async () => {
  await mount('/messages');
  const links = () =>
    tree.root.findAllByType('a').map((node) => node.props.href);
  expect(links()).toEqual(['/messages/case-a', '/messages/case-b']);
  await act(async () =>
    tree.root
      .findByProps({ 'aria-label': 'Search conversations on this page' })
      .props.onChange({ target: { value: 'Rohan' } }),
  );
  expect(links()).toEqual(['/messages/case-b']);
  await act(async () =>
    tree.root.findByProps({ 'aria-label': 'Clear search' }).props.onClick(),
  );
  await act(async () =>
    tree.root
      .findAllByType('button')
      .find((node) => node.children.includes('Unread'))!
      .props.onClick(),
  );
  expect(links()).toEqual(['/messages/case-a']);
});
test('Enter sends a message while Shift+Enter leaves room for a newline', async () => {
  await mount();
  await act(async () =>
    tree.root
      .findByType('textarea')
      .props.onChange({ target: { value: 'Hello' } }),
  );
  const preventDefault = vi.fn();
  await act(async () =>
    tree.root
      .findByType('textarea')
      .props.onKeyDown({
        key: 'Enter',
        shiftKey: true,
        nativeEvent: { isComposing: false },
        preventDefault,
      }),
  );
  expect(mocks.send).not.toHaveBeenCalled();
  expect(preventDefault).not.toHaveBeenCalled();
  await act(async () =>
    tree.root
      .findByType('textarea')
      .props.onKeyDown({
        key: 'Enter',
        shiftKey: false,
        nativeEvent: { isComposing: false },
        preventDefault,
      }),
  );
  expect(mocks.send).toHaveBeenCalledWith(
    'visit-a',
    expect.objectContaining({ text: 'Hello' }),
    expect.any(AbortSignal),
  );
  expect(tree.root.findByType('textarea').props.value).toBe('');
});
test('closed conversations show history with a read-only footer and no composer', async () => {
  mocks.list.mockResolvedValue({
    items: [saved],
    hasMore: false,
    canSend: false,
  });
  await mount();
  expect(tree.root.findAllByType('textarea')).toHaveLength(0);
  expect(JSON.stringify(tree.toJSON())).toContain(
    'This conversation is read-only',
  );
  expect(JSON.stringify(tree.toJSON())).toContain('Hello');
});
test('IME composition does not send a partial message', async () => {
  const onSend = vi.fn();
  await act(async () => {
    tree = Renderer.create(
      <ChatComposer
        text="Draft"
        sending={false}
        canSend
        loading={false}
        embedded
        onText={vi.fn()}
        onSelect={vi.fn()}
        onCamera={vi.fn()}
        onRemove={vi.fn()}
        onSend={onSend}
      />,
    );
  });
  await act(async () =>
    tree.root
      .findByType('textarea')
      .props.onKeyDown({
        key: 'Enter',
        shiftKey: false,
        nativeEvent: { isComposing: true },
        preventDefault: vi.fn(),
      }),
  );
  expect(onSend).not.toHaveBeenCalled();
});
