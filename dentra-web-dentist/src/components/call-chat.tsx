import { createPortal } from 'react-dom';
import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useCallChat, type ChatAttachment } from '@dentra/call-core';
import { callChat, downloadChatAttachment } from '@/api/call-chat';
import { ChatComposer } from './messages/chat-composer';
import { ChatHeader } from './messages/chat-header';
import { ChatTimeline } from './messages/chat-timeline';
import { ChatCameraCapture } from './chat-camera-capture';

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
  const [text, setText] = useState('');
  const [file, setFile] = useState<File>();
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [preview, setPreview] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [viewer, setViewer] = useState<{
    url: string;
    name: string;
    mime: string;
  }>();
  const [opening, setOpening] = useState<string>();
  const [cameraOpen, setCameraOpen] = useState(false);
  const files = useRef(new Set<string>());
  const previewUrl = useRef<string | undefined>(undefined);
  const request = useRef<AbortController | null>(null);
  useEffect(() => {
    onUnread(chat.unread);
  }, [chat.unread, onUnread]);
  useEffect(() => {
    if (!open) setCameraOpen(false);
  }, [open]);
  function selectAttachment(selected: File) {
    if (chat.sending) return;
    if (
      !['image/jpeg', 'image/png', 'application/pdf'].includes(selected.type) ||
      selected.size > 10 * 1024 * 1024 ||
      !selected.size
    ) {
      setNotice('Choose a JPEG/PNG photo or PDF no larger than 10 MB.');
      return;
    }
    chooseFile(selected);
    setKey(crypto.randomUUID());
    setNotice(undefined);
  }
  function chooseFile(selected?: File) {
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    const url = selected?.type.startsWith('image/')
      ? URL.createObjectURL(selected)
      : undefined;
    previewUrl.current = url;
    setPreview(url);
    setFile(selected);
  }
  useEffect(
    () => () => {
      request.current?.abort();
      if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
      files.current.forEach((url) => URL.revokeObjectURL(url));
    },
    [],
  );
  async function send() {
    if (await chat.send({ requestId: key, text, file })) {
      setText('');
      chooseFile(undefined);
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
      const blob = await downloadChatAttachment(
        appointmentId,
        item.id,
        abort.signal,
      );
      if (abort.signal.aborted) return;
      if (blob.size !== item.sizeBytes || blob.type !== item.mimeType)
        throw new Error('The attachment is incomplete.');
      const url = URL.createObjectURL(blob);
      files.current.add(url);
      setViewer({ url, name: item.name, mime: item.mimeType });
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
          embedded={embedded}
          onOlder={() => void chat.older()}
          onAttachment={(item) => void attachment(item)}
        />
        {!!(chat.error || notice) && (
          <p role="alert" className="call-chat-error">
            {chat.error || notice}
          </p>
        )}
        <ChatComposer
          text={text}
          file={file}
          preview={preview}
          sending={chat.sending}
          canSend={open && chat.canSend}
          loading={chat.loading}
          embedded={embedded}
          onText={(value) => {
            setText(value);
            setKey(crypto.randomUUID());
          }}
          onSelect={selectAttachment}
          onCamera={() => {
            setNotice(undefined);
            setCameraOpen(true);
          }}
          onRemove={() => {
            chooseFile(undefined);
            setKey(crypto.randomUUID());
          }}
          onSend={() => void send()}
        />
      </aside>
      {cameraOpen && open && (
        <ChatCameraCapture
          sourceTrack={cameraTrack}
          onCapture={(selected) => {
            selectAttachment(selected);
            setCameraOpen(false);
          }}
          onClose={() => setCameraOpen(false)}
        />
      )}
      {viewer && open && (
        <div
          className={`call-chat-viewer ${
            embedded ? 'chat-viewer-fullscreen' : ''
          }`}
          role="dialog"
          aria-modal="true"
          aria-label="Chat attachment"
        >
          <header>
            <span>{viewer.name}</span>
            <a className="btn" href={viewer.url} download={viewer.name}>
              Download
            </a>
            <button
              type="button"
              className="call-chat-remove"
              aria-label="Close attachment"
              onClick={() => {
                URL.revokeObjectURL(viewer.url);
                files.current.delete(viewer.url);
                setViewer(undefined);
              }}
            >
              <X />
            </button>
          </header>
          {viewer.mime.startsWith('image/') ? (
            <img src={viewer.url} alt={viewer.name} />
          ) : (
            <iframe src={viewer.url} title={viewer.name} />
          )}
        </div>
      )}
    </div>
  );
  return embedded ? content : target ? createPortal(content, target) : null;
}
