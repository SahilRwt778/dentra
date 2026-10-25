export type CareDocumentKind = 'prescription' | 'visit-summary';
export type DocumentMedicine = {
  medicineName: string;
  strength: string | null;
  dose: string;
  frequency: string;
  duration: string;
  instructions: string | null;
};
export type CareDocumentSnapshot = {
  schemaVersion: 1;
  kind: CareDocumentKind;
  capturedAt: string;
  source: 'event' | 'legacy-export';
  platform: { name: string; supportEmail: string | null };
  appointment: {
    id: string;
    type: 'clinic' | 'video';
    date: string;
    time: string;
    completedAt: string | null;
  };
  patient: {
    name: string;
    dateOfBirth: string;
    age: number;
    gender: string | null;
  };
  dentist: {
    name: string;
    qualification: string;
    councilRegNo: string;
    specialization: string;
  };
  clinic: { name: string; address: string | null; phone: string | null } | null;
  consultation: {
    chiefComplaint: string | null;
    findings: string | null;
    diagnosis: string | null;
    treatmentDone: string | null;
    plan: string | null;
    planItems?: { procedure: string; teeth: string[]; estimatedCostPaise?: number | null }[];
    followUpDate: string | null;
    isEdited: boolean;
    editedAt: string | null;
  };
  prescription: {
    id: string;
    signedAt: string;
    items: DocumentMedicine[];
  } | null;
  chart: { tooth: string; status: string }[];
};
