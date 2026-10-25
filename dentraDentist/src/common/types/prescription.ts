export type PrescriptionItem = {
  medicineName: string;
  strength: string | null;
  dose: string;
  frequency: string;
  duration: string;
  instructions: string | null;
};
export type Prescription = {
  id: string;
  signedByDentistId: string | null;
  signedAt: string | null;
  items: PrescriptionItem[];
};
export type MedicineForm = { [Field in keyof PrescriptionItem]: string };
export type PatientAllergies = { patientId: string; allergies: string | null };
export type PrescriptionSignature = {
  otpId: string;
  confirmationCode: string;
  allergyOverrideAck?: boolean;
};
