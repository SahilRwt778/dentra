import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Download,
  ExternalLink,
  RotateCcw,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';

export type ChatViewerFile = { url: string; name: string; mime: string };
export function ChatAttachmentViewer({
  file,
  onClose,
}: {
  file: ChatViewerFile;
  onClose(): void;
}) {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [failed, setFailed] = useState(false);
  const drag = useRef<{
    x: number;
    y: number;
    fromX: number;
    fromY: number;
  } | null>(null);
  const back = useRef<HTMLButtonElement>(null);
  const image = file.mime.startsWith('image/');
  function changeZoom(value: number) {
    setZoom(Math.max(1, Math.min(4, value)));
    setOffset({ x: 0, y: 0 });
  }
  useEffect(() => {
    const previous = document.activeElement;
    back.current?.focus();
    return () => {
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, []);
  return (
    <div
      className="call-chat-viewer chat-viewer-fullscreen"
      role="dialog"
      aria-modal="true"
      aria-label="Chat attachment"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          onClose();
        }
        if (event.key === 'Tab') {
          const controls = event.currentTarget.querySelectorAll<HTMLElement>(
            'button:not(:disabled), a[href], iframe',
          );
          const first = controls[0],
            last = controls[controls.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }
      }}
    >
      <header>
        <button
          ref={back}
          type="button"
          className="chat-viewer-tool"
          aria-label="Close attachment"
          onClick={onClose}
        >
          <ArrowLeft size={23} />
        </button>
        <span title={file.name}>{file.name}</span>
        {!image && (
          <a
            href={file.url}
            target="_blank"
            rel="noreferrer"
            className="chat-viewer-tool"
            aria-label="Open PDF in new tab"
          >
            <ExternalLink size={21} />
          </a>
        )}
        <a
          href={file.url}
          download={file.name}
          className="chat-viewer-tool"
          aria-label="Download attachment"
        >
          <Download size={22} />
        </a>
      </header>
      {image ? (
        <>
          <div
            className="chat-photo-canvas"
            onDoubleClick={() => changeZoom(zoom > 1 ? 1 : 2)}
            onPointerDown={(event) => {
              if (zoom <= 1) return;
              event.currentTarget.setPointerCapture(event.pointerId);
              drag.current = {
                x: event.clientX,
                y: event.clientY,
                fromX: offset.x,
                fromY: offset.y,
              };
            }}
            onPointerMove={(event) => {
              if (!drag.current) return;
              const bounds = event.currentTarget.getBoundingClientRect();
              const limitX = (bounds.width * (zoom - 1)) / 2,
                limitY = (bounds.height * (zoom - 1)) / 2;
              setOffset({
                x: Math.max(
                  -limitX,
                  Math.min(
                    limitX,
                    drag.current.fromX + event.clientX - drag.current.x,
                  ),
                ),
                y: Math.max(
                  -limitY,
                  Math.min(
                    limitY,
                    drag.current.fromY + event.clientY - drag.current.y,
                  ),
                ),
              });
            }}
            onPointerUp={() => {
              drag.current = null;
            }}
            onPointerCancel={() => {
              drag.current = null;
            }}
          >
            {failed ? (
              <p role="alert">
                Could not display this photo. Close it and retry the preview.
              </p>
            ) : (
              <img
                src={file.url}
                alt={file.name}
                draggable={false}
                onError={() => setFailed(true)}
                style={{
                  transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
                }}
              />
            )}
          </div>
          <footer className="chat-photo-tools">
            <button
              type="button"
              className="chat-viewer-tool"
              aria-label="Zoom out"
              disabled={zoom <= 1}
              onClick={() => changeZoom(zoom - 0.5)}
            >
              <ZoomOut size={23} />
            </button>
            <span>{Math.round(zoom * 100)}%</span>
            <button
              type="button"
              className="chat-viewer-tool"
              aria-label="Zoom in"
              disabled={zoom >= 4}
              onClick={() => changeZoom(zoom + 0.5)}
            >
              <ZoomIn size={23} />
            </button>
            <button
              type="button"
              className="chat-viewer-tool"
              aria-label="Reset zoom"
              onClick={() => changeZoom(1)}
            >
              <RotateCcw size={21} />
            </button>
            <small>Double-click to zoom · Drag to move</small>
          </footer>
        </>
      ) : (
        <iframe src={file.url} title={file.name} />
      )}
    </div>
  );
}
