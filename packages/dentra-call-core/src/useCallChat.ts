import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatClient, ChatDraft, ChatMessage } from './chat-types';
import { CHAT_ATTACHMENT_LIMIT } from './chat-types';

function ordered(items: ChatMessage[]) {
  return [...new Map(items.map((item) => [item.id, item])).values()].sort(
    (a, b) =>
      a.sequence.length - b.sequence.length ||
      a.sequence.localeCompare(b.sequence),
  );
}
function message(error: unknown) {
  const failure = error as {
    data?: { message?: string | string[] };
    response?: { data?: { message?: string } };
    message?: string;
  };
  const text =
    failure.data?.message ?? failure.response?.data?.message ?? failure.message;
  return Array.isArray(text)
    ? text.join('. ')
    : text || 'Could not update the chat. Please try again.';
}
/** Durable HTTP history with a small polling fallback; no media session is recreated. */
export function useCallChat(
  appointmentId: string,
  client: ChatClient,
  visible: boolean,
) {
  const [items, setItems] = useState<ChatMessage[]>([]);
  const [unread, setUnread] = useState(0);
  const [hasOlder, setHasOlder] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string>();
  const [access, setAccess] = useState<{
    canSend?: boolean;
    expiresAt?: string | null;
  }>({});
  const latest = useRef<ChatMessage[]>([]);
  const loadedId = useRef<string | null>(null);
  const shown = useRef(visible);
  shown.current = visible;
  const controller = useRef<AbortController | null>(null);
  const locked = useRef(false);
  useEffect(() => {
    if (visible) setUnread(0);
  }, [visible]);
  const merge = useCallback((incoming: ChatMessage[]) => {
    latest.current = ordered([...latest.current, ...incoming]);
    setItems(latest.current);
  }, []);
  useEffect(() => {
    const abort = new AbortController();
    controller.current = abort;
    let timer: ReturnType<typeof setTimeout>;
    let ready = false;
    let cursor: string | undefined;
    loadedId.current = null;
    setAccess({});
    latest.current = [];
    setItems([]);
    setUnread(0);
    setLoading(true);
    setError(undefined);
    async function refresh() {
      try {
        const page = await client.list(
          appointmentId,
          ready && cursor ? { after: cursor } : {},
          abort.signal,
        );
        if (abort.signal.aborted) return;
        loadedId.current = appointmentId;
        setAccess({ canSend: page.canSend, expiresAt: page.expiresAt });
        if (!ready) setHasOlder(page.hasMore);
        else if (!shown.current) {
          const known = new Set(latest.current.map((item) => item.id));
          setUnread(
            (count) =>
              count +
              page.items.filter((item) => !item.own && !known.has(item.id))
                .length,
          );
        }
        if (page.items.length) cursor = page.items.at(-1)!.sequence;
        merge(page.items);
        ready = true;
        setLoading(false);
        setError(undefined);
        timer = setTimeout(
          refresh,
          page.hasMore && cursor && ready ? 100 : 2000,
        );
      } catch (failure) {
        if (abort.signal.aborted) return;
        setLoading(false);
        setError(message(failure));
        timer = setTimeout(refresh, 5000);
      }
    }
    refresh();
    return () => {
      abort.abort();
      clearTimeout(timer);
      if (controller.current === abort) controller.current = null;
    };
  }, [appointmentId, client, merge]);
  const tail = items.at(-1)?.sequence;
  useEffect(() => {
    if (!visible || !tail || !client.read || loadedId.current !== appointmentId)
      return;
    const abort = new AbortController();
    let retry: ReturnType<typeof setTimeout>;
    const read = () =>
      client.read!(appointmentId, tail, abort.signal).catch(() => {
        if (!abort.signal.aborted) retry = setTimeout(read, 5000);
      });
    void read();
    return () => {
      abort.abort();
      clearTimeout(retry);
    };
  }, [appointmentId, client, visible, tail]);
  /** Each upload keeps its own request ID, so retrying a partial batch cannot duplicate it. */
  async function sendMany(drafts: ChatDraft[]) {
    if (!drafts.length || drafts.length > CHAT_ATTACHMENT_LIMIT) {
      setError(
        `Choose up to ${CHAT_ATTACHMENT_LIMIT} attachments per message.`,
      );
      return 0;
    }
    if (access.canSend === false) {
      setError('Messaging is closed. Your history is still available.');
      return 0;
    }
    const abort = controller.current;
    if (!abort || locked.current) return 0;
    locked.current = true;
    setSending(true);
    setError(undefined);
    let sent = 0;
    try {
      for (const draft of drafts) {
        const item = await client.send(appointmentId, draft, abort.signal);
        if (abort.signal.aborted) break;
        merge([item]);
        sent++;
      }
    } catch (failure) {
      if (!abort.signal.aborted) setError(message(failure));
    } finally {
      locked.current = false;
      if (!abort.signal.aborted) setSending(false);
    }
    return sent;
  }
  async function send(draft: ChatDraft) {
    return (await sendMany([draft])) === 1;
  }
  async function older() {
    const abort = controller.current;
    const first = latest.current[0];
    if (!abort || !first) return;
    try {
      const page = await client.list(
        appointmentId,
        { before: first.sequence },
        abort.signal,
      );
      if (abort.signal.aborted) return;
      merge(page.items);
      setHasOlder(page.hasMore);
    } catch (failure) {
      if (!abort.signal.aborted) setError(message(failure));
    }
  }
  return {
    items,
    unread,
    hasOlder,
    loading,
    sending,
    error,
    dismissError: () => setError(undefined),
    send,
    sendMany,
    older,
    canSend: !loading && access.canSend !== false,
    expiresAt: access.expiresAt,
  };
}
