import { AppointmentPaymentCard } from '@/components/payments/appointment-payment-card';
import { lazy, Suspense, useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, AlertTriangle, X, Plus } from 'lucide-react';
import {
  useGetAppointmentsByAppointmentIdQuery,
  useGetAppointmentsByAppointmentIdConsultationQuery,
  usePutAppointmentsByAppointmentIdConsultationMutation,
  usePostAppointmentsByAppointmentIdConsultationCompleteMutation,
  usePostAppointmentsByAppointmentIdPrescriptionSignMutation,
  usePostAppointmentsByAppointmentIdPrescriptionOtpMutation,
  usePostAppointmentsByAppointmentIdStartMutation,
  usePostAppointmentsByAppointmentIdRescheduleMutation,
  useGetDentistsMePatientsByPatientIdQuery,
  useGetDentistsByDentistIdSlotsQuery,
  useGetDentistsMeQuery,
  type PrescriptionItemInput,
} from '@/api/generated-api';
import { PageHead } from '@/components/page-head';
import { AppointmentAttachments } from '@/components/appointment-attachments';
import { CareDocumentDownloads } from '@/components/care-document-downloads';
import { TreatmentProcedures } from '@/components/treatment-procedures';
import { Modal } from '@/components/modal';
import { DentalChart, ChartLegend, type ChartState } from '@/components/dental-chart';
import { statusBadge } from '@/lib/status';
import { formatDate, formatTime, dayLabel, addDaysIso, todayIso } from '@/lib/date';

const MED_PRESETS: PrescriptionItemInput[] = [
  {
    medicineName: 'Amoxicillin',
    strength: '500 mg capsule',
    dose: '1 capsule',
    frequency: 'Three times a day (1-1-1)',
    duration: '5 days',
    instructions: 'After food. Complete the full course.',
  },
  {
    medicineName: 'Metronidazole',
    strength: '400 mg tablet',
    dose: '1 tablet',
    frequency: 'Three times a day (1-1-1)',
    duration: '5 days',
    instructions: 'After food. Avoid alcohol during the course.',
  },
  {
    medicineName: 'Ibuprofen',
    strength: '400 mg tablet',
    dose: '1 tablet',
    frequency: 'Three times a day (1-1-1)',
    duration: '3 days',
    instructions: 'After food, for pain and swelling.',
  },
  {
    medicineName: 'Paracetamol',
    strength: '650 mg tablet',
    dose: '1 tablet',
    frequency: 'When needed for pain',
    duration: '3 days',
    instructions: 'Keep at least 6 hours between doses. Not more than 4 tablets a day.',
  },
  {
    medicineName: 'Chlorhexidine gluconate mouthwash',
    strength: '0.2%',
    dose: '10 ml',
    frequency: 'Twice a day (1-0-1)',
    duration: '7 days',
    instructions: 'Rinse for 30 seconds after brushing. Do not swallow.',
  },
  {
    medicineName: 'Potassium nitrate toothpaste',
    strength: '5%',
    dose: 'Pea-sized amount',
    frequency: 'Twice a day (1-0-1)',
    duration: '4 weeks',
    instructions: 'Use with a soft-bristle brush for sensitivity.',
  },
];

const EMPTY_MED: PrescriptionItemInput = {
  medicineName: '',
  strength: '',
  dose: '',
  frequency: '',
  duration: '',
  instructions: '',
};

const VideoConsultation = lazy(() =>
  import('@/components/video-consultation').then((module) => ({ default: module.VideoConsultation })),
);

function errorMessage(err: unknown, fallback: string): string {
  const message = (err as { data?: { message?: string | string[] } } | undefined)?.data?.message;
  return Array.isArray(message) ? message.join('. ') : message ?? fallback;
}

