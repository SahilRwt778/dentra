import { createPortal } from 'react-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  createChatMediaLoader,
  useCallChat,
  type ChatAttachment,
  CHAT_ATTACHMENT_LIMIT,
} from '@dentra/call-core';
import { callChat, downloadChatAttachment } from '@/api/call-chat';
import {
  ChatComposer,
  type ChatComposerAttachment,
} from './messages/chat-composer';
import { DismissibleNotice } from './dismissible-notice';
import { ChatHeader } from './messages/chat-header';
import { ChatTimeline } from './messages/chat-timeline';
import { ChatCameraCapture } from './chat-camera-capture';
import {
  ChatAttachmentViewer,
  type ChatViewerFile,
} from './messages/chat-attachment-viewer';

export function CallChat({
  appointmentId,
  target,
  open,
  onClose,
  onUnread,
  cameraTrack,
  title = 'Consultation chat',
  subtitle,
  embedded = false,
  concern,
  photoUrl,
}: {
  title?: string;
  subtitle?: string;
  embedded?: boolean;
  concern?: string;
  photoUrl?: string | null;
  appointmentId: string;
  target?: HTMLElement | null;
  open: boolean;
  onClose(): void;
  onUnread(count: number): void;
  cameraTrack?: MediaStreamTrack;
}) {
  const [foreground, setForeground] = useState(
    document.visibilityState !== 'hidden',
  );
  useEffect(() => {
    const update = () => setForeground(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);
  const chat = useCallChat(appointmentId, callChat, open && foreground);
  const media = useMemo(
    () =>
      createChatMediaLoader(async (file, signal) => {
        if (!open)
          throw new Error('Open the conversation to view attachments.');
        const blob = await downloadChatAttachment(
          appointmentId,
          file.id,
          signal,
        );
        if (blob.size !== file.sizeBytes || blob.type !== file.mimeType)
          throw new Error('The attachment is incomplete. Please retry.');
        const uri = URL.createObjectURL(blob);
        return { uri, dispose: () => URL.revokeObjectURL(uri) };
      }),
    [appointmentId, open],
  );
  useEffect(() => () => media.clear(), [media]);
  const [text, setText] = useState('');
  const [files, setFiles] = useState<ChatComposerAttachment[]>([]);
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [notice, setNotice] = useState<string>();
  const [viewer, setViewer] = useState<ChatViewerFile>();
  const [opening, setOpening] = useState<string>();
  const [cameraOpen, setCameraOpen] = useState(false);
  const queuedFiles = useRef<ChatComposerAttachment[]>([]);
  const request = useRef<AbortController | null>(null);
  useEffect(() => {
    onUnread(chat.unread);
  }, [chat.unread, onUnread]);
  useEffect(() => {
    request.current?.abort();
    setViewer(undefined);
    setOpening(undefined);
    if (!open) setCameraOpen(false);
  }, [open, appointmentId]);
  function selectAttachments(selected: File[]) {
    if (chat.sending) return;
    if (queuedFiles.current.length + selected.length > CHAT_ATTACHMENT_LIMIT) {
      setNotice(
        `You can send up to ${CHAT_ATTACHMENT_LIMIT} attachments at a time. Remove one to choose another.`,
      );
      return;
    }
    if (
      selected.some(
        (file) =>
          !['image/jpeg', 'image/png', 'application/pdf'].includes(file.type) ||
          file.size > 10 * 1024 * 1024 ||
          !file.size,
      )
    ) {
      setNotice('Choose a JPEG/PNG photo or PDF no larger than 10 MB.');
      return;
    }
    updateFiles([
      ...queuedFiles.current,
      ...selected.map((file) => ({
        id: crypto.randomUUID(),
        requestId: crypto.randomUUID(),
        file,
        preview: file.type.startsWith('image/')
          ? URL.createObjectURL(file)
          : undefined,
      })),
    ]);
    setKey(crypto.randomUUID());
    setNotice(undefined);
  }
  function updateFiles(next: ChatComposerAttachment[]) {
    for (const previous of queuedFiles.current) {
      if (
        previous.preview &&
        !next.some((entry) => entry.preview === previous.preview)
      )
        URL.revokeObjectURL(previous.preview);
    }
    queuedFiles.current = next;
    setFiles(next);
  }
  useEffect(
    () => () => {
      request.current?.abort();
      for (const entry of queuedFiles.current) {
        if (entry.preview) URL.revokeObjectURL(entry.preview);
      }
    },
    [],
  );
  async function send() {
    const sent = await chat.sendMany(
      files.length
        ? files.map((entry, index) => ({
            requestId: entry.requestId,
            text: index === 0 ? text : '',
            file: entry.file,
          }))
        : [{ requestId: key, text }],
    );
    if (sent > 0) {
      setText('');
      updateFiles(queuedFiles.current.slice(sent));
      setKey(crypto.randomUUID());
    }
  }
  async function attachment(item: ChatAttachment) {
    request.current?.abort();
    const abort = new AbortController();
    request.current = abort;
    setOpening(item.id);
    setNotice(undefined);
    try {
      const { uri } = await media.load(item);
      if (abort.signal.aborted) return;
      setViewer({ url: uri, name: item.name, mime: item.mimeType });
    } catch (error) {
      if (!abort.signal.aborted)
        setNotice(
          error instanceof Error
            ? error.message
            : 'Could not open this attachment.',
        );
    } finally {
      if (!abort.signal.aborted) setOpening(undefined);
    }
  }
  const content = (
    <div className={embedded ? 'embedded-chat' : 'call-chat-surface'}>
      <aside
        hidden={!open}
        inert={cameraOpen || !!viewer}
        className={`call-chat ${embedded ? 'is-embedded' : ''}`}
        aria-label="Consultation chat"
      >
        <ChatHeader
          title={title}
          concern={concern}
          photoUrl={photoUrl}
          subtitle={subtitle}
          embedded={embedded}
          loading={chat.loading}
          canSend={chat.canSend}
          onBack={onClose}
        />
        <ChatTimeline
          items={chat.items}
          loading={chat.loading}
          hasOlder={chat.hasOlder}
          opening={opening}
          visible={open}
          media={media}
          embedded={embedded}
          onOlder={() => void chat.older()}
          onAttachment={(item) => void attachment(item)}
        />
        {!!(chat.error || notice) && (
          <DismissibleNotice
            className="call-chat-error"
            message={(notice || chat.error)!}
            onDismiss={() => {
              setNotice(undefined);
              chat.dismissError();
            }}
          />
        )}
        <ChatComposer
          text={text}
          files={files}
          sending={chat.sending}
          canSend={open && chat.canSend}
          loading={chat.loading}
          embedded={embedded}
          onText={(value) => {
            setText(value);
            setKey(crypto.randomUUID());
            updateFiles(
              queuedFiles.current.map((entry, index) =>
                index ? entry : { ...entry, requestId: crypto.randomUUID() },
              ),
            );
          }}
          onSelect={selectAttachments}
          onCamera={() => {
            setNotice(undefined);
            setCameraOpen(true);
          }}
          onRemove={(id) => {
            updateFiles(queuedFiles.current.filter((entry) => entry.id !== id));
            setKey(crypto.randomUUID());
          }}
          onSend={() => void send()}
        />
      </aside>
      {cameraOpen && open && (
        <ChatCameraCapture
          sourceTrack={cameraTrack}
          onCapture={(selected) => {
            selectAttachments([selected]);
            setCameraOpen(false);
          }}
          onClose={() => setCameraOpen(false)}
        />
      )}
      {viewer && open && (
        <ChatAttachmentViewer
          key={viewer.url}
          file={viewer}
          onClose={() => setViewer(undefined)}
        />
      )}
    </div>
  );
  return embedded ? content : target ? createPortal(content, target) : null;
}
