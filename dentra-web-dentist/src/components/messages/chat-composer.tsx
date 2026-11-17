import { useEffect, useRef } from 'react';
import { FileText, LockKeyhole, Send, X } from 'lucide-react';
import { ChatAttachmentMenu } from '../chat-attachment-menu';

export function ChatComposer({
  text,
  file,
  preview,
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
  file?: File;
  preview?: string;
  sending: boolean;
  canSend: boolean;
  loading: boolean;
  embedded: boolean;
  onText(text: string): void;
  onSelect(file: File): void;
  onCamera(): void;
  onRemove(): void;
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
  const canSubmit = !disabled && (!!text.trim() || !!file);
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
            disabled={sending}
            onClick={onRemove}
          >
            <X size={16} />
          </button>
        </div>
      )}
      <div className="chat-compose-row">
        <ChatAttachmentMenu
          active={!disabled}
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
