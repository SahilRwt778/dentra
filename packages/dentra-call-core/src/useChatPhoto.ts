import { useEffect, useState } from 'react';
import type { ChatAttachment } from './chat-types';
import type { ChatMediaLoader } from './chat-media';

export function useChatPhoto(
  loader: ChatMediaLoader,
  file: ChatAttachment,
  visible: boolean,
) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{
    loader: ChatMediaLoader;
    id: string;
    uri?: string;
    error?: boolean;
  }>();
  useEffect(() => {
    if (!visible || !file.mimeType.startsWith('image/')) return;
    let current = true;
    setResult({ loader, id: file.id });
    void loader.load(file).then(
      media => {
        if (current) setResult({ loader, id: file.id, uri: media.uri });
      },
      () => {
        if (current) setResult({ loader, id: file.id, error: true });
      },
    );
    return () => {
      current = false;
    };
    // Metadata objects are replaced by polling; immutable attachment IDs identify photos.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loader, file.id, file.mimeType, visible, attempt]);
  const current =
    result?.loader === loader && result.id === file.id ? result : undefined;
  return {
    uri: current?.uri,
    error: !!current?.error,
    retry() {
      setAttempt(value => value + 1);
    },
    fail() {
      loader.invalidate(file.id);
      setResult({ loader, id: file.id, error: true });
    },
  };
}