function RescheduleModal({
  appointmentId,
  dentistId,
  clinicId,
  type,
  onClose,
}: {
  appointmentId: string;
  dentistId: string;
  clinicId?: string | null;
  type: 'video' | 'clinic';
  onClose: () => void;
}) {
  const [date, setDate] = useState(addDaysIso(1));
  const [time, setTime] = useState('');
  const { data: slotData } = useGetDentistsByDentistIdSlotsQuery({
    dentistId,
    date,
    type,
    clinicId: clinicId ?? undefined,
  });
  const [reschedule, { isLoading }] = usePostAppointmentsByAppointmentIdRescheduleMutation();
  const days = Array.from({ length: 14 }, (_, n) => addDaysIso(n + 1)).slice(0, 5);

  async function confirm() {
    if (!time) return;
    try {
      await reschedule({ appointmentId, body: { date, time } }).unwrap();
      toast.success(`Rescheduled to ${dayLabel(date)}, ${formatTime(time)}`);
      onClose();
    } catch (err) {
      toast.error(errorMessage(err, 'Could not reschedule.'));
    }
  }

  return (
    <Modal open onClose={onClose}>
      <div className="row between" style={{ marginBottom: 14 }}>
        <h2>Reschedule</h2>
        <button type="button" className="btn" aria-label="Close" onClick={onClose}>
          <X size={16} />
        </button>
      </div>
      <div style={{ marginTop: 14 }}>
        <p className="q-label">New day</p>
        <div className="day-strip" style={{ display: 'flex', gap: 8, overflowX: 'auto' }}>
          {days.map((d) => (
            <button
              key={d}
              type="button"
              className={`choice${date === d ? ' on' : ''}`}
              onClick={() => {
                setDate(d);
                setTime('');
              }}
            >
              {dayLabel(d)}
            </button>
          ))}
        </div>
      </div>
      <div style={{ marginTop: 14 }}>
        <p className="q-label">New time</p>
        <div className="slot-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {(slotData?.slots ?? []).map((t) => (
            <button
              key={t}
              type="button"
              className={`choice${time === t ? ' on' : ''}`}
              onClick={() => setTime(t)}
            >
              {formatTime(t)}
            </button>
          ))}
        </div>
      </div>
      <p className="hint">The patient's original payment carries over. They're notified of the new time.</p>
      <div className="row" style={{ marginTop: 14, justifyContent: 'flex-end' }}>
        <button type="button" className="btn" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="btn btn-primary" disabled={!time || isLoading} onClick={confirm}>
          Confirm new time
        </button>
      </div>
    </Modal>
  );
}

