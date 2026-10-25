import type { PatientSummary } from '../../common/types/patient';

export function patientInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(word => word[0])
    .join('')
    .toUpperCase();
}

export function patientDemographics(age: number | null, gender: string | null) {
  return [age == null ? null : `${age} y`, gender].filter(Boolean).join(' · ');
}

export function matchesPatient(patient: PatientSummary, search: string) {
  const query = search.trim().toLocaleLowerCase().replace(/\s+/g, ' ');
  if (!query) return true;
  if (patient.fullName.toLocaleLowerCase().replace(/\s+/g, ' ').includes(query))
    return true;
  // Accept a phone number copied with spaces, parentheses or the country prefix.
  const digits = query.replace(/\D/g, '');
  return (
    !!digits &&
    /^[+\d\s()-]+$/.test(query) &&
    patient.mobile.replace(/\D/g, '').includes(digits)
  );
}
