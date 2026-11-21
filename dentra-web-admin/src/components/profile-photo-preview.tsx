import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { RotateCcw, X, ZoomIn, ZoomOut } from 'lucide-react';
import './profile-photo-preview.css';

/** Keep the original signed URL; the browser respects the API's cache policy. */
export function ProfilePhotoPreview({
  uri,
  name = 'User',
  children,
  className = '',
  style,
}: {
  uri?: string | null;
  name?: string;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  const [openedUri, setOpenedUri] = useState<string>();
  if (!uri)
    return (
      <span className={className} style={style}>
        {children}
      </span>
    );

  return (
    <>
      <button
        type="button"
        className={`profile-photo-trigger ${className}`}
        style={style}
        aria-label={`View ${name}'s profile photo`}
        title="View profile photo"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpenedUri(uri);
        }}
      >
        {children}
      </button>
      {openedUri === uri &&
        createPortal(
          <ProfilePhotoDialog
            key={uri}
            uri={uri}
            name={name}
            onClose={() => setOpenedUri(undefined)}
          />,
          document.body,
        )}
    </>
  );
}

function ProfilePhotoDialog({
  uri,
  name,
  onClose,
}: {
  uri: string;
  name: string;
  onClose(): void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const canvas = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.current?.showModal();
    return () => {
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected)
        previousFocus.focus();
    };
  }, []);

  function changeZoom(value: number) {
    setZoom(Math.max(1, Math.min(4, value)));
    canvas.current?.scrollTo(0, 0);
  }

  return (
    <dialog
      ref={dialog}
      className="profile-photo-dialog"
      aria-label={`${name}'s profile photo`}
      aria-modal="true"
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
      onCancel={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }}
    >
      <header className="profile-photo-heading">
        <div>
          <strong>{name}</strong>
          <span>Profile photo</span>
        </div>
        <button
          type="button"
          className="profile-photo-tool"
          aria-label="Close profile photo"
          title="Close (Esc)"
          onClick={onClose}
        >
          <X size={24} />
        </button>
      </header>
      <div
        ref={canvas}
        className="profile-photo-canvas"
        onDoubleClick={() => changeZoom(zoom > 1 ? 1 : 2)}
      >
        {failed ? (
          <p role="alert">
            Could not display this photo. Close it and try again.
          </p>
        ) : (
          <img
            src={uri}
            alt={`${name}'s profile photo`}
            draggable={false}
            onError={() => setFailed(true)}
            style={{ width: `${zoom * 100}%`, height: `${zoom * 100}%` }}
          />
        )}
      </div>
      <footer className="profile-photo-tools">
        <button
          type="button"
          className="profile-photo-tool"
          aria-label="Zoom out"
          title="Zoom out"
          disabled={failed || zoom <= 1}
          onClick={() => changeZoom(zoom - 0.5)}
        >
          <ZoomOut size={23} />
        </button>
        <span aria-live="polite">{Math.round(zoom * 100)}%</span>
        <button
          type="button"
          className="profile-photo-tool"
          aria-label="Zoom in"
          title="Zoom in"
          disabled={failed || zoom >= 4}
          onClick={() => changeZoom(zoom + 0.5)}
        >
          <ZoomIn size={23} />
        </button>
        <button
          type="button"
          className="profile-photo-tool"
          aria-label="Reset zoom"
          title="Reset zoom"
          disabled={failed}
          onClick={() => changeZoom(1)}
        >
          <RotateCcw size={21} />
        </button>
      </footer>
    </dialog>
  );
}
