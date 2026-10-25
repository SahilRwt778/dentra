import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import {
  useGetAdminAppointmentsQuery,
  type AppointmentStatus,
  type AppointmentType,
} from '@/api/generated-api';
import { PageHead } from '@/components/page-head';
import { AppointmentTable } from '@/components/appointment-table';

const PERIODS = [
  { value: 'today', label: 'Today' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'past', label: 'Past' },
  { value: 'all', label: 'All dates' },
] as const;
const STATUSES: Record<AppointmentStatus, string> = {
  booked: 'Scheduled',
  waiting: 'Waiting',
  in_consult: 'In consultation',
  completed: 'Completed',
  cancelled: 'Cancelled',
};
type Filters = {
  filter: (typeof PERIODS)[number]['value'];
  from: string;
  to: string;
  status: AppointmentStatus | '';
  type: AppointmentType | '';
  page: number;
  limit: number;
};
const initialFilters: Filters = {
  filter: 'today',
  from: '',
  to: '',
  status: '',
  type: '',
  page: 1,
  limit: 20,
};
function errorMessage(error: unknown) {
  const message = (error as { data?: { message?: string | string[] } })?.data
    ?.message;
  return Array.isArray(message)
    ? message.join('. ')
    : message ?? 'Please try again.';
}

export function AppointmentsPage() {
  const [filters, setFilters] = useState(initialFilters);
  const invalidRange = !!(
    filters.from &&
    filters.to &&
    filters.from > filters.to
  );
  const {
    currentData: data,
    error,
    isFetching,
    refetch,
  } = useGetAdminAppointmentsQuery(
    {
      filter: filters.filter,
      from: filters.from || undefined,
      to: filters.to || undefined,
      status: filters.status || undefined,
      type: filters.type || undefined,
      page: filters.page,
      limit: filters.limit,
    },
    { skip: invalidRange, refetchOnMountOrArgChange: true },
  );
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / filters.limit));
  const pageUnavailable = !!data && data.page > totalPages;
  const hasFilters =
    filters.filter !== 'today' ||
    !!(filters.from || filters.to || filters.status || filters.type);
  function updateFilters(next: Partial<Filters>) {
    setFilters((current) => ({ ...current, ...next, page: 1 }));
  }
  return (
    <>
      <PageHead
        title="Appointments"
        subtitle="Browse appointments across all clinics, including past visits."
        actions={
          <button
            type="button"
            className="btn"
            disabled={isFetching || invalidRange}
            onClick={() => {
              void refetch();
            }}
          >
            <RefreshCw size={16} />
            {isFetching ? 'Refreshing…' : 'Refresh'}
          </button>
        }
      />
      <section
        className="card appointments-filters"
        aria-label="Appointment filters"
      >
        <div
          className="choices appointments-periods"
          role="group"
          aria-label="Appointment period"
        >
          {PERIODS.map((period) => (
            <button
              key={period.value}
              type="button"
              className={`choice${
                filters.filter === period.value ? ' on' : ''
              }`}
              aria-pressed={filters.filter === period.value}
              onClick={() =>
                updateFilters({ filter: period.value, from: '', to: '' })
              }
            >
              {period.label}
            </button>
          ))}
        </div>
        <label className="field">
          <span>Date from</span>
          <input
            className="input"
            type="date"
            value={filters.from}
            max={filters.to || undefined}
            onChange={(event) =>
              updateFilters({ from: event.target.value, filter: 'all' })
            }
          />
        </label>
        <label className="field">
          <span>Date to</span>
          <input
            className="input"
            type="date"
            value={filters.to}
            min={filters.from || undefined}
            onChange={(event) =>
              updateFilters({ to: event.target.value, filter: 'all' })
            }
          />
        </label>
        <label className="field">
          <span>Status</span>
          <select
            className="input"
            value={filters.status}
            onChange={(event) =>
              updateFilters({ status: event.target.value as Filters['status'] })
            }
          >
            <option value="">All statuses</option>
            {Object.entries(STATUSES).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Visit type</span>
          <select
            className="input"
            value={filters.type}
            onChange={(event) =>
              updateFilters({ type: event.target.value as Filters['type'] })
            }
          >
            <option value="">All visit types</option>
            <option value="video">Video</option>
            <option value="clinic">In-clinic</option>
          </select>
        </label>
        <label className="field">
          <span>Appointments per page</span>
          <select
            className="input"
            value={filters.limit}
            onChange={(event) =>
              updateFilters({ limit: Number(event.target.value) })
            }
          >
            {[10, 20, 50, 100].map((limit) => (
              <option key={limit} value={limit}>
                {limit}
              </option>
            ))}
          </select>
        </label>
        {hasFilters && (
          <button
            type="button"
            className="btn"
            onClick={() =>
              setFilters((current) => ({
                ...initialFilters,
                limit: current.limit,
              }))
            }
          >
            Clear filters
          </button>
        )}
      </section>

      {invalidRange ? (
        <div className="card" role="alert">
          The start date must be on or before the end date.
        </div>
      ) : error ? (
        <div className="card stack" role="alert">
          <h2>Could not load appointments</h2>
          <p>{errorMessage(error)}</p>
          <button
            type="button"
            className="btn"
            disabled={isFetching}
            onClick={() => {
              void refetch();
            }}
          >
            Try again
          </button>
        </div>
      ) : !data ? (
        <p className="muted" role="status">
          Loading appointments…
        </p>
      ) : (
        <div aria-busy={isFetching}>
          {data.items.length ? (
            <AppointmentTable items={data.items} />
          ) : pageUnavailable ? (
            <div className="card empty">
              <h2>This page is no longer available</h2>
              <p>
                Appointments have changed. Return to the first page to see the
                latest results.
              </p>
              <button
                type="button"
                className="btn"
                disabled={isFetching}
                onClick={() =>
                  setFilters((current) => ({ ...current, page: 1 }))
                }
              >
                Return to first page
              </button>
            </div>
          ) : (
            <div className="card empty">
              <h2>No appointments match these filters</h2>
              <p>Try another date range, status or visit type.</p>
            </div>
          )}
          {!pageUnavailable && (
            <nav
              className="row between appointments-pagination"
              aria-label="Appointment pages"
            >
              <span className="small muted" aria-live="polite">
                {data.total > 0
                  ? `Showing ${(data.page - 1) * data.limit + 1}–${
                      (data.page - 1) * data.limit + data.items.length
                    } of ${data.total}`
                  : '0 appointments'}
                {' · '}Page {data.page} of {totalPages}
              </span>
              <div className="row">
                <button
                  type="button"
                  className="btn"
                  disabled={filters.page === 1 || isFetching}
                  onClick={() =>
                    setFilters((current) => ({
                      ...current,
                      page: current.page - 1,
                    }))
                  }
                >
                  Previous
                </button>
                <button
                  type="button"
                  className="btn"
                  disabled={!data.nextPage || isFetching}
                  onClick={() =>
                    setFilters((current) => ({
                      ...current,
                      page: data.nextPage!,
                    }))
                  }
                >
                  Next
                </button>
              </div>
            </nav>
          )}
        </div>
      )}
    </>
  );
}
