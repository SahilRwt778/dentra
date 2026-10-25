import { FileCheck2, FileText, ShieldCheck } from 'lucide-react';
import { useGetDentistsMeQuery, type KycDocType } from '@/api/generated-api';
import { formatDate } from '@/lib/date';
import { SettingsSection } from './settings-section';

const DOCUMENTS: { type: KycDocType; label: string; description: string }[] = [
  {
    type: 'degree',
    label: 'Degree certificate',
    description: 'BDS or MDS qualification',
  },
  {
    type: 'council',
    label: 'Dental council registration',
    description: 'State Dental Council certificate',
  },
  {
    type: 'id_proof',
    label: 'Government photo ID',
    description: 'Aadhaar, passport or driving licence',
  },
  {
    type: 'clinic_proof',
    label: 'Clinic establishment proof',
    description: 'Shop & Establishment licence',
  },
  {
    type: 'insurance',
    label: 'Professional indemnity insurance',
    description: 'Insurance certificate',
  },
  {
    type: 'selfie',
    label: 'Identity selfie',
    description: 'Photo submitted during onboarding',
  },
];

export function DocumentSettings() {
  const { data: me, error, isLoading, refetch } = useGetDentistsMeQuery();
  const onFile = DOCUMENTS.filter(({ type }) =>
    me?.documents?.some((document) => document.docType === type),
  ).length;
  return (
    <SettingsSection
      id="documents"
      title="Onboarding documents"
      description="Your submitted documents and their upload status."
      icon={ShieldCheck}
      busy={isLoading}
      action={
        me &&
        !error && (
          <span className="badge teal">
            {onFile} of {DOCUMENTS.length} on file
          </span>
        )
      }
    >
      {error ? (
        <div className="settings-feedback" role="alert">
          <p>Could not load your documents.</p>
          <button type="button" className="btn" onClick={() => void refetch()}>
            Try again
          </button>
        </div>
      ) : isLoading ? (
        <p className="muted">Loading documents…</p>
      ) : (
        <div className="settings-documents">
          {DOCUMENTS.map(({ type, label, description }) => {
            const document = me?.documents?.find(
              (item) => item.docType === type,
            );
            const Icon = document ? FileCheck2 : FileText;
            return (
              <div key={type} className="settings-document-row">
                <span
                  className={`settings-document-icon${
                    document ? ' on-file' : ''
                  }`}
                >
                  <Icon size={20} aria-hidden="true" />
                </span>
                <div className="grow">
                  <h3>{label}</h3>
                  <p>
                    {description}
                    {document?.uploadedAt
                      ? ` · Added ${formatDate(
                          document.uploadedAt.slice(0, 10),
                        )}`
                      : ''}
                  </p>
                </div>
                <span className={`badge${document ? ' green' : ''}`}>
                  {document ? 'On file' : 'Not uploaded'}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </SettingsSection>
  );
}
