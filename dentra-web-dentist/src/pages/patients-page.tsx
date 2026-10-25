import { useNavigate } from 'react-router-dom';
import { useGetDentistsMePatientsQuery } from '@/api/generated-api';
import { PageHead } from '@/components/page-head';
import { formatDate } from '@/lib/date';

export function PatientsPage() {
  const { data, isLoading } = useGetDentistsMePatientsQuery();
  const navigate = useNavigate();

  return (
    <>
      <PageHead title="Patients" subtitle="Everyone who has booked with you." />
      {isLoading ? (
        <p className="muted">Loading…</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Patient</th>
                <th>Age / sex</th>
                <th>Phone</th>
                <th>Last visit</th>
                <th>Visits</th>
              </tr>
            </thead>
            <tbody>
              {(data ?? []).length === 0 && (
                <tr>
                  <td colSpan={5} className="muted" style={{ textAlign: 'center' }}>
                    No patients yet.
                  </td>
                </tr>
              )}
              {(data ?? []).map((p) => (
                <tr key={p.id} className="clickable" onClick={() => navigate(`/patients/${p.id}`)}>
                  <td>
                    <b>{p.fullName}</b>
                  </td>
                  <td>
                    {p.age != null ? `${p.age} y, ` : ''}
                    {p.gender}
                  </td>
                  <td>{p.mobile}</td>
                  <td>{p.lastVisitDate ? formatDate(p.lastVisitDate) : '—'}</td>
                  <td>{p.visitCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
