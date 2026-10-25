/**
 * Regex rule table, not a drug formulary — DENTRA_ARCHITECTURE.md names
 * this as the honest interim state ("structured drug-allergy codes once
 * a formulary exists, so the allergy-conflict check stops being a
 * regex"). Ported from the prototype's own ALLERGY_RULES rather than
 * invented fresh, since that was already a deliberate, reviewed list.
 */
const ALLERGY_RULES: { allergy: RegExp; label: string; drugs: RegExp }[] = [
  { allergy: /penicillin|amoxicillin/i, label: 'Penicillin', drugs: /amoxicillin|ampicillin|cloxacillin|penicillin|piperacillin/i },
  { allergy: /sulfa|sulpha|sulphonamide|sulfonamide/i, label: 'Sulfa drugs', drugs: /sulfamethoxazole|co-trimoxazole|cotrimoxazole/i },
  { allergy: /nsaid|aspirin|ibuprofen/i, label: 'NSAIDs', drugs: /ibuprofen|diclofenac|aceclofenac|aspirin|naproxen|ketorolac/i },
  { allergy: /metronidazole/i, label: 'Metronidazole', drugs: /metronidazole/i },
];

/** Returns the allergy label a medicine conflicts with, or null if no conflict. */
export function allergyConflict(patientAllergies: string | null | undefined, medicineName: string): string | null {
  if (!patientAllergies) return null;
  const rule = ALLERGY_RULES.find((r) => r.allergy.test(patientAllergies) && r.drugs.test(medicineName));
  return rule ? rule.label : null;
}
