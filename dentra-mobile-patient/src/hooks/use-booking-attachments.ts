import { useEffect, useRef, useState } from 'react';
import uuid from 'react-native-uuid';
import { useRemovePatientFile, useUploadPatientFile } from '@/api/files';
import { errorMessage } from '@/api/errors';
import type { PatientFile } from '@/api/types';
import {
  MAX_ATTACHMENTS,
  pickAttachments,
  type AttachmentSource,
  type LocalAttachment,
} from '@/lib/attachment-picker';

type Entry = {
  key: string;
  local: LocalAttachment;
  uploaded?: PatientFile;
  error?: string;
};

export function useBookingAttachments() {
  const [items, setItems] = useState<Entry[]>([]);
  const [isBusy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const locked = useRef(false);
  const mounted = useRef(true);
  const upload = useUploadPatientFile();
  const removeUpload = useRemovePatientFile();
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  async function run(operation: () => Promise<void>) {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError(undefined);
    try {
      await operation();
    } catch (err) {
      if (mounted.current)
        setError(
          errorMessage(
            err,
            'Could not update your attachments. Please try again.',
          ),
        );
    } finally {
      locked.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  async function send(entry: Entry) {
    try {
      const uploaded = await upload(entry.local, entry.key);
      if (mounted.current)
        setItems(current =>
          current.map(item =>
            item.key === entry.key
              ? { ...item, uploaded, error: undefined }
              : item,
          ),
        );
    } catch (err) {
      if (mounted.current)
        setItems(current =>
          current.map(item =>
            item.key === entry.key
              ? {
                  ...item,
                  error: errorMessage(
                    err,
                    'Upload failed. Tap retry or remove this file.',
                  ),
                }
              : item,
          ),
        );
    }
  }
  function choose(source: AttachmentSource) {
    return run(async () => {
      const selected = await pickAttachments(
        source,
        MAX_ATTACHMENTS - items.length,
      );
      if (!mounted.current) return;
      const entries = selected.map(local => ({
        local,
        key: String(uuid.v4()),
      }));
      setItems(current => [...current, ...entries]);
      for (const entry of entries) {
        if (mounted.current) await send(entry);
      }
    });
  }
  function retry(key: string) {
    return run(async () => {
      const entry = items.find(item => item.key === key);
      if (entry && !entry.uploaded) await send(entry);
    });
  }
  function remove(key: string) {
    return run(async () => {
      const entry = items.find(item => item.key === key);
      if (entry?.uploaded) await removeUpload(entry.uploaded.id);
      if (mounted.current)
        setItems(current => current.filter(item => item.key !== key));
    });
  }
  return {
    items,
    isBusy,
    error,
    choose,
    retry,
    remove,
    attachmentIds: items.flatMap(item =>
      item.uploaded ? [item.uploaded.id] : [],
    ),
    isReady: !isBusy && items.every(item => !!item.uploaded),
  };
}
