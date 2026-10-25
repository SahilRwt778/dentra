/**
 * Mirrors schema.sql's patients_guardian_required_if_minor check
 * (`date_of_birth <= current_date - interval '18 years'`) so the app
 * layer rejects a missing guardian with a clear 422 before the DB ever
 * gets a chance to reject it with a bare constraint-violation error.
 */
export function isMinor(dateOfBirthIso: string): boolean {
  const dob = new Date(dateOfBirthIso);
  const eighteenYearsAgo = new Date();
  eighteenYearsAgo.setHours(0, 0, 0, 0);
  eighteenYearsAgo.setFullYear(eighteenYearsAgo.getFullYear() - 18);
  return dob.getTime() > eighteenYearsAgo.getTime();
}
