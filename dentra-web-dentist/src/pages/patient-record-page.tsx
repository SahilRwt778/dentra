import { useParams, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useGetDentistsMePatientsByPatientIdQuery } from '@/api/generated-api';
import { PageHead } from '@/components/page-head';
import { DentalChart, ChartLegend, type ChartState } from '@/components/dental-chart';
import { statusBadge } from '@/lib/status';
import { formatDate, age } from '@/lib/date';

export function PatientRecordPage() {
  const { patientId } = useParams<{ patientId: string }>();
  const { data: patient, isLoading } = useGetDentistsMePatientsByPatientIdQuery({ patientId: patientId! });

  if (isLoading || !patient) {
    return (
      <>
        <PageHead title="Patient record" subtitle="View patient details and visit history." />
        <p className="muted">Loading…</p>
      </>
    );
  }

  const chart: ChartState = {};
  for (const entry of patient.chart ?? []) {
    if (entry.toothNumber) chart[entry.toothNumber] = entry.status ?? '';
  }

  const patientAge = patient.dateOfBirth ? age(patient.dateOfBirth) : null;

  return (
    <>
      <Link to="/patients" className="back-link">
        <ArrowLeft size={16} />
        Patients
      </Link>
      <PageHead
        title={patient.fullName ?? ''}
        subtitle={`${patientAge != null ? `${patientAge} y, ` : ''}${patient.gender ?? ''} · ${patient.mobile ?? ''} · ${patient.city ?? ''}`}
      />
      <div className="two-col">
        <aside className="stack">
          <div className="card">
            <h3 style={{ marginBottom: 10 }}>Medical history</h3>
            <dl className="kv">
              <dt>Allergies</dt>
              <dd>{patient.allergies}</dd>
              <dt>Conditions</dt>
              <dd>{patient.conditions}</dd>
              <dt>Medicines</dt>
              <dd>{patient.medications}</dd>
              <dt>Emergency</dt>
              <dd>{patient.emergencyContact || '—'}</dd>
              <dt>Language</dt>
              <dd>{patient.preferredLanguage}</dd>
            </dl>
          </div>
        </aside>
        <div className="stack">
          <div className="card">
            <h3 style={{ marginBottom: 12 }}>Dental chart</h3>
            <DentalChart chart={chart} editable={false} />
            <div style={{ marginTop: 12 }}>
              <ChartLegend />
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Reason</th>
                  <th>Diagnosis</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {(patient.appointments ?? []).map((a) => {
                  const badge = statusBadge(a.status);
                  return (
                    <tr key={a.id} className="clickable">
                      <td>{formatDate(a.date)}</td>
                      <td>{a.concern}</td>
                      <td>{a.diagnosis ?? '—'}</td>
                      <td>
                        <span className={badge.className}>{badge.label}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
