import { toast } from 'sonner';
import type { Dentist, KycDocType } from '@/api/generated-api';
import { useAppSelector } from '@/store/hooks';
import { selectAccessToken } from '@/store/auth-slice';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

// Mirrors KYC_DOCS in ../../../index.html (the prototype) and
// REQUIRED_DOC_TYPES in dentra-api's admin-dentists.service.ts — keep
// all three in sync if the required set ever changes.
const KYC_DOCS: { docType: KycDocType; label: string; required: boolean }[] = [
  { docType: 'degree', label: 'Degree certificate (BDS/MDS)', required: true },
  { docType: 'council', label: 'State Dental Council registration certificate', required: true },
  { docType: 'id_proof', label: 'Government photo ID (Aadhaar / passport / driving licence)', required: true },
  { docType: 'clinic_proof', label: 'Clinic establishment proof (Shop & Establishment licence)', required: false },
  { docType: 'insurance', label: 'Professional indemnity insurance certificate', required: false },
  { docType: 'selfie', label: 'Live selfie (matched against photo ID)', required: true },
];

function ViewDocumentLink({ fileUrl }: { fileUrl: string }) {
  const accessToken = useAppSelector(selectAccessToken);

  async function handleView() {
    try {
      const res = await fetch(`${BASE_URL}${fileUrl}`, {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      window.open(objectUrl, '_blank', 'noopener');
      // Revoked after a delay rather than immediately — the new tab
      // needs the blob URL to still resolve once it finishes loading it.
      setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    } catch {
      toast.error('Failed to load document.');
    }
  }

  return (
    <button type="button" className="btn-link btn small" onClick={handleView}>
      View
    </button>
  );
}

export function DocumentChecklist({ dentist }: { dentist: Dentist }) {
  return (
    <>
      {KYC_DOCS.map(({ docType, label, required }) => {
        const doc = dentist.documents?.find((d) => d.docType === docType);
        return (
          <div
            key={docType}
            className="row between small"
            style={{ padding: '6px 0', borderBottom: '1px solid var(--line)' }}
          >
            <span>
              {label}
              {required && <span className="muted tiny"> (required)</span>}
            </span>
            <span className="row" style={{ gap: 8 }}>
              {doc?.fileUrl ? (
                <>
                  <span className="small" style={{ color: 'var(--green)' }}>
                    On file
                  </span>
                  <ViewDocumentLink fileUrl={doc.fileUrl} />
                </>
              ) : (
                <span className="small" style={{ color: 'var(--red)' }}>
                  Not uploaded
                </span>
              )}
            </span>
          </div>
        );
      })}
    </>
  );
}

export const REQUIRED_KYC_DOC_TYPES: KycDocType[] = KYC_DOCS.filter((d) => d.required).map((d) => d.docType);
