import type {
  ClinicalNote,
  Consultation,
} from '../../common/types/consultation';

const NOTE_FIELDS: (keyof ClinicalNote)[] = [
  'chiefComplaint',
  'findings',
  'diagnosis',
  'treatmentDone',
];

export function clinicalNoteForm(consultation: Consultation): ClinicalNote {
  return {
    chiefComplaint: consultation.chiefComplaint ?? '',
    findings: consultation.findings ?? '',
    diagnosis: consultation.diagnosis ?? '',
    treatmentDone: consultation.treatmentDone ?? '',
  };
}

/** Omitted fields stay untouched, including notes changed in the web portal. */
export function clinicalNoteChanges(
  form: ClinicalNote,
  saved: ClinicalNote,
): Partial<ClinicalNote> {
  const changes: Partial<ClinicalNote> = {};
  for (const field of NOTE_FIELDS) {
    if (form[field] !== saved[field]) changes[field] = form[field];
  }
  return changes;
}
