import { useEffect, useRef } from 'react';
import { FileText, LockKeyhole, Send, X } from 'lucide-react';
import { ChatAttachmentMenu } from '../chat-attachment-menu';
import { CHAT_ATTACHMENT_LIMIT } from '@dentra/call-core';

export type ChatComposerAttachment = {
  id: string;
  requestId: string;
  file: File;
  preview?: string;
};

export function ChatComposer({
  text,
  files,
  sending,
  canSend,
  loading,
  embedded,
  onText,
  onSelect,
  onCamera,
  onRemove,
  onSend,
}: {
  text: string;
  files: ChatComposerAttachment[];
  sending: boolean;
  canSend: boolean;
  loading: boolean;
  embedded: boolean;
  onText(text: string): void;
  onSelect(files: File[]): void;
  onCamera(): void;
  onRemove(id: string): void;
  onSend(): void;
}) {
  const input = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const element = input.current;
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = `${Math.min(element.scrollHeight, 140)}px`;
  }, [text]);
  const disabled = !canSend || sending;
  const canSubmit = !disabled && (!!text.trim() || files.length > 0);
  if (embedded && !loading && !canSend)
    return (
      <footer className="chat-read-only">
        <LockKeyhole size={18} />
        <span>
          This conversation is read-only. You can still view its messages and
          files.
        </span>
      </footer>
    );
  return (
    <form
      className="call-chat-composer"
      onSubmit={(event) => {
        event.preventDefault();
        if (canSubmit) onSend();
      }}
    >
      {files.length > 0 && (
        <>
          <span className="chat-queue-count">
            {files.length} / {CHAT_ATTACHMENT_LIMIT} attachments
          </span>
          <div className="chat-draft-attachments">
            {files.map(({ id, file, preview }) => (
              <div key={id} className="chat-draft-file">
                {preview ? (
                  <img src={preview} alt={`Preview: ${file.name}`} />
                ) : (
                  <FileText size={30} />
                )}
                <span title={file.name}>{file.name}</span>
                <button
                  type="button"
                  aria-label={`Remove attachment: ${file.name}`}
                  title="Remove attachment"
                  className="call-chat-remove"
                  disabled={sending}
                  onClick={() => onRemove(id)}
                >
                  <X size={15} />
                </button>
              </div>
            ))}
          </div>
        </>
      )}
      <div className="chat-compose-row">
        <ChatAttachmentMenu
          active={!disabled && files.length < CHAT_ATTACHMENT_LIMIT}
          onSelect={onSelect}
          onCamera={onCamera}
        />
        <textarea
          ref={input}
          rows={1}
          aria-label="Chat message"
          placeholder={
            loading
              ? 'Loading conversation…'
              : canSend
                ? 'Type a message'
                : 'Messaging closed'
          }
          maxLength={4000}
          value={text}
          disabled={disabled}
          onChange={(event) => onText(event.target.value)}
          onKeyDown={(event) => {
            if (
              event.key === 'Enter' &&
              !event.shiftKey &&
              !event.nativeEvent.isComposing
            ) {
              event.preventDefault();
              if (canSubmit) onSend();
            }
          }}
        />
        <button
          type="submit"
          className="chat-send-button"
          aria-label={sending ? 'Sending message' : 'Send message'}
          title="Send message"
          disabled={!canSubmit}
        >
          <Send size={19} />
        </button>
      </div>
      {embedded && (
        <span className="chat-compose-hint">
          Enter to send · Shift + Enter for a new line
        </span>
      )}
    </form>
  );
}
