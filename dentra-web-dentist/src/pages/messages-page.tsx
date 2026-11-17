import { useNavigate, useParams } from 'react-router-dom';
import { useState } from 'react';
import { ArrowLeft, LockKeyhole, MessagesSquare } from 'lucide-react';
import { consultationDeadline } from '@dentra/call-core';
import {
  useGetConsultationCaseQuery,
  useGetConsultationCasesQuery,
} from '@/api/generated-api';
import { PageHead } from '@/components/page-head';
import { CallChat } from '@/components/call-chat';
import { ConversationList } from '@/components/messages/conversation-list';

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
  function back() {
    navigate('/messages');
    inbox.refetch();
  }
  return (
    <>
      <PageHead title="Messages" subtitle="Stay in touch with your patients" />
      <section
        className={`messages-workspace ${caseId ? 'has-conversation' : ''}`}
        aria-label="Consultation messages"
      >
        <ConversationList
          items={inbox.currentData?.items ?? []}
          selectedId={caseId}
          loading={inbox.isFetching}
          error={!!inbox.error}
          page={page}
          nextPage={inbox.currentData?.nextPage}
          unreadCount={inbox.currentData?.unreadCount ?? 0}
          onPage={setPage}
          onRefresh={inbox.refetch}
        />
        <div className="messages-chat-pane">
          {!caseId ? (
            <div className="messages-welcome">
              <div className="messages-welcome-icon">
                <MessagesSquare size={42} strokeWidth={1.5} />
              </div>
              <h2>Your consultation conversations</h2>
              <p>
                Choose a patient on the left to view your messages, share a
                photo or send a report.
              </p>
              <span className="messages-welcome-rule" />
              <small>
                Messaging stays open for 72 hours after the first paid visit is
                completed.
              </small>
              <span className="messages-private">
                <LockKeyhole size={14} /> Private consultation messages
              </span>
            </div>
          ) : selected.error ? (
            <div className="messages-panel-feedback" role="alert">
              <button
                type="button"
                className="messages-icon-button"
                aria-label="Back to conversations"
                onClick={back}
              >
                <ArrowLeft size={20} />
              </button>
              <h3>Could not open this conversation</h3>
              <p>Try again, or choose another patient.</p>
              <button className="btn" onClick={selected.refetch}>
                Try again
              </button>
            </div>
          ) : !selected.currentData ? (
            <div className="messages-panel-feedback" role="status">
              <button
                type="button"
                className="messages-icon-button"
                aria-label="Back to conversations"
                onClick={back}
              >
                <ArrowLeft size={20} />
              </button>
              Loading conversation…
            </div>
          ) : (
            <CallChat
              key={caseId}
              appointmentId={selected.currentData.originalAppointmentId}
              open
              embedded
              title={selected.currentData.patientName}
              concern={selected.currentData.concern}
              photoUrl={selected.currentData.patientProfilePhotoUrl}
              subtitle={
                selected.currentData.expiresAt
                  ? `Open until ${consultationDeadline(
                      selected.currentData.expiresAt,
                    )}`
                  : 'Available during your consultation'
              }
              onClose={back}
              onUnread={ignoreUnread}
            />
          )}
        </div>
      </section>
    </>
  );
}
