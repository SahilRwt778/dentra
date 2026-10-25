import type { ReactNode, MouseEvent } from 'react';

export function Modal({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  if (!open) return null;

  function handleBackdropClick(e: MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div className="modal-back" onClick={handleBackdropClick}>
      <div className="modal">{children}</div>
    </div>
  );
}
