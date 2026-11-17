import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import {
  consultationDeadline,
  conversationFilters,
  matchesConversationFilter,
  type ConversationFilter,
} from '@dentra/call-core';
import type { ConsultationCase } from '@/api/generated-api';
import { ProfileAvatar } from '../profile-avatar';

export function ConversationList({
  items,
  selectedId,
  loading,
  error,
  page,
  nextPage,
  unreadCount,
  onPage,
  onRefresh,
  filter,
  onFilter,
}: {
  items: ConsultationCase[];
  selectedId?: string;
  loading: boolean;
  error: boolean;
  page: number;
  nextPage?: number | null;
  unreadCount: number;
  onPage(page: number): void;
  onRefresh(): void;
  filter: ConversationFilter;
  onFilter(filter: ConversationFilter): void;
}) {
  const [search, setSearch] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const term = search.trim().toLocaleLowerCase();
  const matches = items.filter(
    (item) =>
      matchesConversationFilter(item, filter) &&
      (!unreadOnly || item.unreadCount > 0) &&
      (!term ||
        `${item.patientName} ${item.concern}`
          .toLocaleLowerCase()
          .includes(term)),
  );
  function changePage(value: number) {
    setSearch('');
    setUnreadOnly(false);
    onPage(value);
  }
  return (
    <aside className="messages-sidebar" aria-label="Conversations">
      <header className="messages-list-header">
        <div>
          <h2>Chats</h2>
          <span>
            {unreadCount
              ? `${unreadCount} unread messages`
              : 'Your patient conversations'}
          </span>
        </div>
        <button
          type="button"
          className="messages-icon-button"
          aria-label="Refresh conversations"
          title="Refresh conversations"
          onClick={onRefresh}
          disabled={loading}
        >
          <RefreshCw size={18} />
        </button>
      </header>
      <div className="messages-search">
        <Search size={17} aria-hidden="true" />
        <input
          type="search"
          aria-label="Search conversations on this page"
          placeholder="Search patient or concern"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        {search && (
          <button
            type="button"
            className="messages-icon-button"
            aria-label="Clear search"
            onClick={() => setSearch('')}
          >
            <X size={15} />
          </button>
        )}
      </div>
      <div
        className="messages-filters"
        role="group"
        aria-label="Filter conversations"
      >
        {conversationFilters.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={!unreadOnly && filter === option.value}
            onClick={() => {
              setUnreadOnly(false);
              onFilter(option.value);
            }}
          >
            {option.label}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={unreadOnly}
          onClick={() => {
            setUnreadOnly(true);
            onFilter('all');
          }}
        >
          Unread
        </button>
      </div>
      <nav
        className="messages-conversations"
        aria-label="Patient conversations"
        aria-busy={loading}
      >
        {error && (
          <div className="messages-list-feedback" role="alert">
            <strong>Could not load conversations</strong>
            <button className="btn" onClick={onRefresh}>
              Try again
            </button>
          </div>
        )}
        {!error && loading && !items.length && (
          <p className="messages-list-feedback">Loading conversations…</p>
        )}
        {!error && !loading && !matches.length && (
          <div className="messages-list-feedback">
            <MessageCircle size={27} />
            <strong>
              {search || unreadOnly
                ? 'No matching conversations'
                : filter === 'all'
                  ? 'No conversations yet'
                  : `No ${filter} conversations`}
            </strong>
            <p>
              {search || unreadOnly
                ? 'Try a different name or view all chats.'
                : filter === 'all'
                  ? 'Conversations appear here when patients consult with you.'
                  : 'Choose All to view your other consultation chats.'}
            </p>
          </div>
        )}
        {matches.map((item) => (
          <Link
            key={item.id}
            to={`/messages/${item.id}`}
            className={`messages-conversation ${
              item.id === selectedId ? 'is-selected' : ''
            }`}
            aria-current={item.id === selectedId ? 'page' : undefined}
          >
            <ProfileAvatar
              name={item.patientName}
              photoUrl={item.patientProfilePhotoUrl}
            />
            <div className="messages-conversation-details">
              <div className="messages-conversation-heading">
                <strong>{item.patientName}</strong>
                <time
                  dateTime={
                    item.latestMessageAt ?? item.activatedAt ?? undefined
                  }
                >
                  {activityTime(item.latestMessageAt ?? item.activatedAt)}
                </time>
              </div>
              <p className="messages-concern" title={item.concern}>
                {item.concern}
              </p>
              <div className="messages-conversation-footer">
                <span className={item.status === 'active' ? 'is-open' : ''}>
                  {item.status === 'active' && item.expiresAt
                    ? `Open until ${consultationDeadline(item.expiresAt)}`
                    : item.status === 'pending'
                      ? 'Consultation chat'
                      : 'Closed · History available'}
                </span>
                {item.unreadCount > 0 && (
                  <span
                    className="messages-unread"
                    aria-label={`${item.unreadCount} unread`}
                  >
                    {item.unreadCount > 99 ? '99+' : item.unreadCount}
                  </span>
                )}
              </div>
            </div>
          </Link>
        ))}
      </nav>
      {(page > 1 || nextPage) && (
        <footer className="messages-pagination">
          <button
            type="button"
            className="messages-icon-button"
            aria-label="Previous conversations"
            disabled={page <= 1 || loading}
            onClick={() => changePage(page - 1)}
          >
            <ChevronLeft size={18} />
          </button>
          <span>Page {page}</span>
          <button
            type="button"
            className="messages-icon-button"
            aria-label="More conversations"
            disabled={!nextPage || loading}
            onClick={() => nextPage && changePage(nextPage)}
          >
            <ChevronRight size={18} />
          </button>
        </footer>
      )}
    </aside>
  );
}

function activityTime(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  return date.toDateString() === new Date().toDateString()
    ? date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
    : date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}
