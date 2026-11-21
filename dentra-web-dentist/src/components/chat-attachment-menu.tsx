import { useEffect, useId, useRef, useState } from 'react';
import { Camera, FileText, Images, Paperclip } from 'lucide-react';

export function ChatAttachmentMenu({
  active,
  onSelect,
  onCamera,
}: {
  active: boolean;
  onSelect(files: File[]): void;
  onCamera(): void;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const galleryButton = useRef<HTMLButtonElement>(null);
  const gallery = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!active) setOpen(false);
  }, [active]);
  useEffect(() => {
    if (!open) return;
    galleryButton.current?.focus();
    function outside(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    window.document.addEventListener('pointerdown', outside);
    return () => window.document.removeEventListener('pointerdown', outside);
  }, [open]);

  function close() {
    setOpen(false);
    trigger.current?.focus();
  }
  function select(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (files.length && active) onSelect(files);
  }

  return (
    <div
      ref={root}
      className="chat-attachment-picker"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) {
          event.stopPropagation();
          close();
        }
      }}
    >
      <button
        ref={trigger}
        type="button"
        className="chat-attach-button"
        aria-label="Add attachment"
        aria-expanded={open && active}
        aria-controls={id}
        title="Add attachment"
        disabled={!active}
        onClick={() => setOpen((value) => !value)}
      >
        <Paperclip size={22} />
      </button>
      <input
        ref={gallery}
        type="file"
        multiple
        hidden
        accept="image/jpeg,image/png"
        aria-label="Choose chat photo"
        disabled={!active}
        onChange={select}
      />
      <input
        ref={fileInput}
        type="file"
        multiple
        hidden
        accept="image/jpeg,image/png,application/pdf"
        aria-label="Choose chat file"
        disabled={!active}
        onChange={select}
      />
      {open && active && (
        <div
          id={id}
          role="group"
          aria-label="Attachment options"
          className="chat-attachment-menu"
        >
          <strong>Share an attachment</strong>
          <div className="chat-attachment-options">
            <button
              ref={galleryButton}
              type="button"
              onClick={() => {
                close();
                gallery.current?.click();
              }}
            >
              <span className="chat-attachment-circle is-gallery">
                <Images size={23} />
              </span>
              Gallery
            </button>
            <button
              type="button"
              onClick={() => {
                close();
                onCamera();
              }}
            >
              <span className="chat-attachment-circle is-camera">
                <Camera size={23} />
              </span>
              Camera
            </button>
            <button
              type="button"
              onClick={() => {
                close();
                fileInput.current?.click();
              }}
            >
              <span className="chat-attachment-circle is-file">
                <FileText size={23} />
              </span>
              File
            </button>
          </div>
          <small>Up to 3 attachments · JPEG, PNG or PDF · 10 MB each</small>
        </div>
      )}
    </div>
  );
}
