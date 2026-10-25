import type { Prescription } from './prescription';
import type { TreatmentPlanItem } from './treatment-plan';

export type ClinicalNote = {
  chiefComplaint: string;
  findings: string;
  diagnosis: string;
  treatmentDone: string;
};

export type Consultation = {
  appointmentId: string;
  chiefComplaint: string | null;
  findings: string | null;
  diagnosis: string | null;
  treatmentDone: string | null;
  plan: string | null;
  planItems?: TreatmentPlanItem[];
  followUpDate: string | null;
  isEdited: boolean;
  editedAt: string | null;
  prescription: Prescription | null;
};
