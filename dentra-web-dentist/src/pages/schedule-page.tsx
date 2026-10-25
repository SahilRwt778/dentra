import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useGetAppointmentsQuery } from '@/api/generated-api';
import { PageHead } from '@/components/page-head';
import { addDaysIso, todayIso, formatDate, formatTime } from '@/lib/date';
import { statusBadge } from '@/lib/status';

function DayRows({ date }: { date: string }) {
  const [page, setPage] = useState(1);
  const { currentData: data, isFetching, error, refetch } = useGetAppointmentsQuery(
    { date, page },
    { refetchOnMountOrArgChange: true, refetchOnFocus: true, refetchOnReconnect: true },
  );
  // The API returns the latest appointments first, including across pages.
  const items = data?.items ?? [];
  const weekday = new Date(`${date}T12:00:00`).toLocaleDateString('en-IN', { weekday: 'long' });
  const hasPages = page > 1 || !!data?.nextPage;

  return (
    <tbody aria-label={`${weekday}, ${formatDate(date)}`} aria-busy={isFetching}>
      <tr className={`schedule-day${date === todayIso() ? ' schedule-today' : ''}`}>
        <th scope="rowgroup" colSpan={6}>
          <div className="row wrap between">
            <div className="row wrap">
              <time dateTime={date}>{weekday}, {formatDate(date)}</time>
              {date === todayIso() && <span className="badge teal">Today</span>}
            </div>
            {data && !error && (
              <span className="small muted">
                {items.length} {items.length === 1 ? 'appointment' : 'appointments'}
                {hasPages ? ' on this page' : ''}
              </span>
            )}
          </div>
        </th>
      </tr>
      {error ? (
        <tr>
          <td colSpan={6}>
            <div className="row wrap between" role="alert">
              <span>Could not load appointments for this day.</span>
              <button type="button" className="btn" disabled={isFetching} onClick={() => refetch()}>
                {isFetching ? 'Retrying…' : 'Try again'}
              </button>
            </div>
          </td>
        </tr>
      ) : !data ? (
        <tr><td colSpan={6} className="muted" role="status">Loading appointments…</td></tr>
      ) : items.length === 0 ? (
        <tr><td colSpan={6} className="muted">No appointments for this day.</td></tr>
      ) : items.map((appointment) => {
        const badge = statusBadge(appointment.status);
        return (
          <tr key={appointment.id}>
            <td className="schedule-time"><b>{formatTime(appointment.time)}</b></td>
            <td>
              {appointment.patientName || '—'}
              <div className="tiny muted">
                {[
                  appointment.patientAge != null ? `${appointment.patientAge} y` : null,
                  appointment.patientGender,
                ].filter(Boolean).join(', ')}
              </div>
            </td>
            <td>{appointment.type === 'video' ? 'Video' : 'In-clinic'}</td>
            <td className="schedule-reason">
              {appointment.concern || '—'}
              {appointment.symptomArea && <div className="tiny muted">{appointment.symptomArea}</div>}
            </td>
            <td><span className={badge.className}>{badge.label}</span></td>
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
      {hasPages && (
        <tr>
          <td colSpan={6}>
            <nav className="row wrap between" aria-label={`Appointments on ${formatDate(date)}`}>
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
          </td>
        </tr>
      )}
    </tbody>
  );
}

export function SchedulePage() {
  const days = Array.from({ length: 7 }, (_, n) => addDaysIso(n));
  const [selectedDate, setSelectedDate] = useState(todayIso);

  return (
    <>
      <PageHead title="Schedule" subtitle="Choose a day to view its appointments." />
      <nav className="schedule-dates" aria-label="Choose appointment day">
        {days.map((date, index) => {
          const label = index === 0 ? 'Today' : index === 1 ? 'Tomorrow' :
            new Date(`${date}T12:00:00`).toLocaleDateString('en-IN', { weekday: 'short' });
          return (
            <button
              key={date}
              type="button"
              className="schedule-date"
              aria-pressed={date === selectedDate}
              aria-label={`${label}, ${formatDate(date)}`}
              aria-controls="schedule-appointments"
              onClick={() => setSelectedDate(date)}
            >
              <span>{label}</span>
              <strong><time dateTime={date}>{formatDate(date).slice(0, 6)}</time></strong>
            </button>
          );
        })}
      </nav>
      <div id="schedule-appointments" className="table-wrap">
        <table className="schedule-table" aria-label={`Appointments on ${formatDate(selectedDate)}`}>
          <thead>
            <tr>
              <th scope="col">Time</th>
              <th scope="col">Patient</th>
              <th scope="col">Visit</th>
              <th scope="col">Reason</th>
              <th scope="col">Status</th>
              <th scope="col"><span className="schedule-action-label">Appointment details</span></th>
            </tr>
          </thead>
          <DayRows key={selectedDate} date={selectedDate} />
        </table>
      </div>
    </>
  );
}
