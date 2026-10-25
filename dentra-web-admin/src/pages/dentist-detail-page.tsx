import type { ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import {
  useGetAdminDentistsByDentistIdQuery,
  type DentistStatus,
} from '@/api/generated-api';
import { DocumentChecklist } from '@/components/document-checklist';
import { PageHead } from '@/components/page-head';
import { PayoutReviewCard } from '@/components/payout-review-card';

const STATUS_BADGES: Record<
  DentistStatus,
  { label: string; className: string }
> = {
  draft: { label: 'Draft', className: 'badge' },
  pending_review: {
    label: 'Waiting for verification',
    className: 'badge amber',
  },
  verified: { label: 'Verified', className: 'badge green' },
  rejected: { label: 'Rejected', className: 'badge red' },
  disabled: { label: 'Disabled', className: 'badge amber' },
};

function DetailField({ label, value }: { label: string; value?: ReactNode }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value == null || value === '' ? 'Not provided' : value}</dd>
    </div>
  );
}

function formatDate(value?: string | null) {
  if (!value) return 'Not provided';
  return new Date(value).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });
}

function formatFee(paise?: number) {
  return paise == null
    ? 'Not provided'
    : `₹${(paise / 100).toLocaleString('en-IN')}`;
}

function formatHours(from?: string | null, to?: string | null) {
  return from && to ? `${from.slice(0, 5)}–${to.slice(0, 5)}` : 'Not set';
}

export function DentistDetailPage() {
  const { dentistId = '' } = useParams<{ dentistId: string }>();
  const {
    currentData: dentist,
    error,
    isFetching,
    refetch,
  } = useGetAdminDentistsByDentistIdQuery(
    { dentistId },
    { skip: !dentistId, refetchOnMountOrArgChange: true },
  );
  const status = dentist?.status ? STATUS_BADGES[dentist.status] : undefined;
  const notFound = error && 'status' in error && error.status === 404;

  return (
    <>
      <PageHead
        title={dentist?.fullName || 'Dentist details'}
        subtitle="Contact information, professional details and onboarding documents."
        actions={
          <button
            type="button"
            className="btn"
            disabled={isFetching || !dentistId}
            onClick={() => void refetch()}
          >
            <RefreshCw size={16} />
            {isFetching ? 'Refreshing…' : 'Refresh'}
          </button>
        }
      />
      <Link className="dentist-back-link" to="/dentists">
        <ArrowLeft size={16} /> Back to dentists
      </Link>

      {error ? (
        <div className="card stack" role="alert">
          <h2>
            {notFound ? 'Dentist not found' : 'Could not load dentist details'}
          </h2>
          <p>
            {notFound
              ? 'This dentist record is no longer available.'
              : 'Please refresh and try again.'}
          </p>
        </div>
      ) : !dentist ? (
        <p className="muted" role="status">
          Loading dentist details…
        </p>
      ) : (
        <div className="stack" aria-busy={isFetching}>
          <section className="card dentist-summary" aria-label="Dentist status">
            <div className="row">
              <div className="avatar" aria-hidden="true">
                {dentist.fullName
                  ?.split(' ')
                  .filter(Boolean)
                  .map((part) => part[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase() || 'D'}
              </div>
              <div>
                <h2>{dentist.fullName || 'Dentist'}</h2>
                <p className="small muted">
                  {dentist.qualification || 'Qualification pending'} ·{' '}
                  {dentist.specialization || 'Specialty pending'}
                </p>
              </div>
            </div>
            <div className="row dentist-summary-actions">
              {status && (
                <span className={status.className}>{status.label}</span>
              )}
              {dentist.status === 'pending_review' && (
                <Link
                  className="btn btn-primary"
                  to={`/dentists/review?dentistId=${dentistId}`}
                >
                  Review application
                </Link>
              )}
            </div>
          </section>

          <div className="dentist-detail-grid">
            <section className="card">
              <h2>Contact and professional details</h2>
              <dl className="dentist-fields">
                <DetailField label="Full name" value={dentist.fullName} />
                <DetailField label="Mobile number" value={dentist.mobile} />
                <DetailField label="Email" value={dentist.email} />
                <DetailField
                  label="Qualification"
                  value={dentist.qualification}
                />
                <DetailField label="Specialty" value={dentist.specialization} />
                <DetailField
                  label="Experience"
                  value={
                    dentist.yearsExperience == null
                      ? undefined
                      : `${dentist.yearsExperience} years`
                  }
                />
                <DetailField
                  label="Languages"
                  value={dentist.languages?.join(', ')}
                />
                <DetailField
                  label="Council registration number"
                  value={dentist.councilRegNo}
                />
                <DetailField
                  label="Registration valid until"
                  value={formatDate(dentist.councilRegValidTill)}
                />
              </dl>
            </section>

            <section className="card">
              <h2>Consultations</h2>
              <dl className="dentist-fields">
                <DetailField
                  label="In-clinic consultation fee"
                  value={formatFee(dentist.feeClinicPaise)}
                />
                <DetailField
                  label="Video consultations"
                  value={dentist.offersVideo ? 'Offered' : 'Not offered'}
                />
                {dentist.offersVideo && (
                  <>
                    <DetailField
                      label="Video consultation fee"
                      value={formatFee(dentist.feeVideoPaise)}
                    />
                    <DetailField
                      label="Video consultation hours (IST)"
                      value={formatHours(
                        dentist.videoHoursFrom,
                        dentist.videoHoursTo,
                      )}
                    />
                  </>
                )}
              </dl>
              <div className="divider" />
              <h2>Onboarding</h2>
              <dl className="dentist-fields">
                <DetailField
                  label="Submitted by"
                  value={
                    dentist.submittedBy === 'admin'
                      ? 'Admin'
                      : dentist.submittedBy === 'self'
                      ? 'Dentist'
                      : undefined
                  }
                />
                <DetailField
                  label="Submitted on"
                  value={formatDate(dentist.submittedAt)}
                />
                <DetailField
                  label="Reviewed on"
                  value={formatDate(dentist.reviewedAt)}
                />
                <DetailField
                  label="Resubmissions"
                  value={dentist.resubmissionCount ?? 0}
                />
                {dentist.rejectionReason && (
                  <DetailField
                    label="Rejection reason"
                    value={dentist.rejectionReason}
                  />
                )}
              </dl>
            </section>
          </div>

          <section className="card">
            <h2>Clinics</h2>
            {dentist.clinics?.length ? (
              <div className="dentist-clinic-grid">
                {dentist.clinics.map((clinic) => (
                  <article key={clinic.id} className="card flat">
                    <h3>{clinic.name || 'Clinic'}</h3>
                    <dl className="dentist-fields">
                      <DetailField label="Address" value={clinic.addressLine} />
                      <DetailField label="PIN code" value={clinic.pincode} />
                      <DetailField label="Phone" value={clinic.phone} />
                      <DetailField
                        label="Opening hours (IST)"
                        value={formatHours(clinic.hoursFrom, clinic.hoursTo)}
                      />
                    </dl>
                  </article>
                ))}
              </div>
            ) : (
              <p className="small muted">No active clinics added.</p>
            )}
          </section>

          <section className="card">
            <h2>Documents</h2>
            <DocumentChecklist dentist={dentist} />
          </section>

          <PayoutReviewCard
            dentistId={dentistId}
            canApprove={dentist.status === 'verified'}
          />
        </div>
      )}
    </>
  );
}
