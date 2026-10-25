import type { PatientRecord } from '../src/common/types/patient';

export function testPatientRecord(
  overrides: Partial<PatientRecord> = {},
): PatientRecord {
  return {
    id: 'patient-one',
    fullName: 'Synthetic Patient',
    mobile: '+919000001111',
    age: 32,
    dateOfBirth: '1994-06-15',
    gender: 'female',
    city: null,
    preferredLanguage: 'English',
    allergies: null,
    hasAllergies: false,
    conditions: null,
    medications: null,
    emergencyContact: null,
    guardian: null,
    chart: [],
    appointments: [],
    ...overrides,
  };
}
