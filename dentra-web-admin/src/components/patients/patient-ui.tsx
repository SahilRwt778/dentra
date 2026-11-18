import type { ReactNode } from 'react';
import type { AdminPatient } from '@/api/generated-api';

const STATUS = {
  active: { label: 'Active', className: 'badge green' },
  locked: { label: 'Locked', className: 'badge amber' },
  deleted: { label: 'Deleted', className: 'badge' },
};

export function PatientStatusBadge({
  status,
}: {
  status: AdminPatient['status'];
}) {
  const badge = STATUS[status];
  return <span className={badge.className}>{badge.label}</span>;
}

export function PatientDetailField({
  label,
  value,
}: {
  label: string;
  value?: ReactNode;
}) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value == null || value === '' ? 'Not provided' : value}</dd>
    </div>
  );
}

export function PatientPagination({
  page,
  limit,
  total,
  nextPage,
  busy,
  onChange,
  label = 'Patient pages',
  itemLabel = 'patients',
}: {
  page: number;
  limit: number;
  total: number;
  nextPage: number | null;
  busy: boolean;
  onChange: (page: number) => void;
  label?: string;
  itemLabel?: string;
}) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return (
    <nav className="row between patient-pagination" aria-label={label}>
      <span className="small muted">
        {total} {itemLabel} · Page {page} of {totalPages}
      </span>
      <div className="row">
        <button
          type="button"
          className="btn"
          disabled={page <= 1 || busy}
          onClick={() => onChange(page - 1)}
        >
          Previous
        </button>
        <button
          type="button"
          className="btn"
          disabled={!nextPage || busy}
          onClick={() => nextPage && onChange(nextPage)}
        >
          Next
        </button>
      </div>
    </nav>
  );
}
