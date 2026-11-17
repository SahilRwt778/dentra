import { Fragment, useEffect, useLayoutEffect, useRef } from 'react';
import { Check, MessageCircle } from 'lucide-react';
import type {
  ChatAttachment,
  ChatMessage,
  ChatMediaLoader,
} from '@dentra/call-core';
import { ChatAttachment as AttachmentCard } from './chat-attachment';

export function ChatTimeline({
  items,
  loading,
  hasOlder,
  opening,
  visible,
  media,
  embedded,
  onOlder,
  onAttachment,
}: {
  items: ChatMessage[];
  loading: boolean;
  hasOlder: boolean;
  opening?: string;
  visible: boolean;
  media: ChatMediaLoader;
  embedded: boolean;
  onOlder(): void;
  onAttachment(attachment: ChatAttachment): void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const follow = useRef(true);
  const history = useRef<{ height: number; top: number } | null>(null);
  const tail = items.at(-1)?.id;
  const first = items[0]?.id;
  useLayoutEffect(() => {
    if (!visible || !container.current) return;
    follow.current = true;
    history.current = null;
    container.current.scrollTop = container.current.scrollHeight;
  }, [tail, visible]);
  useLayoutEffect(() => {
    const node = container.current,
      anchor = history.current;
    if (!node || !anchor) return;
    node.scrollTop = anchor.top + node.scrollHeight - anchor.height;
    history.current = null;
  }, [first]);
  useEffect(() => {
    if (!visible || !container.current || typeof ResizeObserver === 'undefined')
      return;
    const node = container.current;
    const observer = new ResizeObserver(() => {
      if (follow.current) node.scrollTop = node.scrollHeight;
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [visible]);
  return (
    <div
      ref={container}
      className="call-chat-messages"
      role="log"
      aria-label="Conversation messages"
      aria-relevant="additions text"
      onScroll={(event) => {
        const node = event.currentTarget;
        follow.current =
          node.scrollHeight - node.scrollTop - node.clientHeight < 100;
      }}
    >
      {hasOlder && (
        <button
          type="button"
          className="chat-earlier"
          onClick={() => {
            const node = container.current;
            if (node)
              history.current = {
                height: node.scrollHeight,
                top: node.scrollTop,
              };
            follow.current = false;
            onOlder();
          }}
        >
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
              {item.attachment && (
                <AttachmentCard
                  file={item.attachment}
                  loader={media}
                  visible={visible}
                  opening={opening === item.attachment.id}
                  onOpen={() => onAttachment(item.attachment!)}
                />
              )}
              {!!item.text && <p>{item.text}</p>}
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