export function ConsultPage() {
  const { appointmentId } = useParams<{ appointmentId: string }>();
  const navigate = useNavigate();
  const { data: me } = useGetDentistsMeQuery();
  const {
    currentData: appt,
    error: appointmentError,
    refetch: refreshAppointment,
  } = useGetAppointmentsByAppointmentIdQuery(
    { appointmentId: appointmentId! },
    { refetchOnMountOrArgChange: true, pollingInterval: 5000 },
  );
  const {
    currentData: consultation,
    error: consultationError,
    refetch: refreshConsultation,
  } = useGetAppointmentsByAppointmentIdConsultationQuery(
    { appointmentId: appointmentId! },
    { skip: !appt || (appt.status !== 'in_consult' && appt.status !== 'completed') },
  );
  const {
    currentData: patient,
    error: patientError,
    refetch: refreshPatient,
  } = useGetDentistsMePatientsByPatientIdQuery(
    { patientId: appt?.patientId ?? '' },
    { skip: !appt?.patientId, refetchOnMountOrArgChange: true },
  );

  const [start, { isLoading: isStarting }] = usePostAppointmentsByAppointmentIdStartMutation();
  const [saveDraft] = usePutAppointmentsByAppointmentIdConsultationMutation();
  const [isSaving, setIsSaving] = useState(false);
  const [complete, { isLoading: isCompleting }] =
    usePostAppointmentsByAppointmentIdConsultationCompleteMutation();
  const [signRx, { isLoading: isSigning }] = usePostAppointmentsByAppointmentIdPrescriptionSignMutation();
  const [requestSigningCode, { isLoading: isRequestingCode }] =
    usePostAppointmentsByAppointmentIdPrescriptionOtpMutation();

  const [showReschedule, setShowReschedule] = useState(false);
  const [showSign, setShowSign] = useState(false);
  const [signingOtpId, setSigningOtpId] = useState('');
  const [signingCode, setSigningCode] = useState('');
  const [signingError, setSigningError] = useState<string>();
  const [resendAt, setResendAt] = useState(0);
  const [otpNow, setOtpNow] = useState(Date.now);
  const [signedAt, setSignedAt] = useState<string | null>(null);
  const [allergyAck, setAllergyAck] = useState(false);
  const [allergyWarning, setAllergyWarning] = useState<string | null>(null);

  const [complaint, setComplaint] = useState('');
  const [findings, setFindings] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [treatment, setTreatment] = useState('');
  const [plan, setPlan] = useState('');
  const [followUp, setFollowUp] = useState('');
  const [chart, setChart] = useState<ChartState>({});
  const [brush, setBrush] = useState('caries');
  const [items, setItems] = useState<PrescriptionItemInput[]>([]);
  const [addingMed, setAddingMed] = useState(false);
  const [med, setMed] = useState<PrescriptionItemInput>(EMPTY_MED);

  const signed = !!(signedAt || consultation?.prescription?.signedAt);
  const [initializedFor, setInitializedFor] = useState<string>();
  const resendSeconds = Math.max(0, Math.ceil((resendAt - otpNow) / 1000));

  useEffect(() => {
    if (!showSign) return;
    const timer = setInterval(() => setOtpNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [showSign]);

  // Initialize the editable server draft once; later query refreshes must preserve unsaved edits.
  /* oxlint-disable react/set-state-in-effect */
  useEffect(() => {
    if (initializedFor === appointmentId) return;
    if (!appt || appt.status !== 'in_consult' || !consultation || !patient) return;

    setComplaint(consultation.chiefComplaint ?? '');
    setFindings(consultation.findings ?? '');
    setDiagnosis(consultation.diagnosis ?? '');
    setTreatment(consultation.treatmentDone ?? '');
    setPlan(consultation.plan ?? '');
    setFollowUp(consultation.followUpDate ?? '');
    setItems(consultation.prescription?.items ?? []);
    setSignedAt(consultation.prescription?.signedAt ?? null);
    const seeded: ChartState = {};
    for (const c of patient.chart ?? []) {
      if (c.toothNumber) seeded[c.toothNumber] = c.status ?? '';
    }
    setChart(seeded);
    setInitializedFor(appointmentId);
  }, [appointmentId, appt, consultation, patient, initializedFor]);
  /* oxlint-enable react/set-state-in-effect */

  if (appointmentError || patientError || consultationError)
    return (
      <>
        <PageHead title="Appointment" subtitle="Review the patient and manage their visit." />
        <div className="card stack" role="alert">
          <h2>Unable to load this visit</h2>
          <p className="muted">Reload the appointment and patient record before continuing.</p>
          <button
            type="button"
            className="btn"
            onClick={() => {
              void refreshAppointment();
              if (appt?.patientId) void refreshPatient();
              if (appt?.status === 'in_consult' || appt?.status === 'completed') void refreshConsultation();
            }}
          >
            Try again
          </button>
          <Link to="/schedule">Back to schedule</Link>
        </div>
      </>
    );
  if (
    !appt ||
    !patient ||
    ((appt.status === 'in_consult' || appt.status === 'completed') && !consultation) ||
    (appt.status === 'in_consult' && initializedFor !== appointmentId)
  )
    return (
      <>
        <PageHead title="Appointment" subtitle="Review the patient and manage their visit." />
        <p className="muted" role="status">
          Loading visit…
        </p>
      </>
    );

  const fromLabel = "Today's queue";

  async function persistDraft() {
    await saveDraft({
      appointmentId: appointmentId!,
      consultationDraft: {
        chiefComplaint: complaint,
        findings,
        diagnosis,
        treatmentDone: treatment,
        plan,
        followUpDate: followUp || null,
        chart: Object.entries(chart)
          .filter(([, status]) => status)
          .map(([toothNumber, status]) => ({ toothNumber, status: status as never })),
        // A signed medicine list is immutable; notes can still be saved before completion.
        prescriptionItems: signed ? undefined : items,
      },
    }).unwrap();
  }

  async function handleStart() {
    try {
      await start({ appointmentId: appointmentId! }).unwrap();
    } catch (err) {
      toast.error(errorMessage(err, 'Could not start the consultation.'));
    }
  }

  function toggleTooth(tooth: string) {
    setChart((c) => ({ ...c, [tooth]: c[tooth] === brush ? '' : brush }));
  }

  function addMedToList() {
    if (!med.medicineName.trim() || !med.dose.trim() || !med.frequency.trim() || !med.duration.trim()) {
      toast.error('Add the medicine name, dose, how often and for how long');
      return;
    }
    setItems((it) => [...it, med]);
    setMed(EMPTY_MED);
    setAddingMed(false);
  }

  async function openSign() {
    try {
      await persistDraft();
      setAllergyWarning(null);
      setAllergyAck(false);
      setSigningError(undefined);
      setShowSign(true);
    } catch (err) {
      toast.error(errorMessage(err, 'Could not save the draft before signing.'));
    }
  }

  async function sendSigningCode() {
    setSigningError(undefined);
    try {
      const challenge = await requestSigningCode({ appointmentId: appointmentId! }).unwrap();
      setSigningOtpId(challenge.otpId);
      setSigningCode('');
      setOtpNow(Date.now());
      setResendAt(Date.now() + challenge.resendAfterSeconds * 1000);
    } catch (err) {
      setSigningError(errorMessage(err, 'Could not send a signing code. Please try again.'));
    }
  }

  async function handleSign() {
    if (!signingOtpId || !/^[0-9]{4}$/.test(signingCode)) {
      setSigningError('Request a code and enter all four digits.');
      return;
    }
    setSigningError(undefined);
    try {
      const result = await signRx({
        appointmentId: appointmentId!,
        body: {
          otpId: signingOtpId,
          confirmationCode: signingCode,
          allergyOverrideAck: allergyAck || undefined,
        },
      }).unwrap();
      setSignedAt(result.prescription?.signedAt ?? null);
      setSigningCode('');
      setSigningOtpId('');
      toast.success('Prescription signed');
      setShowSign(false);
    } catch (err) {
      const message = errorMessage(err, 'Could not sign.');
      if (message.toLowerCase().includes('allergy')) {
        setAllergyWarning(message);
      } else {
        setSigningError(message);
      }
    }
  }

  async function handleComplete() {
    if (!diagnosis.trim()) {
      toast.error('Add a diagnosis to complete the consultation');
      return;
    }
    if (items.length > 0 && !signed) {
      toast.error('Sign the prescription before completing');
      return;
    }
    try {
      await persistDraft();
      await complete({ appointmentId: appointmentId! }).unwrap();
      toast.success("Consultation completed. Sent to the patient's app.");
      navigate('/');
    } catch (err) {
      toast.error(errorMessage(err, 'Could not complete the consultation.'));
    }
  }

  async function handleSave() {
    setIsSaving(true);
    try {
      await persistDraft();
      toast.success('Consultation draft saved');
    } catch (err) {
      toast.error(errorMessage(err, 'Could not save the draft.'));
    } finally {
      setIsSaving(false);
    }
  }

  const patientHeader = (
    <>
      <Link to="/" className="back-link">
        <ArrowLeft size={16} />
        {fromLabel}
      </Link>
      <PageHead
        title={appt.patientName ?? ''}
        subtitle={`${appt.patientAge != null ? `${appt.patientAge} y, ` : ''}${
          appt.patientGender ?? ''
        } · ${formatTime(appt.time)}, ${appt.type === 'video' ? 'Video consult' : 'In-clinic visit'}`}
        actions={<span className={statusBadge(appt.status).className}>{statusBadge(appt.status).label}</span>}
      />
    </>
  );

  const patientPanel = (
    <aside className="stack">
      <AppointmentPaymentCard key={appt.id} appointment={appt} disabled={!!appointmentError} />
      <div className="card">
        <h3 style={{ marginBottom: 10 }}>Reported by patient</h3>
        <dl className="kv">
          <dt>{(appt.concerns?.length ?? 0) > 1 ? 'Problems' : 'Problem'}</dt>
          <dd>
            <div className="row wrap" style={{ gap: 5 }}>
              {(appt.concerns?.length ? appt.concerns : [appt.concern]).filter(Boolean).map((c) => (
                <span key={c} className="badge teal">
                  {c}
                </span>
              ))}
            </div>
          </dd>
          <dt>Where</dt>
          <dd>{appt.symptomArea || '—'}</dd>
          <dt>Since</dt>
          <dd>{appt.symptomSince || '—'}</dd>
          {appt.painScore != null && (
            <>
              <dt>Pain</dt>
              <dd>{appt.painScore}/10</dd>
            </>
          )}
          <dt>Swelling</dt>
          <dd>{appt.swelling ? <span className="badge red">Yes</span> : 'No'}</dd>
          {appt.note && (
            <>
              <dt>Note</dt>
              <dd>{appt.note}</dd>
            </>
          )}
        </dl>
      </div>
      <div className="card">
        <h3 style={{ marginBottom: 10 }}>Medical history</h3>
        <dl className="kv">
          <dt>Allergies</dt>
          <dd>
            {patient?.allergies && !/none/i.test(patient.allergies) ? (
              <span className="badge red">{patient.allergies}</span>
            ) : (
              patient?.allergies
            )}
          </dd>
          <dt>Conditions</dt>
          <dd>{patient?.conditions}</dd>
          <dt>Medicines</dt>
          <dd>{patient?.medications}</dd>
        </dl>
      </div>
      <div className="card">
        <h3 style={{ marginBottom: 6 }}>Past visits with you</h3>
        {(patient?.appointments ?? []).filter((a) => a.status === 'completed' && a.id !== appt.id).length ? (
          (patient?.appointments ?? [])
            .filter((a) => a.status === 'completed' && a.id !== appt.id)
            .map((a) => (
              <div
                key={a.id}
                className="small"
                style={{ padding: '6px 0', borderBottom: '1px solid var(--line)' }}
              >
                <b>{formatDate(a.date)}</b>
                <div className="muted">{a.diagnosis ?? '—'}</div>
              </div>
            ))
        ) : (
          <p className="small muted">First visit with you.</p>
        )}
      </div>
    </aside>
  );

  if (appt.status === 'cancelled')
    return (
      <>
        {patientHeader}
        <AppointmentPaymentCard key={appt.id} appointment={appt} disabled={!!appointmentError} />
        <div className="card empty">
          <h3>Appointment cancelled</h3>
          <p className="muted" style={{ margin: '8px 0 16px' }}>
            This appointment cannot be started or completed.
          </p>
          <Link to="/schedule" className="btn">
            Back to schedule
          </Link>
        </div>
      </>
    );

  // Completed, read-only
  if (appt.status === 'completed') {
    return (
      <>
        {patientHeader}
        <div className="two-col">
          <div className="stack">{patientPanel}<AppointmentAttachments appointmentId={appointmentId!} /></div>
          <div className="stack">
            <div className="card row between wrap">
              <div>
                <b>Consultation completed</b>
                <div className="small muted">
                  {consultation?.isEdited && consultation.editedAt
                    ? `Last edited ${formatDate(consultation.editedAt.slice(0, 10))}`
                    : `Completed ${
                        appt.completedAt ? formatDate(appt.completedAt.slice(0, 10)) : formatDate(appt.date)
                      }`}
                </div>
              </div>
              <CareDocumentDownloads
                appointmentId={appointmentId!}
                hasPrescription={
                  !!consultation?.prescription?.signedAt && !!consultation.prescription.items?.length
                }
              />
            </div>
            <div className="card">
              <h3 style={{ marginBottom: 10 }}>Clinical note</h3>
              <dl className="kv">
                <dt>Chief complaint</dt>
                <dd>{consultation?.chiefComplaint || '—'}</dd>
                <dt>Findings</dt>
                <dd>{consultation?.findings || '—'}</dd>
                <dt>Diagnosis</dt>
                <dd>
                  <b>{consultation?.diagnosis}</b>
                </dd>
                <dt>Treatment done</dt>
                <dd>{consultation?.treatmentDone || '—'}</dd>
                <dt>Plan</dt>
                <dd>{consultation?.plan || '—'}</dd>
                <dt>Follow-up</dt>
                <dd>{consultation?.followUpDate ? formatDate(consultation.followUpDate) : '—'}</dd>
              </dl>
              <TreatmentProcedures items={consultation?.planItems} />
            </div>
            {consultation?.prescription ? (
              <div className="rx-sheet">
                <div className="rx-head">
                  <div>
                    <b>{appt.type === 'clinic' ? 'In-clinic visit' : 'Video consultation'}</b>
                    <div className="small muted">
                      {me?.fullName} · {me?.qualification}
                    </div>
                    <div className="tiny muted">Reg. No. {me?.councilRegNo}</div>
                  </div>
                  <div className="rx-symbol">℞</div>
                </div>
                <ol className="rx-items">
                  {(consultation.prescription.items ?? []).map((m, i) => (
                    <li key={i}>
                      <b>
                        {m.medicineName} {m.strength}
                      </b>
                      <div className="small">
                        {m.dose}, {m.frequency}, for {m.duration}
                      </div>
                      {m.instructions && <div className="small muted">{m.instructions}</div>}
                    </li>
                  ))}
                </ol>
                <div className="rx-sign">
                  {consultation.prescription.signedAt ? (
                    <>
                      <div style={{ fontFamily: "'Brush Script MT', cursive", fontSize: 20 }}>
                        {me?.fullName}
                      </div>
                      <div className="tiny muted">
                        Confirmed by signing code on{' '}
                        {formatDate(consultation.prescription.signedAt.slice(0, 10))}
                      </div>
                    </>
                  ) : (
                    <div className="tiny muted">Not signed yet</div>
                  )}
                </div>
              </div>
            ) : (
              <div className="card small muted">No prescription issued.</div>
            )}
          </div>
        </div>
      </>
    );
  }

  // Not started yet (booked/waiting), not editable today
  if (appt.status !== 'in_consult') {
    const future = appt.date && appt.date > todayIso();
    return (
      <>
        {patientHeader}
        <div className="two-col">
          <div className="stack">{patientPanel}<AppointmentAttachments appointmentId={appointmentId!} /></div>
          <div className="card empty" style={{ padding: 44 }}>
            <h3 style={{ color: 'var(--ink)' }}>Ready when you are</h3>
            <p style={{ margin: '6px 0 16px' }}>
              {appt.status === 'waiting'
                ? 'The patient is waiting.'
                : future
                ? `This appointment is on ${formatDate(appt.date)}.`
                : appt.type === 'video'
                ? "The patient hasn't joined the call yet."
                : "The patient hasn't checked in yet."}
            </p>
            <div className="row" style={{ justifyContent: 'center' }}>
              {future ? (
                <button type="button" className="btn btn-lg" disabled>
                  Available on {formatDate(appt.date)}
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary btn-lg"
                  disabled={isStarting}
                  onClick={handleStart}
                >
                  Start consultation
                </button>
              )}
              {appt.status === 'booked' && (
                <button type="button" className="btn btn-lg" onClick={() => setShowReschedule(true)}>
                  Reschedule
                </button>
              )}
            </div>
          </div>
        </div>
        {showReschedule && (
          <RescheduleModal
            appointmentId={appointmentId!}
            dentistId={appt.dentistId!}
            clinicId={appt.clinicId}
            type={appt.type ?? 'clinic'}
            onClose={() => setShowReschedule(false)}
          />
        )}
      </>
    );
  }

  // The same controlled forms are used beside the call and in the normal visit view.
  const clinicalNote = (
    <div className="card">
      <h3 style={{ marginBottom: 12 }}>Clinical note</h3>
      <div className="stack">
        <label className="field">
          <span>Chief complaint</span>
          <input className="input" value={complaint} onChange={(e) => setComplaint(e.target.value)} />
        </label>
        <label className="field">
          <span>Examination findings</span>
          <textarea
            className="input"
            placeholder="What you saw or what the patient showed on camera"
            value={findings}
            onChange={(e) => setFindings(e.target.value)}
          />
        </label>
        <div className="cols-2">
          <label className="field">
            <span>Diagnosis</span>
            <input
              className="input"
              placeholder="Required to complete"
              value={diagnosis}
              onChange={(e) => setDiagnosis(e.target.value)}
            />
          </label>
          <label className="field">
            <span>Treatment done today</span>
            <input
              className="input"
              placeholder="For example: advice given"
              value={treatment}
              onChange={(e) => setTreatment(e.target.value)}
            />
          </label>
        </div>
      </div>
    </div>
  );

  const dentalChart = (
    <div className="card">
      <div className="row between wrap" style={{ marginBottom: 12 }}>
        <h3>Dental chart</h3>
        <span className="small muted">Pick a status, then click teeth to mark them</span>
      </div>
      <ChartLegend active={brush} onPick={setBrush} />
      <div style={{ marginTop: 14 }}>
        <DentalChart chart={chart} editable onToothClick={toggleTooth} />
      </div>
    </div>
  );

  const prescription = (
    <div className="card">
      <div className="row between" style={{ marginBottom: 6 }}>
        <h3>Prescription</h3>
        {signed && <span className="badge green">Signed</span>}
      </div>
      {signed ? (
        <CareDocumentDownloads appointmentId={appointmentId!} hasPrescription showSummary={false} />
      ) : null}
      {items.length > 0 ? (
        items.map((m, i) => (
          <div key={i} className="med-row">
            <div className="grow">
              <b>
                {m.medicineName} {m.strength}
              </b>
              <div className="small">
                {m.dose}, {m.frequency}, for {m.duration}
              </div>
              {m.instructions && <div className="small muted">{m.instructions}</div>}
            </div>
            {!signed && (
              <button
                type="button"
                className="btn"
                aria-label="Remove"
                onClick={() => setItems((it) => it.filter((_, idx) => idx !== i))}
              >
                <X size={16} />
              </button>
            )}
          </div>
        ))
      ) : (
        <p className="small muted">No medicines added. You can complete without a prescription.</p>
      )}
      {signed ? null : addingMed ? (
        <div className="card flat" style={{ marginTop: 12 }}>
          <label className="field" style={{ marginBottom: 10 }}>
            <span>Common medicines</span>
            <select
              className="input"
              onChange={(e) => {
                const idx = e.target.value;
                if (idx !== '') setMed(MED_PRESETS[Number(idx)]);
              }}
            >
              <option value="">Choose to fill in, or type below</option>
              {MED_PRESETS.map((m, i) => (
                <option key={i} value={i}>
                  {m.medicineName} {m.strength}
                </option>
              ))}
            </select>
          </label>
          <div className="med-form">
            <label className="field">
              <span>Medicine (generic name)</span>
              <input
                className="input"
                value={med.medicineName}
                onChange={(e) => setMed({ ...med, medicineName: e.target.value })}
              />
            </label>
            <label className="field">
              <span>Strength / form</span>
              <input
                className="input"
                value={med.strength}
                onChange={(e) => setMed({ ...med, strength: e.target.value })}
              />
            </label>
            <label className="field">
              <span>Dose</span>
              <input
                className="input"
                value={med.dose}
                onChange={(e) => setMed({ ...med, dose: e.target.value })}
              />
            </label>
            <label className="field">
              <span>How often</span>
              <input
                className="input"
                value={med.frequency}
                onChange={(e) => setMed({ ...med, frequency: e.target.value })}
              />
            </label>
            <label className="field">
              <span>For how long</span>
              <input
                className="input"
                value={med.duration}
                onChange={(e) => setMed({ ...med, duration: e.target.value })}
              />
            </label>
            <span></span>
            <label className="field wide">
              <span>Instructions</span>
              <input
                className="input"
                value={med.instructions}
                onChange={(e) => setMed({ ...med, instructions: e.target.value })}
              />
            </label>
          </div>
          <div className="row" style={{ marginTop: 12 }}>
            <button type="button" className="btn btn-primary" onClick={addMedToList}>
              Add to prescription
            </button>
            <button type="button" className="btn" onClick={() => setAddingMed(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="row" style={{ marginTop: 12 }}>
          <button type="button" className="btn" onClick={() => setAddingMed(true)}>
            <Plus size={16} />
            Add medicine
          </button>
          {items.length > 0 && (
            <button type="button" className="btn btn-primary" onClick={openSign}>
              Preview and sign
            </button>
          )}
        </div>
      )}
    </div>
  );

  const treatmentPlan = (
    <div className="card">
      <h3 style={{ marginBottom: 12 }}>Treatment plan and follow-up</h3>
      <div className="stack">
        <TreatmentProcedures items={consultation?.planItems} />
        <label className="field">
          <span>Plan and advice for the patient</span>
          <textarea
            className="input"
            placeholder="Written in simple words. The patient sees this in the app."
            value={plan}
            onChange={(e) => setPlan(e.target.value)}
          />
        </label>
        <label className="field" style={{ maxWidth: 240 }}>
          <span>Follow-up date</span>
          <input
            className="input"
            type="date"
            min={todayIso()}
            value={followUp}
            onChange={(e) => setFollowUp(e.target.value)}
          />
        </label>
      </div>
    </div>
  );

  const consultationActions = (
    <div className="complete-bar">
      <span className="small muted">
        The visit summary{items.length > 0 ? ', prescription' : ''} and chart go to the patient's app.
      </span>
      <button type="button" className="btn" disabled={isSaving || isCompleting} onClick={handleSave}>
        {isSaving ? 'Saving…' : 'Save draft'}
      </button>
      <button
        type="button"
        className="btn btn-primary btn-lg"
        disabled={isCompleting}
        onClick={handleComplete}
      >
        Complete consultation
      </button>
    </div>
  );

  const documentPanels = [
    { id: 'notes', label: 'Clinical note', content: clinicalNote },
    { id: 'chart', label: 'Dental chart', content: dentalChart },
    { id: 'prescription', label: 'Prescription', content: prescription },
    { id: 'plan', label: 'Treatment plan', content: treatmentPlan },
    { id: 'patient', label: 'Patient details', content: patientPanel },
    { id: 'files', label: 'Photos and reports', content: <AppointmentAttachments appointmentId={appointmentId!} /> },
  ];

  return (
    <>
      {patientHeader}
      {appt.type === 'video' ? (
        <Suspense fallback={<div className="card">Loading video consultation…</div>}>
          <VideoConsultation
            key={appointmentId}
            appointmentId={appointmentId!}
            patientName={appt.patientName ?? 'Patient'}
            panels={documentPanels}
            actions={consultationActions}
          />
        </Suspense>
      ) : (
        <div className="two-col">
          {patientPanel}
          <div className="stack">
            <div className="card">
              <h3>In-clinic visit</h3>
            </div>
            <AppointmentAttachments appointmentId={appointmentId!} />
            {clinicalNote}
            {dentalChart}
            {prescription}
            {treatmentPlan}
            {consultationActions}
          </div>
        </div>
      )}

      {showSign && (
        <Modal
          open
          onClose={() => {
            if (!isSigning && !isRequestingCode) setShowSign(false);
          }}
        >
          <div className="row between" style={{ marginBottom: 14 }}>
            <h2>Preview and sign</h2>
            <button
              type="button"
              className="btn"
              aria-label="Close"
              disabled={isSigning || isRequestingCode}
              onClick={() => setShowSign(false)}
            >
              <X size={16} />
            </button>
          </div>
          <div className="rx-sheet">
            <div className="rx-head">
              <div>
                <b>{appt.type === 'clinic' ? 'In-clinic visit' : 'Video consultation'}</b>
                <div className="small muted">
                  {me?.fullName} · {me?.qualification}
                </div>
                <div className="tiny muted">Reg. No. {me?.councilRegNo}</div>
              </div>
              <div className="rx-symbol">℞</div>
            </div>
            {diagnosis && (
              <p className="small" style={{ marginTop: 8 }}>
                <span className="muted">Diagnosis:</span> {diagnosis}
              </p>
            )}
            <ol className="rx-items">
              {items.map((m, i) => (
                <li key={i}>
                  <b>
                    {m.medicineName} {m.strength}
                  </b>
                  <div className="small">
                    {m.dose}, {m.frequency}, for {m.duration}
                  </div>
                </li>
              ))}
            </ol>
          </div>
          {allergyWarning ? (
            <>
              <div className="emergency" style={{ marginTop: 14 }}>
                <AlertTriangle size={16} />
                <div>{allergyWarning}</div>
              </div>
              <label className="check" style={{ marginTop: 10 }}>
                <input
                  type="checkbox"
                  checked={allergyAck}
                  onChange={(e) => setAllergyAck(e.target.checked)}
                />
                <span>I have reviewed the allergy and want to issue this prescription.</span>
              </label>
            </>
          ) : (
            patient?.allergies &&
            !/none/i.test(patient.allergies) && (
              <div
                className="emergency"
                style={{ marginTop: 14, background: 'var(--amber-soft)', color: '#7A4C03' }}
              >
                <AlertTriangle size={16} />
                <div>
                  Patient allergy: <b>{patient.allergies}</b>. Check before signing.
                </div>
              </div>
            )
          )}
          <div className="stack" style={{ marginTop: 14 }}>
            <p className="small muted">
              Confirm this prescription using a four-digit code for your registered mobile number.
            </p>
            <button
              type="button"
              className="btn"
              disabled={isRequestingCode || isSigning || resendSeconds > 0}
              onClick={sendSigningCode}
            >
              {isRequestingCode
                ? 'Sending…'
                : resendSeconds > 0
                ? `Resend in ${resendSeconds}s`
                : signingOtpId
                ? 'Resend signing code'
                : 'Send signing code'}
            </button>
            {signingOtpId && (
              <label className="field">
                <span>Four-digit signing code</span>
                <input
                  className="input"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={4}
                  pattern="[0-9]{4}"
                  value={signingCode}
                  onChange={(e) => setSigningCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
                />
              </label>
            )}
            {signingError && (
              <p className="small" role="alert" style={{ color: 'var(--red)' }}>
                {signingError}
              </p>
            )}
          </div>
          <div className="row" style={{ marginTop: 14, justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="btn"
              disabled={isSigning || isRequestingCode}
              onClick={() => setShowSign(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={
                isSigning ||
                isRequestingCode ||
                !signingOtpId ||
                !/^[0-9]{4}$/.test(signingCode) ||
                (!!allergyWarning && !allergyAck)
              }
              onClick={handleSign}
            >
              Sign and issue
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
