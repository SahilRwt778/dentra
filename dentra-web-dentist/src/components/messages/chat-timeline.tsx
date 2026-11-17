import { Fragment, useEffect, useRef } from 'react';
import { Check, FileText, ImageIcon, MessageCircle } from 'lucide-react';
import type { ChatAttachment, ChatMessage } from '@dentra/call-core';

export function ChatTimeline({
  items,
  loading,
  hasOlder,
  opening,
  visible,
  embedded,
  onOlder,
  onAttachment,
}: {
  items: ChatMessage[];
  loading: boolean;
  hasOlder: boolean;
  opening?: string;
  visible: boolean;
  embedded: boolean;
  onOlder(): void;
  onAttachment(attachment: ChatAttachment): void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const tail = items.at(-1)?.id;
  const ownLast = items.at(-1)?.own;
  useEffect(() => {
    if (visible && container.current && (atBottom.current || ownLast)) {
      container.current.scrollTop = container.current.scrollHeight;
    }
  }, [tail, visible, ownLast]);
  return (
    <div
      ref={container}
      className="call-chat-messages"
      role="log"
      aria-label="Conversation messages"
      aria-relevant="additions text"
      onScroll={(event) => {
        const node = event.currentTarget;
        atBottom.current =
          node.scrollHeight - node.scrollTop - node.clientHeight < 100;
      }}
    >
      {hasOlder && (
        <button type="button" className="chat-earlier" onClick={onOlder}>
          Earlier messages
        </button>
      )}
      {loading && <p className="chat-loading">Loading messages…</p>}
      {!loading && !items.length && (
        <div className="chat-empty-thread">
          <MessageCircle size={28} />
          <strong>Start the conversation</strong>
          <p>
            Messages, photos and reports shared with your patient will appear
            here.
          </p>
        </div>
      )}
      {items.map((item, index) => {
        const showDate =
          index === 0 ||
          dayKey(item.createdAt) !== dayKey(items[index - 1].createdAt);
        const photo = item.attachment?.mimeType.startsWith('image/');
        return (
          <Fragment key={item.id}>
            {showDate && (
              <div className="chat-date-divider">
                <span>{dayLabel(item.createdAt)}</span>
              </div>
            )}
            <article className={`call-chat-bubble ${item.own ? 'is-own' : ''}`}>
              {!embedded && (
                <small>
                  {item.own
                    ? 'You'
                    : item.senderRole === 'dentist'
                    ? 'Dentist'
                    : 'Patient'}
                </small>
              )}
              {!!item.text && <p>{item.text}</p>}
              {item.attachment && (
                <button
                  type="button"
                  className="call-chat-file"
                  onClick={() => onAttachment(item.attachment!)}
                  disabled={!!opening}
                >
                  <span className={`chat-file-icon ${photo ? 'is-photo' : ''}`}>
                    {photo ? <ImageIcon size={23} /> : <FileText size={23} />}
                  </span>
                  <span className="chat-file-details">
                    <strong>
                      {opening === item.id
                        ? 'Opening…'
                        : photo
                        ? 'View photo'
                        : 'PDF report'}
                    </strong>
                    <span
                      className="chat-file-name"
                      title={item.attachment.name}
                    >
                      {item.attachment.name}
                    </span>
                    <small>
                      {Math.ceil(item.attachment.sizeBytes / 1024)} KB
                    </small>
                  </span>
                </button>
              )}
              <div className="chat-message-meta">
                <time dateTime={item.createdAt}>
                  {new Date(item.createdAt).toLocaleTimeString('en-IN', {
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </time>
                {item.own && <Check size={13} aria-label="Sent" />}
              </div>
            </article>
          </Fragment>
        );
      })}
    </div>
  );
}

function dayKey(value: string | Date) {
  return new Date(value).toDateString();
}
function dayLabel(value: string) {
  const now = new Date();
  if (dayKey(value) === dayKey(now)) return 'Today';
  now.setDate(now.getDate() - 1);
  if (dayKey(value) === dayKey(now)) return 'Yesterday';
  return new Date(value).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
