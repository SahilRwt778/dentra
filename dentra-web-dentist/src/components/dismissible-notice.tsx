import { AlertTriangle, X } from 'lucide-react';
import './dismissible-notice.css';

export function DismissibleNotice({
  message,
  onDismiss,
  className = '',
}: {
  message: string;
  onDismiss(): void;
  className?: string;
}) {
  return (
    <div
      className={`dismissible-notice ${className}`}
      role="alert"
      title={message}
    >
      <AlertTriangle size={18} aria-hidden="true" />
      <span className="notice-message">{message}</span>
      <button
        type="button"
        className="notice-dismiss"
        aria-label="Dismiss warning"
        title="Dismiss warning"
        onClick={onDismiss}
      >
        <X size={19} />
      </button>
    </div>
  );
}
