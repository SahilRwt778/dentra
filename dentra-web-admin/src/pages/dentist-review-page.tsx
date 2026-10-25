import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  useGetAdminDentistsQuery,
  useGetAdminDentistsByDentistIdQuery,
  usePostAdminDentistsByDentistIdApproveMutation,
  usePostAdminDentistsByDentistIdRejectMutation,
  type Dentist,
} from '@/api/generated-api';
import { PageHead } from '@/components/page-head';
import { DocumentChecklist, REQUIRED_KYC_DOC_TYPES } from '@/components/document-checklist';

function errorMessage(err: unknown, fallback: string): string {
  return (err as { data?: { message?: string } } | undefined)?.data?.message ?? fallback;
}

function missingRequiredDocs(dentist: Dentist): string[] {
  const have = new Set(dentist.documents?.map((d) => d.docType));
  return REQUIRED_KYC_DOC_TYPES.filter((t) => !have.has(t));
}

function RejectForm({ dentist, onDone }: { dentist: Dentist; onDone: () => void }) {
  const [reason, setReason] = useState('');
  const [reject, { isLoading }] = usePostAdminDentistsByDentistIdRejectMutation();

  async function handleSubmit() {
    if (!reason.trim()) {
      toast.error("Enter a reason — it's sent to the dentist");
      return;
    }
    try {
      const result = await reject({ dentistId: dentist.id!, body: { reason } }).unwrap();
      toast.success(`${result.fullName} rejected. Reason sent.`);
      onDone();
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to reject.'));
    }
  }

  return (
    <div className="card flat stack" style={{ marginTop: 10 }}>
      <label className="field">
        <span>Reason for rejecting {dentist.fullName} (sent to the dentist)</span>
        <textarea
          className="input"
          placeholder="e.g. Council registration certificate is illegible, please re-upload"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          autoFocus
        />
      </label>
      <div className="row">
        <button type="button" className="btn btn-danger" disabled={isLoading} onClick={handleSubmit}>
          Confirm rejection
        </button>
        <button type="button" className="btn" onClick={onDone}>
          Cancel
        </button>
      </div>
    </div>
  );
}

export function DentistReviewPage() {
  const [params] = useSearchParams();
  const dentistId = params.get('dentistId') ?? undefined;
  return <ReviewQueue key={dentistId ?? 'queue'} dentistId={dentistId} />;
}

function ReviewQueue({ dentistId }: { dentistId?: string }) {
  const [page, setPage] = useState(1);
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  const queue = useGetAdminDentistsQuery(
    { status: 'pending_review', page },
    { skip: !!dentistId, pollingInterval: 10000, refetchOnMountOrArgChange: true },
  );
  const application = useGetAdminDentistsByDentistIdQuery(
    { dentistId: dentistId ?? '' },
    { skip: !dentistId, pollingInterval: 10000, refetchOnMountOrArgChange: true },
  );
  const { isLoading, isFetching, error, refetch } = dentistId ? application : queue;
  const [approve, { isLoading: isApproving }] = usePostAdminDentistsByDentistIdApproveMutation();

  async function handleApprove(dentist: Dentist, force: boolean) {
    const missing = !force && missingRequiredDocs(dentist);
    if (missing && missing.length > 0) {
      if (
        !window.confirm(
          `${dentist.fullName} is missing: ${missing.join(', ')}.\n\nApprove anyway? This will be logged as an override.`,
        )
      ) {
        return;
      }
      return handleApprove(dentist, true);
    }
    try {
      const result = await approve({ dentistId: dentist.id!, body: { force } }).unwrap();
      toast.success(`${result.fullName} approved. They now appear in the patient app.`);
    } catch (err) {
      toast.error(errorMessage(err, 'Approval failed.'));
    }
  }

  const items = dentistId ? (application.data ? [application.data] : []) : (queue.data?.items ?? []);

  return (
    <>
      <PageHead
        title={dentistId ? 'Dentist application' : 'Waiting for verification'}
        subtitle="Review dentist details and documents, then approve or reject their request."
        actions={
          <button type="button" className="btn" disabled={isFetching} onClick={() => refetch()}>
            {isFetching ? 'Refreshing…' : 'Refresh requests'}
          </button>
        }
      />

      {dentistId && (
        <Link className="back-link" to="/dentists/review">
          ← All onboarding requests
        </Link>
      )}
      {isLoading ? (
        <p className="muted">Loading…</p>
      ) : error ? (
        <p className="small" role="alert">
          {dentistId
            ? 'Could not load this application. It may no longer be available.'
            : 'Could not load applications. Please refresh and try again.'}
        </p>
      ) : items.length === 0 ? (
        <div className="card empty">
          <p>Nothing to review right now.</p>
        </div>
      ) : (
        <>
          <div className="stack">
            {items.map((dentist) => {
              const missing = missingRequiredDocs(dentist);
              return (
                <div key={dentist.id} className="card verify-card">
                  <div className="avatar">
                    {dentist.fullName
                      ?.split(' ')
                      .map((p) => p[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase()}
                  </div>
                  <div className="grow">
                    <b>{dentist.fullName}</b>
                    <div className="small muted">
                      {dentist.qualification || 'Qualification pending'} · {dentist.clinics?.[0]?.name ?? '—'}
                    </div>
                    <div className="small muted">
                      {dentist.specialization} · {dentist.yearsExperience ?? 0} years of experience
                    </div>
                    <div className="small muted">
                      {dentist.mobile}
                      {dentist.email ? ` · ${dentist.email}` : ''}
                    </div>
                    <div className="small muted">
                      Registration {dentist.councilRegNo || '—'} · submitted{' '}
                      {dentist.submittedBy === 'admin' ? 'by admin' : 'self-serve'} on{' '}
                      {dentist.submittedAt ? new Date(dentist.submittedAt).toLocaleDateString() : '—'}
                    </div>
                    <div className="divider" style={{ margin: '10px 0' }} />
                    <DocumentChecklist dentist={dentist} />
                  </div>
                  {dentist.status !== 'pending_review' ? (
                    <p className="small muted" role="status">
                      Current status: {dentist.status}. This application is no longer waiting for review.
                    </p>
                  ) : rejectingId === dentist.id ? (
                    <RejectForm dentist={dentist} onDone={() => setRejectingId(null)} />
                  ) : (
                    <div className="row" style={{ alignSelf: 'flex-start' }}>
                      <button type="button" className="btn btn-danger" onClick={() => setRejectingId(dentist.id!)}>
                        Reject
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={isApproving}
                        onClick={() => handleApprove(dentist, false)}
                      >
                        Approve{missing.length > 0 ? ' (docs missing)' : ''}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {!dentistId && (
            <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
              <button type="button" className="btn" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </button>
              <span className="small muted">Page {page}</span>
              <button
                type="button"
                className="btn"
                disabled={!queue.data?.nextPage}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </>
  );
}
