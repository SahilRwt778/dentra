import { useState, type FormEvent } from 'react';
import { Toothbrush } from 'lucide-react';
import {
  usePostDentistsApplicationsMutation,
  usePatchDentistsApplicationsMeMutation,
  usePostDentistsApplicationsMeSubmitMutation,
  usePostDentistsApplicationsByDentistIdDocumentsMutation,
  type Dentist,
  type KycDocType,
  type PostDentistsApplicationsByDentistIdDocumentsApiArg,
} from '@/api/generated-api';
import { useAuth } from '@/auth/auth-context';

const SPECIALTIES = [
  'General Dentist',
  'Orthodontist',
  'Endodontist',
  'Periodontist',
  'Oral Surgeon',
  'Prosthodontist',
  'Paediatric Dentist',
];

const KYC_DOCS: { docType: KycDocType; label: string; required: boolean }[] = [
  { docType: 'degree', label: 'Degree certificate (BDS/MDS)', required: true },
  { docType: 'council', label: 'State Dental Council registration certificate', required: true },
  {
    docType: 'id_proof',
    label: 'Government photo ID (Aadhaar / passport / driving licence)',
    required: true,
  },
  {
    docType: 'clinic_proof',
    label: 'Clinic establishment proof (Shop & Establishment licence)',
    required: false,
  },
  { docType: 'insurance', label: 'Professional indemnity insurance certificate', required: false },
  { docType: 'selfie', label: 'Live selfie (matched against photo ID)', required: true },
];

const EMPTY_FORM = {
  fullName: '',
  email: '',
  qualification: '',
  specialization: SPECIALTIES[0],
  councilRegNo: '',
  yearsExperience: 0,
  languages: '',
  primaryClinicName: '',
  offersVideo: true,
  feeVideo: 500,
  feeClinic: 600,
  terms: false,
};

