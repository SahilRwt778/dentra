import { createPortal } from 'react-dom';
import { useEffect, useRef, useState } from 'react';
import { FileText, MessageCircle, Paperclip, Send, X } from 'lucide-react';
import { useCallChat, type ChatAttachment } from '@dentra/call-core';
import { callChat, downloadChatAttachment } from '@/api/call-chat';

export function CallChat({
  appointmentId,
  target,
  open,
  onClose,
  onUnread,
}: {
  appointmentId: string;
  target: HTMLElement | null;
  open: boolean;
  onClose(): void;
  onUnread(count: number): void;
}) {
  const chat = useCallChat(appointmentId, callChat, open);
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
  const files = useRef(new Set<string>());
  const previewUrl = useRef<string | undefined>(undefined);
  const request = useRef<AbortController | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const tail = chat.items.at(-1)?.sequence;
  useEffect(() => {
    onUnread(chat.unread);
  }, [chat.unread, onUnread]);
  useEffect(() => {
    if (open) end.current?.scrollIntoView({ block: 'end' });
  }, [tail, open]);
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
    []
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
        abort.signal
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
            : 'Could not open this attachment.'
        );
    } finally {
      if (!abort.signal.aborted) setOpening(undefined);
    }
  }
  return target
    ? createPortal(
        <>
          <aside
            hidden={!open}
            className="call-chat"
            aria-label="Consultation chat"
          >
            <header className="call-chat-header">
              <strong>
                <MessageCircle size={18} /> Consultation chat
              </strong>
              <button
                type="button"
                className="btn btn-icon"
                aria-label="Close chat"
                onClick={onClose}
              >
                <X size={18} />
              </button>
            </header>
            <div className="call-chat-messages" aria-live="polite">
              {chat.hasOlder && (
                <button
                  type="button"
                  className="btn"
                  onClick={() => void chat.older()}
                >
                  Earlier messages
                </button>
              )}
              {chat.loading && <p>Loading messages…</p>}
              {!chat.loading && !chat.items.length && (
                <p className="muted">
                  Messages, photos and PDF reports shared during your
                  consultation appear here.
                </p>
              )}
              {chat.items.map((item) => (
                <article
                  key={item.id}
                  className={`call-chat-bubble ${item.own ? 'is-own' : ''}`}
                >
                  <small>
                    {item.own
                      ? 'You'
                      : item.senderRole === 'dentist'
                      ? 'Dentist'
                      : 'Patient'}
                  </small>
                  {!!item.text && <p>{item.text}</p>}
                  {item.attachment && (
                    <button
                      type="button"
                      className="call-chat-file"
                      onClick={() => void attachment(item.attachment!)}
                      disabled={!!opening}
                    >
                      <FileText size={19} />
                      <span>
                        {opening === item.id
                          ? 'Opening…'
                          : item.attachment.name}
                        <small>
                          {Math.ceil(item.attachment.sizeBytes / 1024)} KB ·{' '}
                          {item.attachment.mimeType.startsWith('image/')
                            ? 'Photo'
                            : 'PDF'}
                        </small>
                      </span>
                    </button>
                  )}
                  <time>
                    {new Date(item.createdAt).toLocaleTimeString(undefined, {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </time>
                </article>
              ))}
              <div ref={end} />
            </div>
            {!!(chat.error || notice) && (
              <p role="alert" className="call-chat-error">
                {chat.error || notice}
              </p>
            )}
            <form
              className="call-chat-composer"
              onSubmit={(event) => {
                event.preventDefault();
                void send();
              }}
            >
              {file && (
                <div className="call-chat-preview">
                  {preview ? (
                    <img src={preview} alt="Attachment preview" />
                  ) : (
                    <FileText />
                  )}
                  <span>{file.name}</span>
                  <button
                    type="button"
                    aria-label="Remove attachment"
                    className="call-chat-remove"
                    disabled={chat.sending}
                    onClick={() => {
                      chooseFile(undefined);
                      setKey(crypto.randomUUID());
                    }}
                  >
                    <X size={16} />
                  </button>
                </div>
              )}
              <textarea
                aria-label="Chat message"
                placeholder="Write a message…"
                maxLength={4000}
                value={text}
                disabled={chat.sending}
                onChange={(event) => {
                  setText(event.target.value);
                  setKey(crypto.randomUUID());
                }}
              />
              <div className="call-chat-actions">
                <label className="btn">
                  <Paperclip size={17} /> Photo / PDF
                  <input
                    type="file"
                    accept="image/jpeg,image/png,application/pdf"
                    disabled={chat.sending}
                    onChange={(event) => {
                      const selected = event.target.files?.[0];
                      event.target.value = '';
                      if (!selected) return;
                      if (
                        ![
                          'image/jpeg',
                          'image/png',
                          'application/pdf',
                        ].includes(selected.type) ||
                        selected.size > 10 * 1024 * 1024 ||
                        !selected.size
                      ) {
                        setNotice(
                          'Choose a JPEG/PNG photo or PDF no larger than 10 MB.'
                        );
                        return;
                      }
                      chooseFile(selected);
                      setKey(crypto.randomUUID());
                      setNotice(undefined);
                    }}
                  />
                </label>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={chat.sending || (!text.trim() && !file)}
                >
                  <Send size={17} />
                  {chat.sending ? 'Sending…' : 'Send'}
                </button>
              </div>
            </form>
          </aside>
          {viewer && (
            <div
              className="call-chat-viewer"
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
        </>,
        target
      )
    : null;
}
