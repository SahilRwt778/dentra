import type { ChatAttachment } from './chat-types';

export type ChatMedia = { uri: string; dispose?(): void };
export type ChatMediaLoader = ReturnType<typeof createChatMediaLoader>;

/** Conversation-scoped downloads, shared by thumbnails and the attachment viewer. */
export function createChatMediaLoader(
  download: (file: ChatAttachment, signal: AbortSignal) => Promise<ChatMedia>,
) {
  type Entry = {
    controller: AbortController;
    promise: Promise<ChatMedia>;
    media?: ChatMedia;
    start(): void;
    reject(error: Error): void;
  };
  const entries = new Map<string, Entry>();
  const queue: Entry[] = [];
  let running = 0;
  const cancelled = () => new Error('Attachment download cancelled.');

  function pump() {
    while (running < 2 && queue.length) queue.shift()!.start();
  }
  function load(file: ChatAttachment): Promise<ChatMedia> {
    const cached = entries.get(file.id);
    if (cached) return cached.promise;
    const controller = new AbortController();
    let resolve!: (media: ChatMedia) => void;
    let reject!: (error: Error) => void;
    const promise = new Promise<ChatMedia>((yes, no) => {
      resolve = yes;
      reject = no;
    });
    const entry: Entry = {
      controller,
      promise,
      reject,
      start() {
        running++;
        void (async () => {
          try {
            const media = await download(file, controller.signal);
            if (controller.signal.aborted) {
              media.dispose?.();
              throw cancelled();
            }
            entry.media = media;
            resolve(media);
          } catch (error) {
            if (entries.get(file.id) === entry) entries.delete(file.id);
            reject(
              error instanceof Error
                ? error
                : new Error('Could not load this attachment.'),
            );
          } finally {
            running--;
            pump();
          }
        })();
      },
    };
    entries.set(file.id, entry);
    queue.push(entry);
    pump();
    return promise;
  }
  function invalidate(id: string) {
    const entry = entries.get(id);
    if (!entry) return;
    entries.delete(id);
    entry.controller.abort();
    entry.media?.dispose?.();
    const index = queue.indexOf(entry);
    if (index !== -1) queue.splice(index, 1);
    entry.reject(cancelled());
  }
  function clear() {
    for (const id of entries.keys()) invalidate(id);
  }
  return { load, invalidate, clear };
}

export function attachmentSize(bytes: number): string {
  return bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(1, Math.ceil(bytes / 1024))} KB`;
}
