import { Link, useNavigate, useParams } from 'react-router-dom';
import { useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { consultationDeadline } from '@dentra/call-core';
import {
  useGetConsultationCaseQuery,
  useGetConsultationCasesQuery,
} from '@/api/generated-api';
import { PageHead } from '@/components/page-head';
import { CallChat } from '@/components/call-chat';

const ignoreUnread = () => undefined;
export function MessagesPage() {
  const { caseId } = useParams();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const inbox = useGetConsultationCasesQuery(
    { page },
    {
      pollingInterval: 10000,
      skipPollingIfUnfocused: true,
      refetchOnMountOrArgChange: true,
    },
  );
  const selected = useGetConsultationCaseQuery(
    { caseId: caseId! },
    { skip: !caseId, refetchOnMountOrArgChange: true },
  );
  return (
    <div className="stack">
      <PageHead
        title="Messages"
        subtitle="Consultation conversations and follow-ups"
      />
      <p className="muted">
        Messages stay open for 72 hours after the first paid visit is completed.
        Closed conversations remain readable.
      </p>
      {inbox.error && (
        <div role="alert" className="card">
          Could not load conversations.{' '}
          <button className="btn" onClick={inbox.refetch}>
            Try again
          </button>
        </div>
      )}
      {inbox.isFetching && !inbox.currentData && <p>Loading conversations…</p>}
      {!inbox.isFetching &&
        !inbox.error &&
        !inbox.currentData?.items.length && (
          <div className="card">No conversations yet.</div>
        )}
      {inbox.currentData?.items.map((item) => (
        <Link
          key={item.id}
          to={`/messages/${item.id}`}
          className="card row"
          style={{ textDecoration: 'none', color: 'inherit' }}
        >
          <MessageCircle size={24} />
          <div className="grow">
            <strong>{item.patientName}</strong>
            <p className="small muted">{item.concern}</p>
            <small>
              {item.status === 'active' && item.expiresAt
                ? `Open until ${consultationDeadline(item.expiresAt)}`
                : item.status === 'pending'
                ? 'Consultation chat'
                : 'Closed · History available'}
            </small>
          </div>
          {item.unreadCount > 0 && (
            <span className="badge">{item.unreadCount} unread</span>
          )}
        </Link>
      ))}
      <div className="row">
        <button
          className="btn"
          disabled={page === 1}
          onClick={() => setPage(page - 1)}
        >
          Previous
        </button>
        <span className="small">Page {page}</span>
        <button
          className="btn"
          disabled={!inbox.currentData?.nextPage}
          onClick={() => setPage(inbox.currentData!.nextPage!)}
        >
          Next
        </button>
      </div>
      {caseId && selected.error && (
        <div role="alert" className="card">
          Could not open this conversation.{' '}
          <button className="btn" onClick={selected.refetch}>
            Retry
          </button>
        </div>
      )}
      {selected.currentData && caseId && (
        <CallChat
          key={caseId}
          appointmentId={selected.currentData.originalAppointmentId}
          target={document.body}
          open
          standalone
          title={selected.currentData.patientName}
          subtitle={
            selected.currentData.expiresAt
              ? `Open until ${consultationDeadline(
                  selected.currentData.expiresAt,
                )}`
              : 'Consultation messages'
          }
          onClose={() => {
            navigate('/messages');
            inbox.refetch();
          }}
          onUnread={ignoreUnread}
        />
      )}
    </div>
  );
}
