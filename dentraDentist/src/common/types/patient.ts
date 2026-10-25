import type { AppointmentStatus } from './api';
import type { ToothFinding } from './dental-chart';

export type PatientSummary = {
  id: string;
  fullName: string;
  age: number | null;
  gender: string | null;
  mobile: string;
  lastVisitDate: string | null;
  visitCount: number;
  hasAllergies: boolean;
};

export type PatientAppointment = {
  id: string;
  date: string;
  time: string;
  type: 'video' | 'clinic';
  clinicName: string | null;
  concern: string;
  diagnosis: string | null;
  status: AppointmentStatus;
};

export type PatientRecord = {
  id: string;
  fullName: string;
  mobile: string;
  age: number | null;
  dateOfBirth: string;
  gender: string | null;
  city: string | null;
  preferredLanguage: string;
  allergies: string | null;
  hasAllergies: boolean;
  conditions: string | null;
  medications: string | null;
  emergencyContact: string | null;
  guardian: { name: string; relationship: string; mobile: string } | null;
  chart: ToothFinding[];
  appointments: PatientAppointment[];
};
