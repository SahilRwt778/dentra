// App-facing models. The OpenAPI generator owns their definitions.
export type {
  ConsultationCaseBrief,
  Appointment,
  AuthTokens,
  BookAppointment,
  ChartEntry,
  Consultation,
  TreatmentPlanItem,
  DentistPublic,
  Notification,
  Patient,
  PatientRegistration,
  PatientUpdate,
  PatientFile,
  PrivacyRequestType,
  VideoSession,
  VideoStatus,
} from './generated/patient-api';

export type QueryOptions = {
  skip?: boolean;
  pollingInterval?: number;
  refetchOnMountOrArgChange?: boolean | number;
};

import type {
  PatientAppointmentNotification as AppointmentNotice,
  ConsultationMessageNotification,
} from './generated/patient-api';
export type PatientAppointmentNotification =
  | AppointmentNotice
  | ConsultationMessageNotification;
