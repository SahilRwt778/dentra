import { ArrowLeft, MessageCircle, X } from 'lucide-react';
import { ProfileAvatar } from '../profile-avatar';

export function ChatHeader({
  title,
  concern,
  photoUrl,
  subtitle,
  embedded,
  loading,
  canSend,
  onBack,
}: {
  title: string;
  concern?: string;
  photoUrl?: string | null;
  subtitle?: string;
  embedded: boolean;
  loading: boolean;
  canSend: boolean;
  onBack(): void;
}) {
  return (
    <>
      <header className="call-chat-header">
        {embedded ? (
          <>
            <button
              type="button"
              className="messages-icon-button chat-back"
              aria-label="Back to conversations"
              title="Back to conversations"
              onClick={onBack}
            >
              <ArrowLeft size={20} />
            </button>
            <ProfileAvatar name={title} photoUrl={photoUrl} />
          </>
        ) : (
          <MessageCircle size={18} />
        )}
        <div className="call-chat-identity">
          <strong>{title}</strong>
          {embedded && concern && <span title={concern}>{concern}</span>}
        </div>
        {embedded ? (
          <span
            className={`chat-access-badge ${
              !canSend && !loading ? 'is-closed' : ''
            }`}
          >
            {loading ? 'Loading…' : canSend ? 'Messaging open' : 'Read only'}
          </span>
        ) : (
          <button
            type="button"
            className="btn btn-icon"
            aria-label="Close chat"
            onClick={onBack}
          >
            <X size={18} />
          </button>
        )}
      </header>
      <p className="call-chat-subtitle">
        {loading
          ? 'Loading conversation…'
          : !canSend
          ? 'Messaging closed · Your history and files are still available'
          : subtitle ?? 'Private consultation messages'}
      </p>
    </>
  );
}
