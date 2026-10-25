import type { Appointment, PatientRegistration } from '@/api/types';

export function dateIso(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    '0',
  )}-${String(date.getDate()).padStart(2, '0')}`;
}
export function addDays(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return dateIso(date);
}
export function formatDate(value?: string | null): string {
  if (!value) return '—';
  return new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString(
    'en-IN',
    { day: 'numeric', month: 'short', year: 'numeric' },
  );
}
export function dayLabel(value: string): string {
  if (value === dateIso()) return 'Today';
  if (value === addDays(1)) return 'Tomorrow';
  return new Date(`${value}T12:00:00`).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}
export function formatTime(value?: string): string {
  if (!value) return '—';
  const [hour, minute] = value.split(':').map(Number);
  return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${
    hour < 12 ? 'AM' : 'PM'
  }`;
}
export function rupees(paise = 0): string {
  return `₹${(paise / 100).toLocaleString('en-IN', {
    maximumFractionDigits: 2,
  })}`;
}
export function normalizeMobile(input: string): string {
  const digits = input.replace(/\D/g, '');
  return digits.length === 10 ? `+91${digits}` : `+${digits}`;
}
export function ageFromDob(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T12:00:00`);
  if (
    Number.isNaN(date.getTime()) ||
    dateIso(date) !== value ||
    value > dateIso()
  )
    return null;
  const now = new Date();
  return (
    now.getFullYear() -
    date.getFullYear() -
    (now.getMonth() < date.getMonth() ||
    (now.getMonth() === date.getMonth() && now.getDate() < date.getDate())
      ? 1
      : 0)
  );
}
export function registrationError(value: PatientRegistration): string | null {
  if (!value.fullName.trim()) return 'Enter your full name.';
  const age = ageFromDob(value.dateOfBirth);
  if (age === null || age > 125) return 'Choose a valid date of birth.';
  if (!value.gender || !value.city?.trim()) return 'Add your gender and city.';
  if (value.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email))
    return 'Enter a valid email address.';
  if (
    age < 18 &&
    (!value.guardianName?.trim() ||
      !value.guardianRelationship?.trim() ||
      !/^\+[1-9]\d{7,14}$/.test(value.guardianMobile ?? '') ||
      !value.guardianConsent)
  )
    return 'Add your guardian’s name, relationship, mobile number, and consent.';
  if (!value.termsConsent || !value.telemedicineConsent)
    return 'Please review and accept both consent statements.';
  return null;
}
export const activeAppointment = (a: Appointment) =>
  ['booked', 'waiting', 'in_consult'].includes(a.status ?? '');
export const appointmentOrder = (a: Appointment, b: Appointment) =>
  `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`);
export const statusLabel: Record<string, string> = {
  booked: 'Booked',
  waiting: 'Checked in',
  in_consult: 'In consultation',
  completed: 'Completed',
  cancelled: 'Cancelled',
};
export const paymentLabel: Record<string, string> = {
  pending: 'Awaiting payment',
  paid: 'Paid',
  due_at_clinic: 'Pay at clinic',
  refund_pending: 'Refund processing',
  refund_failed: 'Refund needs attention',
  refunded: 'Refunded',
  cancelled: 'Cancelled',
  failed: 'Payment failed',
};
export const CONCERNS = [
  'Toothache',
  'Bleeding gums',
  'Broken or chipped tooth',
  'Sensitivity',
  'Check-up and cleaning',
  'Braces or aligners',
  'Follow-up visit',
  'Other',
];
export const SPECIALTIES = [
  'All dentists',
  'General Dentist',
  'Orthodontist',
  'Endodontist',
  'Periodontist',
  'Oral Surgeon',
  'Prosthodontist',
  'Paediatric Dentist',
];
export const LANGUAGES = ['English', 'Hindi', 'Punjabi', 'Tamil', 'Bengali'];
