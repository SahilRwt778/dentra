import {
  activeAppointment,
  ageFromDob,
  appointmentOrder,
  normalizeMobile,
  registrationError,
} from '../src/lib/patient';
import type { PatientRegistration } from '../src/api/generated/patient-api';

const adult: PatientRegistration = {
  fullName: 'Test Patient',
  dateOfBirth: '1990-01-01',
  gender: 'Other',
  city: 'Delhi',
  termsConsent: true,
  telemedicineConsent: true,
};

test('minor registration requires all guardian details and explicit consent', () => {
  const minor = {
    ...adult,
    dateOfBirth: `${new Date().getFullYear() - 10}-01-01`,
  };
  expect(registrationError(minor)).toMatch(/guardian/);
  expect(
    registrationError({
      ...minor,
      guardianName: 'Guardian',
      guardianRelationship: 'Parent',
      guardianMobile: '+919800000001',
      guardianConsent: false,
    }),
  ).toMatch(/guardian/);
  expect(
    registrationError({
      ...minor,
      guardianName: 'Guardian',
      guardianRelationship: 'Parent',
      guardianMobile: '+919800000001',
      guardianConsent: true,
    }),
  ).toBeNull();
});
test('invalid calendar dates and future birth dates are rejected', () => {
  expect(ageFromDob('2025-02-30')).toBeNull();
  expect(ageFromDob('2999-01-01')).toBeNull();
  expect(registrationError({ ...adult, termsConsent: false })).toMatch(
    /consent/,
  );
});
test('appointment lists order the next active visit before later visits', () => {
  const appointments = [
    {
      id: 'later',
      date: '2099-01-02',
      time: '09:00',
      status: 'booked' as const,
    },
    {
      id: 'cancelled',
      date: '2099-01-01',
      time: '08:00',
      status: 'cancelled' as const,
    },
    {
      id: 'next',
      date: '2099-01-01',
      time: '10:00',
      status: 'waiting' as const,
    },
  ];
  expect(
    appointments
      .filter(activeAppointment)
      .sort(appointmentOrder)
      .map(a => a.id),
  ).toEqual(['next', 'later']);
});
test('mobile normalization handles Indian and explicitly international numbers', () => {
  expect(normalizeMobile('98100 23456')).toBe('+919810023456');
  expect(normalizeMobile('+44 7700 900123')).toBe('+447700900123');
});