export function OnboardingPage({ dentist, onSubmitted }: { dentist?: Dentist; onSubmitted: () => void }) {
  const { logout } = useAuth();
  const [createApplication] = usePostDentistsApplicationsMutation();
  const [updateApplication] = usePatchDentistsApplicationsMeMutation();
  const [submitApplication] = usePostDentistsApplicationsMeSubmitMutation();
  const [upload] = usePostDentistsApplicationsByDentistIdDocumentsMutation();

  const [form, setForm] = useState(() =>
    dentist
      ? {
          ...EMPTY_FORM,
          fullName: dentist.fullName ?? '',
          email: dentist.email ?? '',
          qualification: dentist.qualification ?? '',
          specialization: dentist.specialization ?? SPECIALTIES[0],
          councilRegNo: dentist.councilRegNo ?? '',
          yearsExperience: dentist.yearsExperience ?? 0,
          languages: dentist.languages?.join(', ') ?? '',
          primaryClinicName: dentist.clinics?.[0]?.name ?? '',
          offersVideo: dentist.offersVideo ?? false,
          feeVideo: (dentist.feeVideoPaise ?? 0) / 100,
          feeClinic: (dentist.feeClinicPaise ?? 0) / 100,
        }
      : EMPTY_FORM
  );
  const [application, setApplication] = useState(dentist);
  const [uploadedDocs, setUploadedDocs] = useState(
    () => new Set(dentist?.documents?.map((doc) => doc.docType))
  );
  const [files, setFiles] = useState<Partial<Record<KycDocType, File>>>({});
  const [progress, setProgress] = useState('');
  const [error, setError] = useState<string>();
  const isSubmitting = !!progress;

  // The refetched profile also recovers a draft whose creation response was lost.
  const applicationId = application?.id ?? dentist?.id;
  const hasUploadedDoc = (type: KycDocType) =>
    uploadedDocs.has(type) || !!dentist?.documents?.some((doc) => doc.docType === type);

  async function uploadDocument(dentistId: string, docType: KycDocType, file: File) {
    const body = new FormData();
    body.append('docType', docType);
    body.append('file', file);
    // Codegen describes binary multipart bodies as strings; fetchBaseQuery sends FormData unchanged.
    await upload({
      dentistId,
      body: body as unknown as PostDentistsApplicationsByDentistIdDocumentsApiArg['body'],
    }).unwrap();
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (isSubmitting) return;
    setError(undefined);
    if (!form.terms) {
      setError('You must agree to the terms and telemedicine guidelines.');
      return;
    }
    const missing = KYC_DOCS.filter((d) => d.required && !files[d.docType] && !hasUploadedDoc(d.docType));
    if (missing.length > 0) {
      setError(`Upload required documents: ${missing.map((d) => d.label).join(', ')}`);
      return;
    }

    try {
      setProgress('Saving your details…');
      const payload = {
        dentistApplication: {
          fullName: form.fullName.trim(),
          email: form.email.trim() || undefined,
          qualification: form.qualification.trim(),
          specialization: form.specialization,
          councilRegNo: form.councilRegNo.trim(),
          yearsExperience: form.yearsExperience,
          languages: form.languages
            .split(',')
            .map((language) => language.trim())
            .filter(Boolean),
          primaryClinicName: form.primaryClinicName.trim(),
          offersVideo: form.offersVideo,
          feeVideoPaise: form.offersVideo ? Math.round(form.feeVideo * 100) : 0,
          feeClinicPaise: Math.round(form.feeClinic * 100),
          termsConsent: true,
          telemedicineConsent: true,
        },
      };
      const saved = await (applicationId
        ? updateApplication(payload)
        : createApplication(payload)
      ).unwrap();
      if (!saved.id) throw new Error('Could not save your application.');
      setApplication(saved);

      for (const [docType, file] of Object.entries(files) as [KycDocType, File][]) {
        setProgress(`Uploading ${KYC_DOCS.find((doc) => doc.docType === docType)?.label ?? docType}…`);
        await uploadDocument(saved.id, docType, file);
        setUploadedDocs((current) => new Set([...current, docType]));
        setFiles((current) => {
          const next = { ...current };
          delete next[docType];
          return next;
        });
      }
      setProgress('Sending your application to admin…');
      await submitApplication().unwrap();
      onSubmitted();
    } catch (err) {
      const failure = err as { status?: number; data?: { message?: string | string[] }; message?: string };
      const message =
        failure.data?.message ??
        failure.message ??
        'Could not submit your application. Your saved details and uploaded documents are kept; please try again.';
      setError(Array.isArray(message) ? message.join(' ') : message);
      if (failure.status === 409) onSubmitted();
    } finally {
      setProgress('');
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-card" style={{ width: 'min(640px, 100%)' }}>
        <div className="brand">
          <Toothbrush />
          Dentra
        </div>
        <h1 style={{ marginTop: 18 }}>Apply to join Dentra</h1>
        <p className="muted small" style={{ margin: '6px 0 18px' }}>
          Your mobile number is verified{dentist?.mobile ? `: ${dentist.mobile}` : ''}. Fill in your details
          and upload your documents. An admin will review your application before you can access the clinic
          portal.
        </p>
        <form onSubmit={handleSubmit} className="stack">
          <fieldset className="application-fields stack" disabled={isSubmitting}>
            <div className="cols-2">
              <label className="field">
                <span>Full name</span>
                <input
                  className="input"
                  value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  required
                />
              </label>
              <label className="field">
                <span>Email</span>
                <input
                  className="input"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </label>
            </div>
            <div className="cols-2">
              <label className="field">
                <span>Years of experience</span>
                <input
                  className="input"
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={form.yearsExperience}
                  onChange={(e) => setForm({ ...form, yearsExperience: Number(e.target.value) })}
                  required
                />
              </label>
              <label className="field">
                <span>Languages spoken</span>
                <input
                  className="input"
                  placeholder="e.g. English, Hindi"
                  value={form.languages}
                  onChange={(e) => setForm({ ...form, languages: e.target.value })}
                />
              </label>
            </div>
            <div className="cols-2">
              <label className="field">
                <span>Qualification</span>
                <input
                  className="input"
                  placeholder="e.g. BDS, MDS"
                  value={form.qualification}
                  onChange={(e) => setForm({ ...form, qualification: e.target.value })}
                  required
                />
              </label>
              <label className="field">
                <span>Specialization</span>
                <select
                  className="input"
                  value={form.specialization}
                  onChange={(e) => setForm({ ...form, specialization: e.target.value })}
                >
                  {SPECIALTIES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="field">
              <span>State Dental Council registration number</span>
              <input
                className="input"
                value={form.councilRegNo}
                onChange={(e) => setForm({ ...form, councilRegNo: e.target.value })}
                required
              />
            </label>
            <div>
              <label className="field">
                <span>Primary clinic name and address</span>
                <input
                  className="input"
                  value={form.primaryClinicName}
                  onChange={(e) => setForm({ ...form, primaryClinicName: e.target.value })}
                  required
                />
              </label>
              <p className="hint">More locations can be added later from Settings, once verified.</p>
            </div>
            <div className="cols-2">
              <label className="field">
                <span>Video consult fee (₹)</span>
                <input
                  className="input"
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.feeVideo}
                  onChange={(e) => setForm({ ...form, feeVideo: Number(e.target.value) })}
                />
              </label>
              <label className="field">
                <span>In-clinic visit fee (₹)</span>
                <input
                  className="input"
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.feeClinic}
                  onChange={(e) => setForm({ ...form, feeClinic: Number(e.target.value) })}
                />
              </label>
            </div>
            <label className="check">
              <input
                type="checkbox"
                checked={form.offersVideo}
                onChange={(e) => setForm({ ...form, offersVideo: e.target.checked })}
              />
              <span>Offers video consults</span>
            </label>

            <div className="divider" />
            <p className="small" style={{ fontWeight: 500 }}>
              Documents (JPG, PNG or PDF, up to 10 MB each)
            </p>
            {KYC_DOCS.map((doc) => (
              <div key={doc.docType} className="application-document-row">
                <span className="small">
                  {doc.label}
                  {doc.required && <span className="muted tiny"> (required)</span>}
                </span>
                <label
                  className="btn small"
                  style={{ minHeight: 32 }}
                  role="button"
                  tabIndex={isSubmitting ? -1 : 0}
                  aria-label={`Upload ${doc.label}`}
                  aria-disabled={isSubmitting}
                  onKeyDown={(e) => {
                    if (!isSubmitting && (e.key === 'Enter' || e.key === ' ')) {
                      e.preventDefault();
                      e.currentTarget.querySelector('input')?.click();
                    }
                  }}
                >
                  {files[doc.docType] || hasUploadedDoc(doc.docType) ? 'Replace' : 'Upload'}
                  <input
                    type="file"
                    aria-label={`Upload ${doc.label}`}
                    accept="image/jpeg,image/png,application/pdf"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > 10 * 1024 * 1024) {
                        setError(`${doc.label} must be 10 MB or smaller.`);
                        e.target.value = '';
                        return;
                      }
                      setError(undefined);
                      setFiles((f) => ({ ...f, [doc.docType]: file }));
                    }}
                  />
                </label>
                {(files[doc.docType] || hasUploadedDoc(doc.docType)) && (
                  <span className="badge green">{files[doc.docType] ? 'Added' : 'Uploaded'}</span>
                )}
              </div>
            ))}

            <div className="divider" />
            <label className="check">
              <input
                type="checkbox"
                checked={form.terms}
                onChange={(e) => setForm({ ...form, terms: e.target.checked })}
              />
              <span>
                I agree to the platform terms of service and the Telemedicine Practice Guidelines (2020).
              </span>
            </label>
          </fieldset>
          {error && (
            <p className="application-error small" role="alert">
              {error}
            </p>
          )}
          {applicationId && (
            <p className="hint">
              Your draft is saved. The request reaches admin after all required documents finish uploading.
            </p>
          )}
          <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={isSubmitting}>
            {progress || 'Submit application to admin'}
          </button>
          <button type="button" className="btn-link btn" disabled={isSubmitting} onClick={logout}>
            Log out
          </button>
        </form>
      </div>
    </div>
  );
}
