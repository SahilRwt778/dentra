import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useGetAdminAppointmentsQuery } from '@/api/generated-api';
import { AppointmentTable } from '@/components/appointment-table';
import { PatientPagination } from './patient-ui';

export function PatientAppointments({ patientId }: { patientId: string }) {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const {
    currentData: data,
    error,
    isFetching,
    refetch,
  } = useGetAdminAppointmentsQuery(
    { patientId, filter: 'all', page, limit },
    { refetchOnMountOrArgChange: true },
  );
  return (
    <section
      className="stack patient-history"
      aria-label="Patient appointment history"
    >
      <div className="row between patient-section-heading">
        <div>
          <h2>Appointment history</h2>
          <p className="small muted">
            Latest bookings first, across all dentists.
          </p>
        </div>
        <div className="row patient-history-actions">
          <label className="field">
            <span>Appointments per page</span>
            <select
              className="input"
              value={limit}
              onChange={(event) => {
                setLimit(Number(event.target.value));
                setPage(1);
              }}
            >
              {[10, 20, 50, 100].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="btn"
            disabled={isFetching}
            onClick={() => void refetch()}
          >
            <RefreshCw size={16} /> Refresh appointments
          </button>
        </div>
      </div>
      {error ? (
        <div className="card stack" role="alert">
          <h3>Could not load appointment history</h3>
          <p>Please try again.</p>
          <button
            type="button"
            className="btn"
            disabled={isFetching}
            onClick={() => void refetch()}
          >
            Try again
          </button>
        </div>
      ) : !data ? (
        <p className="muted" role="status">
          Loading appointments…
        </p>
      ) : (
        <>
          <AppointmentTable items={data.items} />
          <PatientPagination
            page={data.page}
            limit={data.limit}
            total={data.total}
            nextPage={data.nextPage}
            busy={isFetching}
            onChange={setPage}
            label="Patient appointment pages"
            itemLabel="appointments"
          />
        </>
      )}
    </section>
  );
}
