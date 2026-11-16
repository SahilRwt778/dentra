import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useGetAppointmentsQuery } from '@/api/generated-api';
import type { AppointmentStatus } from '@/api/generated-api';
import { PageHead } from '@/components/page-head';
import { todayIso, formatDate, formatTime } from '@/lib/date';
import { statusBadge, STATUS_BADGE } from '@/lib/status';

// All possible statuses in display order
const STATUS_OPTIONS: { value: AppointmentStatus | ''; label: string }[] = [
  { value: '', label: 'All statuses' },
  { value: 'booked', label: STATUS_BADGE.booked.label },
  { value: 'waiting', label: STATUS_BADGE.waiting.label },
  { value: 'in_consult', label: STATUS_BADGE.in_consult.label },
  { value: 'completed', label: STATUS_BADGE.completed.label },
  { value: 'cancelled', label: STATUS_BADGE.cancelled.label },
];

function AppointmentRows({
  date,
  status,
  search,
}: {
  date: string;
  status: AppointmentStatus | '';
  search: string;
}) {
  const [page, setPage] = useState(1);

  const { currentData: data, isFetching, error, refetch } = useGetAppointmentsQuery(
    {
      date,
      status: status || undefined,
      page,
    },
    { refetchOnMountOrArgChange: true, refetchOnFocus: true, refetchOnReconnect: true },
  );

  // Client-side patient name filter
  const allItems = data?.items ?? [];
  const items = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allItems;
    return allItems.filter((a) =>
      (a.patientName ?? '').toLowerCase().includes(q),
    );
  }, [allItems, search]);

  const hasPages = page > 1 || !!data?.nextPage;

  if (error) {
    return (
      <div className="row wrap between" role="alert" style={{ padding: '16px 0' }}>
        <span>Could not load appointments.</span>
        <button type="button" className="btn" disabled={isFetching} onClick={() => refetch()}>
          {isFetching ? 'Retrying…' : 'Try again'}
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="muted" role="status" style={{ padding: '16px 0' }}>
        Loading appointments…
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="muted" style={{ padding: '16px 0' }}>
        {search.trim()
          ? `No appointments match "${search.trim()}".`
          : 'No appointments found for the selected filters.'}
      </div>
    );
  }

  return (
    <>
      <div className="table-wrap">
        <table
          className="schedule-table"
          aria-label={`Appointments on ${formatDate(date)}`}
          aria-busy={isFetching}
        >
          <thead>
            <tr>
              <th scope="col">Time</th>
              <th scope="col">Patient</th>
              <th scope="col">Visit</th>
              <th scope="col">Reason</th>
              <th scope="col">Status</th>
              <th scope="col">
                <span className="schedule-action-label">Appointment details</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((appointment) => {
              const badge = statusBadge(appointment.status);
              return (
                <tr key={appointment.id}>
                  <td className="schedule-time">
                    <b>{formatTime(appointment.time)}</b>
                  </td>
                  <td>
                    {appointment.patientName || '—'}
                    <div className="tiny muted">
                      {[
                        appointment.patientAge != null ? `${appointment.patientAge} y` : null,
                        appointment.patientGender,
                      ]
                        .filter(Boolean)
                        .join(', ')}
                    </div>
                  </td>
                  <td>{appointment.type === 'video' ? 'Video' : 'In-clinic'}</td>
                  <td className="schedule-reason">
                    {appointment.concern || '—'}
                    {appointment.symptomArea && (
                      <div className="tiny muted">{appointment.symptomArea}</div>
                    )}
                  </td>
                  <td>
                    <span className={badge.className}>{badge.label}</span>
                  </td>
                  <td className="schedule-action">
                    {appointment.id && (
                      <Link
                        className="btn"
                        to={`/consult/${appointment.id}`}
                        aria-label={`View appointment for ${appointment.patientName || 'patient'} at ${formatTime(appointment.time)} on ${formatDate(date)}`}
                      >
                        View appointment
                      </Link>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {hasPages && (
        <nav
          className="row wrap between"
          aria-label={`Appointments on ${formatDate(date)}`}
          style={{ marginTop: 12 }}
        >
          <span className="small muted">Page {page} · Latest times first</span>
          <div className="row">
            <button
              type="button"
              className="btn"
              disabled={page === 1 || isFetching}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </button>
            <button
              type="button"
              className="btn"
              disabled={!data?.nextPage || isFetching || !!error}
              onClick={() => setPage(data?.nextPage ?? page)}
            >
              Next
            </button>
          </div>
        </nav>
      )}
    </>
  );
}

export function SchedulePage() {
  const [selectedDate, setSelectedDate] = useState(todayIso);
  const [selectedStatus, setSelectedStatus] = useState<AppointmentStatus | ''>('');
  const [search, setSearch] = useState('');

  return (
    <>
      <PageHead title="Schedule" subtitle="Browse appointments by date, status, or patient name." />

      {/* ── Filter bar ── */}
      <div className="schedule-filters" role="search" aria-label="Appointment filters">
        {/* Date picker */}
        <div className="schedule-filter-group">
          <label htmlFor="schedule-date-pick" className="schedule-filter-label">
            Date
          </label>
          <input
            id="schedule-date-pick"
            type="date"
            className="schedule-filter-input"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value || todayIso())}
            aria-label="Select appointment date"
          />
        </div>

        {/* Status filter */}
        <div className="schedule-filter-group">
          <label htmlFor="schedule-status-pick" className="schedule-filter-label">
            Status
          </label>
          <select
            id="schedule-status-pick"
            className="schedule-filter-input"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value as AppointmentStatus | '')}
            aria-label="Filter by status"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Patient name search */}
        <div className="schedule-filter-group schedule-filter-search">
          <label htmlFor="schedule-patient-search" className="schedule-filter-label">
            Patient
          </label>
          <input
            id="schedule-patient-search"
            type="search"
            className="schedule-filter-input"
            placeholder="Search by patient name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search appointments by patient name"
          />
        </div>

        {/* Active-date chip */}
        <div className="schedule-filter-date-chip" aria-live="polite" aria-atomic="true">
          <span className="small muted">
            Showing:{' '}
            <strong>
              {selectedDate === todayIso()
                ? `Today · ${formatDate(selectedDate)}`
                : formatDate(selectedDate)}
            </strong>
          </span>
          {selectedDate !== todayIso() && (
            <button
              type="button"
              className="btn-link small"
              onClick={() => setSelectedDate(todayIso())}
              aria-label="Jump to today"
            >
              Jump to today
            </button>
          )}
        </div>
      </div>

      {/* ── Appointments ── */}
      <div id="schedule-appointments">
        <AppointmentRows
          key={`${selectedDate}-${selectedStatus}`}
          date={selectedDate}
          status={selectedStatus}
          search={search}
        />
      </div>
    </>
  );
}
