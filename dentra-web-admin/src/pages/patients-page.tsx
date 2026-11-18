import { formatPatientDate } from '@/utils/patients';
import { useState, type FormEvent, type MouseEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { RefreshCw, Search } from 'lucide-react';
import {
  useGetAdminPatientsQuery,
  type GetAdminPatientsApiArg,
} from '@/api/generated-api';
import { PageHead } from '@/components/page-head';
import { ProfileAvatar } from '@/components/profile-avatar';
import {
  PatientPagination,
  PatientStatusBadge,
} from '@/components/patients/patient-ui';

const INITIAL_FILTERS: GetAdminPatientsApiArg = { page: 1, limit: 20 };

export function PatientsPage() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [search, setSearch] = useState('');
  const {
    currentData: data,
    error,
    isFetching,
    refetch,
  } = useGetAdminPatientsQuery(filters, { refetchOnMountOrArgChange: true });

  function updateFilters(next: Partial<GetAdminPatientsApiArg>) {
    setFilters((current) => ({ ...current, ...next, page: 1 }));
  }
  function submitSearch(event: FormEvent) {
    event.preventDefault();
    updateFilters({ search: search.trim() || undefined });
  }
  function openPatient(event: MouseEvent<HTMLTableRowElement>, id: string) {
    if (!(event.target as HTMLElement).closest('a, button'))
      navigate(`/patients/${id}`);
  }

  return (
    <>
      <PageHead
        title="Patients"
        subtitle="Registered patients and their appointment history."
        actions={
          <button
            type="button"
            className="btn"
            disabled={isFetching}
            onClick={() => void refetch()}
          >
            <RefreshCw size={16} /> Refresh
          </button>
        }
      />
      <section className="card patient-filters" aria-label="Patient filters">
        <form className="patient-search" onSubmit={submitSearch}>
          <label className="field">
            <span>Find a patient</span>
            <input
              className="input"
              type="search"
              placeholder="Name, mobile number or email"
              value={search}
              maxLength={100}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <button type="submit" className="btn btn-primary">
            <Search size={16} /> Search
          </button>
        </form>
        <label className="field">
          <span>Account status</span>
          <select
            className="input"
            value={filters.status ?? ''}
            onChange={(event) =>
              updateFilters({
                status: (event.target.value ||
                  undefined) as GetAdminPatientsApiArg['status'],
              })
            }
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="locked">Locked</option>
            <option value="deleted">Deleted</option>
          </select>
        </label>
        <label className="field">
          <span>Patients per page</span>
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
        {(filters.search || filters.status) && (
          <button
            type="button"
            className="btn"
            onClick={() => {
              setSearch('');
              setFilters({ ...INITIAL_FILTERS, limit: filters.limit });
            }}
          >
            Clear filters
          </button>
        )}
      </section>
      {error ? (
        <div className="card stack" role="alert">
          <h2>Could not load patients</h2>
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
          Loading patients…
        </p>
      ) : (
        <>
          <div className="table-wrap" aria-busy={isFetching}>
            <table className="patient-table" aria-label="Patients">
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Mobile number</th>
                  <th>Age / gender</th>
                  <th>City</th>
                  <th>Appointments</th>
                  <th>Status</th>
                  <th>Registered</th>
                </tr>
              </thead>
              <tbody>
                {!data.items.length && (
                  <tr>
                    <td colSpan={7} className="muted patient-empty">
                      {filters.search || filters.status
                        ? 'No patients match these filters.'
                        : 'No patients on this page.'}
                    </td>
                  </tr>
                )}
                {data.items.map((patient) => (
                  <tr
                    key={patient.id}
                    className="patient-row"
                    onClick={(event) => openPatient(event, patient.id)}
                  >
                    <td>
                      <div className="patient-identity">
                        <ProfileAvatar
                          name={patient.fullName}
                          photoUrl={patient.profilePhotoUrl}
                        />
                        <div>
                          <Link
                            className="patient-name"
                            to={`/patients/${patient.id}`}
                          >
                            <b>{patient.fullName}</b>
                          </Link>
                          <div className="tiny muted">
                            {patient.email || 'No email provided'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="patient-mobile">{patient.mobile}</td>
                    <td>
                      {patient.age} y
                      {patient.gender
                        ? `, ${patient.gender.replaceAll('_', ' ')}`
                        : ''}
                    </td>
                    <td>{patient.city || '—'}</td>
                    <td>
                      {patient.appointmentCount}
                      <div className="tiny muted">
                        {patient.completedCount} completed
                      </div>
                    </td>
                    <td>
                      <PatientStatusBadge status={patient.status} />
                    </td>
                    <td>{formatPatientDate(patient.registeredAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PatientPagination
            page={data.page}
            limit={data.limit}
            total={data.total}
            nextPage={data.nextPage}
            busy={isFetching}
            onChange={(page) => setFilters((current) => ({ ...current, page }))}
          />
        </>
      )}
    </>
  );
}
