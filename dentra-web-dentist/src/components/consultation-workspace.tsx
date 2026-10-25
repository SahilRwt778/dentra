import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { GripHorizontal, Maximize2, Minimize2, PanelRightClose, X } from 'lucide-react';
import { useMovableCallWindow } from './use-movable-call-window';

export type ConsultationPanel = {
  id: string;
  label: string;
  content: ReactNode;
};

/** Keep one media tree mounted when changing layout so resizing never reconnects the call. */
export function ConsultationWorkspace({
  active,
  patientName,
  panels,
  actions,
  call,
  floating = false,
  onExpand,
}: {
  active: boolean;
  patientName: string;
  panels: ConsultationPanel[];
  actions: ReactNode;
  call: ReactNode;
  floating?: boolean;
  onExpand?: () => void;
}) {
  const [locallyMinimized, setMinimized] = useState(false);
  const minimized = floating || locallyMinimized;
  const [panelId, setPanelId] = useState<string | null>(null);
  const [panelWidth, setPanelWidth] = useState(40);
  const [miniWidth, setMiniWidth] = useState(360);
  const body = useRef<HTMLDivElement>(null);
  const workspace = useRef<HTMLElement>(null);
  const mediaWindow = useRef<HTMLDivElement>(null);
  const expanded = active && !minimized;
  const floatingCall = useMovableCallWindow(mediaWindow, active && minimized);
  useEffect(() => {
    if (!expanded) return;
    const previous = document.body.style.overflow;
    const previousFocus = document.activeElement;
    document.body.style.overflow = 'hidden';
    workspace.current?.querySelector<HTMLButtonElement>('button')?.focus();
    return () => {
      document.body.style.overflow = previous;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, [expanded]);
  useEffect(() => {
    // A newly established media session always opens across the viewport.
    // oxlint-disable-next-line react/set-state-in-effect
    if (!active) setMinimized(false);
  }, [active]);
  function resize(clientX: number) {
    const bounds = body.current?.getBoundingClientRect();
    if (bounds?.width)
      setPanelWidth(Math.max(28, Math.min(65, ((bounds.right - clientX) / bounds.width) * 100)));
  }
  return (
    <section
      ref={workspace}
      className={`consult-workspace${expanded ? ' is-expanded' : ''}${
        active && minimized ? ' is-minimized' : ''
      }${panelId ? ' has-panel' : ''}`}
      aria-label="Consultation workspace"
      style={
        {
          '--consult-panel-width': `${panelWidth}%`,
          '--consult-mini-width': `${miniWidth}px`,
        } as CSSProperties
      }
      onKeyDown={(event) => {
        // Signing dialogs sit above the workspace and retain their own keyboard navigation.
        if (!expanded || event.key !== 'Tab' || document.querySelector('.modal-back')) return;
        const controls = Array.from(
          event.currentTarget.querySelectorAll<HTMLElement>(
            'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), a[href], [tabindex="0"]',
          ),
        ).filter((element) => element.getClientRects().length > 0);
        const first = controls[0],
          last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
    >
      <div className="consult-workspace-body" ref={body}>
        <div className="consult-media-window" ref={mediaWindow} style={floatingCall.style}>
          <header className="consult-media-header">
            {active && minimized ? (
              <button
                type="button"
                className="grow consult-move-handle"
                aria-label="Move minimized call"
                aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight Home"
                title="Drag to move, or use the arrow keys. Home returns to the bottom right."
                {...floatingCall.handleProps}
              >
                <GripHorizontal size={18} aria-hidden="true" />
                <b>{patientName}</b>
              </button>
            ) : (
              <div className="grow">
                <b>{active ? patientName : 'Video consultation'}</b>
                <p className="small">Private consultation</p>
              </div>
            )}
            {active && (
              <button
                type="button"
                className="btn consult-icon-button"
                aria-label={minimized ? 'Restore full-screen call' : 'Minimize call'}
                onClick={() => (floating ? onExpand?.() : setMinimized((value) => !value))}
              >
                {minimized ? <Maximize2 size={20} /> : <Minimize2 size={20} />}
                <span>{minimized ? 'Expand' : 'Minimize'}</span>
              </button>
            )}
          </header>
          <div className="consult-media-content">{call}</div>
          {active && minimized && (
            <label className="consult-mini-size">
              Call size
              <input
                aria-label="Minimized call size"
                type="range"
                min="280"
                max="600"
                step="10"
                value={miniWidth}
                onChange={(event) => setMiniWidth(Number(event.target.value))}
              />
            </label>
          )}
        </div>
        {expanded && panelId && (
          <div
            className="consult-resize-handle"
            role="separator"
            aria-label="Resize video and clinical panel"
            aria-orientation="vertical"
            aria-valuemin={28}
            aria-valuemax={65}
            aria-valuenow={Math.round(panelWidth)}
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                event.preventDefault();
                setPanelWidth((value) =>
                  Math.max(28, Math.min(65, value + (event.key === 'ArrowLeft' ? 2 : -2))),
                );
              }
            }}
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              resize(event.clientX);
            }}
            onPointerMove={(event) => {
              if (event.currentTarget.hasPointerCapture(event.pointerId)) resize(event.clientX);
            }}
            onPointerUp={(event) => {
              if (event.currentTarget.hasPointerCapture(event.pointerId))
                event.currentTarget.releasePointerCapture(event.pointerId);
            }}
          />
        )}
        <div className="consult-documents">
          {expanded && panelId && (
            <div className="consult-document-heading">
              <h2>{panels.find((panel) => panel.id === panelId)?.label}</h2>
              <button
                type="button"
                className="btn"
                aria-label="Close clinical panel"
                onClick={() => setPanelId(null)}
              >
                <X size={18} />
              </button>
            </div>
          )}
          <div className="consult-document-scroll">
            {panels.map((panel) => (
              <section
                key={panel.id}
                id={`consult-panel-${panel.id}`}
                aria-label={panel.label}
                hidden={expanded && panelId !== panel.id}
              >
                {panel.content}
              </section>
            ))}
            {(!expanded || panelId) && <div className="consult-document-actions">{actions}</div>}
          </div>
        </div>
      </div>
      {expanded && (
        <nav className="consult-tool-rail" aria-label="Clinical tools">
          <span className="small">Consultation tools</span>
          {panels.map((panel) => (
            <button
              key={panel.id}
              type="button"
              className={`btn${panelId === panel.id ? ' btn-primary' : ''}`}
              aria-expanded={panelId === panel.id}
              aria-controls={`consult-panel-${panel.id}`}
              onClick={() => setPanelId((current) => (current === panel.id ? null : panel.id))}
            >
              {panel.label}
            </button>
          ))}
          {panelId && (
            <button
              type="button"
              className="btn"
              aria-label="Hide clinical panel"
              onClick={() => setPanelId(null)}
            >
              <PanelRightClose size={18} />
            </button>
          )}
        </nav>
      )}
    </section>
  );
}
