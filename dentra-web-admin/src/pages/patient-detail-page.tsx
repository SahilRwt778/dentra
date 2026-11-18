import { formatPatientDate } from '@/utils/patients';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { useGetAdminPatientsByPatientIdQuery } from '@/api/generated-api';
import { PageHead } from '@/components/page-head';
import { ProfileAvatar } from '@/components/profile-avatar';
import { PatientAppointments } from '@/components/patients/patient-appointments';
import {
  PatientDetailField,
  PatientStatusBadge,
} from '@/components/patients/patient-ui';

export function PatientDetailPage() {
  const { patientId = '' } = useParams<{ patientId: string }>();
  const {
    currentData: patient,
    error,
    isFetching,
    refetch,
  } = useGetAdminPatientsByPatientIdQuery(
    { patientId },
    { skip: !patientId, refetchOnMountOrArgChange: true },
  );
  const notFound = error && 'status' in error && error.status === 404;
  return (
    <>
      <PageHead
        title={patient?.fullName || 'Patient details'}
        subtitle="Patient profile, contact information and bookings."
        actions={
          <button
            type="button"
            className="btn"
            disabled={isFetching || !patientId}
            onClick={() => void refetch()}
          >
            <RefreshCw size={16} /> Refresh profile
          </button>
        }
      />
      <Link className="patient-back-link" to="/patients">
        <ArrowLeft size={16} /> Back to patients
      </Link>
      {error ? (
        <div className="card stack" role="alert">
          <h2>
            {notFound ? 'Patient not found' : 'Could not load patient details'}
          </h2>
          <p>
            {notFound
              ? 'This patient record is no longer available.'
              : 'Please refresh and try again.'}
          </p>
          {!notFound && (
            <button
              type="button"
              className="btn"
              disabled={isFetching}
              onClick={() => void refetch()}
            >
              Try again
            </button>
          )}
        </div>
      ) : !patient ? (
        <p className="muted" role="status">
          Loading patient details…
        </p>
      ) : (
        <div className="stack" aria-busy={isFetching}>
          <section
            className="card patient-summary"
            aria-label="Patient profile"
          >
            <div className="patient-identity">
              <ProfileAvatar
                name={patient.fullName}
                photoUrl={patient.profilePhotoUrl}
              />
              <div>
                <h2>{patient.fullName}</h2>
                <p className="small muted">
                  {patient.age} years
                  {patient.gender
                    ? ` · ${patient.gender.replaceAll('_', ' ')}`
                    : ''}
                  {patient.city ? ` · ${patient.city}` : ''}
                </p>
              </div>
            </div>
            <PatientStatusBadge status={patient.status} />
          </section>
          <div className="patient-stats">
            <div className="card">
              <span className="muted">Appointments</span>
              <b>{patient.appointmentCount}</b>
            </div>
            <div className="card">
              <span className="muted">Completed visits</span>
              <b>{patient.completedCount}</b>
            </div>
            <div className="card">
              <span className="muted">Last completed visit</span>
              <b>
                {patient.lastVisitDate
                  ? formatPatientDate(patient.lastVisitDate)
                  : 'No visits yet'}
              </b>
            </div>
          </div>
          <div className="patient-detail-grid">
            <section className="card">
              <h2>Personal details</h2>
              <dl className="patient-fields">
                <PatientDetailField
                  label="Full name"
                  value={patient.fullName}
                />
                <PatientDetailField
                  label="Date of birth"
                  value={formatPatientDate(patient.dateOfBirth)}
                />
                <PatientDetailField
                  label="Gender"
                  value={patient.gender?.replaceAll('_', ' ')}
                />
                <PatientDetailField
                  label="Preferred language"
                  value={patient.preferredLanguage}
                />
                <PatientDetailField
                  label="Registered on"
                  value={formatPatientDate(patient.registeredAt)}
                />
              </dl>
            </section>
            <section className="card">
              <h2>Contact information</h2>
              <dl className="patient-fields">
                <PatientDetailField
                  label="Mobile number"
                  value={patient.mobile}
                />
                <PatientDetailField label="Email" value={patient.email} />
                <PatientDetailField label="City" value={patient.city} />
                <PatientDetailField
                  label="Emergency contact"
                  value={patient.emergencyContact}
                />
              </dl>
            </section>
            {patient.guardian && (
              <section className="card">
                <h2>Guardian</h2>
                <dl className="patient-fields">
                  <PatientDetailField
                    label="Name"
                    value={patient.guardian.name}
                  />
                  <PatientDetailField
                    label="Relationship"
                    value={patient.guardian.relationship}
                  />
                  <PatientDetailField
                    label="Mobile number"
                    value={patient.guardian.mobile}
                  />
                </dl>
              </section>
            )}
          </div>
          <PatientAppointments key={patient.id} patientId={patient.id} />
        </div>
      )}
    </>
  );
}
