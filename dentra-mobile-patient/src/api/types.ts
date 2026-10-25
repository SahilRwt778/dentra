// App-facing models. The OpenAPI generator owns their definitions.
export type {
  Appointment,
  AuthTokens,
  BookAppointment,
  ChartEntry,
  Consultation,
  TreatmentPlanItem,
  DentistPublic,
  Notification,
  Patient,
  PatientAppointmentNotification,
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
