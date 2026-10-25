import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import {
  useGetAdminDentistPayoutDetailsQuery,
  useApproveAdminPayoutRequestMutation,
  useRejectAdminPayoutRequestMutation,
  type PayoutDetails,
  type PayoutRequest,
} from '@/api/generated-api';

const FIELDS = [
  ['bankAccountHolder', 'Account holder'],
  ['bankAccountNo', 'Account number'],
  ['bankIfsc', 'IFSC'],
  ['pan', 'PAN'],
  ['gstin', 'GSTIN'],
] as const;

function AccountDetails({ details }: { details: PayoutDetails }) {
  return (
    <dl className="dentist-fields">
      {FIELDS.map(([key, label]) => (
        <div key={key}>
          <dt>{label}</dt>
          <dd>{details[key] || 'Not provided'}</dd>
        </div>
      ))}
    </dl>
  );
}

function ReviewActions({
  request,
  canApprove,
  onChanged,
}: {
  request: PayoutRequest;
  canApprove: boolean;
  onChanged: () => void;
}) {
  const [approve, approving] = useApproveAdminPayoutRequestMutation();
  const [reject, rejecting] = useRejectAdminPayoutRequestMutation();
  const [rejectingRequest, setRejectingRequest] = useState(false);
  const [reason, setReason] = useState('');
  const busy = approving.isLoading || rejecting.isLoading;

  function handleError(error: unknown) {
    const message = (error as { data?: { message?: string | string[] } }).data
      ?.message;
    toast.error(
      Array.isArray(message)
        ? message.join('. ')
        : message ?? 'Could not save the review. Please try again.',
    );
    onChanged();
  }

  async function approveRequest() {
    if (
      !window.confirm(
        'Approve these payout details? This account will replace the dentist’s current approved payout account.',
      )
    )
      return;
    try {
      await approve({ requestId: request.id }).unwrap();
      toast.success('Payout details approved.');
    } catch (error) {
      handleError(error);
    }
  }

  async function rejectRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await reject({
        requestId: request.id,
        body: { reason: reason.trim() },
      }).unwrap();
      toast.success(
        'Payout request rejected. The dentist can correct and resubmit it.',
      );
    } catch (error) {
      handleError(error);
    }
  }

  return (
    <div className="stack" style={{ marginTop: 16 }}>
      {!canApprove && (
        <p className="small muted">
          The dentist must be verified before payout details can be approved.
        </p>
      )}
      {rejectingRequest ? (
        <form className="stack" onSubmit={rejectRequest}>
          <label className="field">
            <span>Reason for rejection (visible to the dentist)</span>
            <textarea
              className="input"
              required
              minLength={3}
              maxLength={1000}
              value={reason}
              disabled={busy}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
          <div className="row">
            <button
              type="submit"
              className="btn btn-danger"
              disabled={busy || reason.trim().length < 3}
            >
              {busy ? 'Saving…' : 'Confirm rejection'}
            </button>
            <button
              type="button"
              className="btn"
              disabled={busy}
              onClick={() => setRejectingRequest(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="row">
          <button
            type="button"
            className="btn btn-danger"
            disabled={busy}
            onClick={() => setRejectingRequest(true)}
          >
            Reject request
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy || !canApprove}
            onClick={approveRequest}
          >
            {busy ? 'Saving…' : 'Approve payout details'}
          </button>
        </div>
      )}
    </div>
  );
}

export function PayoutReviewCard({
  dentistId,
  canApprove,
}: {
  dentistId: string;
  canApprove: boolean;
}) {
  const card = useRef<HTMLElement>(null);
  const { hash } = useLocation();
  useEffect(() => {
    if (hash === '#payout-details')
      card.current?.scrollIntoView({ block: 'start' });
  }, [hash, dentistId]);
  const { data, error, isFetching, refetch } =
    useGetAdminDentistPayoutDetailsQuery(
      { dentistId },
      {
        pollingInterval: 15000,
        skipPollingIfUnfocused: true,
        refetchOnMountOrArgChange: true,
      },
    );
  const proposal = data?.request;

  return (
    <section
      ref={card}
      className="card stack"
      id="payout-details"
      style={{ scrollMarginTop: 120 }}
      aria-labelledby="payout-heading"
      aria-busy={isFetching}
    >
      <div className="row between">
        <h2 id="payout-heading">Payout and tax details</h2>
        <button
          type="button"
          className="btn"
          disabled={isFetching}
          onClick={() => void refetch()}
        >
          Refresh payout details
        </button>
      </div>
      {error ? (
        <p role="alert">
          Could not load payout details. Please refresh and try again.
        </p>
      ) : !data ? (
        <p className="small muted">Loading payout details…</p>
      ) : (
        <>
          <div className="dentist-detail-grid">
            <div>
              <h3>Approved account</h3>
              {data.approved ? (
                <AccountDetails details={data.approved} />
              ) : (
                <p className="small muted">No approved payout account yet.</p>
              )}
            </div>
            {proposal?.status === 'pending' && (
              <div className="card flat">
                <h3>Details submitted for approval</h3>
                <p className="small muted">
                  Submitted{' '}
                  {new Date(proposal.submittedAt).toLocaleString('en-IN', {
                    timeZone: 'Asia/Kolkata',
                  })}{' '}
                  IST
                </p>
                <AccountDetails details={proposal} />
                <p className="hint">
                  The approved account stays active until this request is
                  approved.
                </p>
                <ReviewActions
                  key={proposal.id}
                  request={proposal}
                  canApprove={canApprove}
                  onChanged={() => void refetch()}
                />
              </div>
            )}
          </div>
          {proposal && proposal.status !== 'pending' && (
            <div className="card flat stack" role="status">
              <span
                className={`badge ${
                  proposal.status === 'approved' ? 'green' : 'red'
                }`}
              >
                Latest request {proposal.status}
              </span>
              {proposal.rejectionReason && (
                <p className="small">Reason: {proposal.rejectionReason}</p>
              )}
              {proposal.reviewedAt && (
                <p className="small muted">
                  Reviewed{' '}
                  {new Date(proposal.reviewedAt).toLocaleString('en-IN', {
                    timeZone: 'Asia/Kolkata',
                  })}{' '}
                  IST
                </p>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
