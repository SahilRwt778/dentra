import type {
  MedicineForm,
  Prescription,
  PrescriptionItem,
} from '../../../common/types/prescription';

export function medicineForm(item?: PrescriptionItem): MedicineForm {
  return {
    medicineName: item?.medicineName ?? '',
    strength: item?.strength ?? '',
    dose: item?.dose ?? '',
    frequency: item?.frequency ?? '',
    duration: item?.duration ?? '',
    instructions: item?.instructions ?? '',
  };
}
export function validateMedicine(form: MedicineForm): MedicineForm {
  const item = Object.fromEntries(
    Object.entries(form).map(([key, value]) => [key, value.trim()]),
  ) as MedicineForm;
  if (!item.medicineName || !item.dose || !item.frequency || !item.duration) {
    throw new Error('Add the medicine name, dose, how often and for how long.');
  }
  return item;
}
export function sameMedicines(a: PrescriptionItem[], b: PrescriptionItem[]) {
  return (
    JSON.stringify(a.map(medicineForm)) === JSON.stringify(b.map(medicineForm))
  );
}
/** Compare the exact server values used by its OTP signing context. */
export function prescriptionFingerprint(prescription: Prescription | null) {
  if (!prescription) return 'none';
  return JSON.stringify([
    prescription.id,
    prescription.signedAt,
    prescription.items.map(item => [
      item.medicineName,
      item.strength,
      item.dose,
      item.frequency,
      item.duration,
      item.instructions,
    ]),
  ]);
}

// Matches the backend's interim allergy rules. Signing always runs the server check too.
const ALLERGY_RULES = [
  {
    allergy: /penicillin|amoxicillin/i,
    label: 'Penicillin',
    drugs: /amoxicillin|ampicillin|cloxacillin|penicillin|piperacillin/i,
  },
  {
    allergy: /sulfa|sulpha|sulphonamide|sulfonamide/i,
    label: 'Sulfa drugs',
    drugs: /sulfamethoxazole|co-trimoxazole|cotrimoxazole/i,
  },
  {
    allergy: /nsaid|aspirin|ibuprofen/i,
    label: 'NSAIDs',
    drugs: /ibuprofen|diclofenac|aceclofenac|aspirin|naproxen|ketorolac/i,
  },
  {
    allergy: /metronidazole/i,
    label: 'Metronidazole',
    drugs: /metronidazole/i,
  },
];
export function allergyConflict(
  allergies: string | null | undefined,
  medicineName: string,
) {
  if (!allergies) return null;
  return (
    ALLERGY_RULES.find(
      rule => rule.allergy.test(allergies) && rule.drugs.test(medicineName),
    )?.label ?? null
  );
}
