import { Clock3, ShieldX, Toothbrush } from 'lucide-react';
import type { Dentist } from '@/api/generated-api';
import { useAuth } from '@/auth/auth-context';

const COPY: Record<string, { title: string; body: (d: Dentist) => string }> = {
  pending_review: {
    title: 'Waiting for admin verification',
    body: (d) =>
      `Your request has been sent to the admin${
        d.submittedAt
          ? ` on ${new Date(d.submittedAt).toLocaleDateString('en-IN', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            })}`
          : ''
      }. Please wait while your details and documents are verified. Your clinic portal will open once the admin approves your application.`,
  },
  rejected: {
    title: 'Application rejected',
    body: () =>
      'The admin has rejected your application. Contact the Dentra team if you need help with the decision.',
  },
  disabled: {
    title: 'Your account is disabled',
    body: () =>
      "Your account has been disabled and you're no longer visible to patients. Contact support if you think this is a mistake.",
  },
};

export function AccountStatusPage({
  dentist,
  onRefresh,
  refreshing,
}: {
  dentist: Dentist;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const { logout } = useAuth();
  const copy = COPY[dentist.status ?? 'pending_review'] ?? COPY.pending_review;

  return (
    <div className="login-wrap">
      <div className="login-card" style={{ textAlign: 'center' }}>
        <div className="brand" style={{ justifyContent: 'center' }}>
          <Toothbrush />
          Dentra
        </div>
        <div
          className={`application-status-icon ${
            dentist.status === 'rejected' || dentist.status === 'disabled' ? 'rejected' : ''
          }`}
        >
          {dentist.status === 'rejected' || dentist.status === 'disabled' ? (
            <ShieldX size={32} />
          ) : (
            <Clock3 size={32} />
          )}
        </div>
        <h1 style={{ marginTop: 18 }}>{copy.title}</h1>
        <p className="muted small" style={{ margin: '10px 0 20px' }}>
          {copy.body(dentist)}
        </p>
        {dentist.status === 'rejected' && dentist.rejectionReason && (
          <div className="application-rejection" role="alert">
            <b>Reason from admin</b>
            <p>{dentist.rejectionReason}</p>
          </div>
        )}
        <p className="small muted">
          {dentist.fullName} · {dentist.mobile}
        </p>
        <button
          type="button"
          className="btn btn-primary btn-block"
          disabled={refreshing}
          onClick={onRefresh}
          style={{ marginBottom: 10 }}
        >
          {refreshing ? 'Checking…' : 'Check application status'}
        </button>
        <p className="hint">This page also checks for updates automatically.</p>
        <button type="button" className="btn btn-block" onClick={logout}>
          Log out
        </button>
      </div>
    </div>
  );
}
