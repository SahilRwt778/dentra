import type {
  NativeStackNavigationProp,
  NativeStackScreenProps,
} from '@react-navigation/native-stack';

export type TabName =
  | 'Home'
  | 'Appointments'
  | 'Records'
  | 'Messages'
  | 'Profile';
export type PatientStackParams = {
  Main: { tab?: TabName; prescriptions?: boolean } | undefined;
  Dentists: undefined;
  Dentist: { dentistId: string };
  Booking:
    | { dentistId?: string; type?: 'video' | 'clinic'; concern?: string }
    | undefined;
  DentalEducation: undefined;
  EducationArticle: { articleId: string };
  Appointment: {
    appointmentId: string;
    justBooked?: boolean;
    paymentSubmitted?: boolean;
    paymentError?: string;
  };
  Reschedule: { appointmentId: string };
  Visit: { appointmentId: string };
  Chat: { caseId: string };
  FollowUp: { caseId: string };
  Notifications: undefined;
  Help: undefined;
};
export type PatientNavigation = NativeStackNavigationProp<PatientStackParams>;
export type PatientScreenProps<T extends keyof PatientStackParams> =
  NativeStackScreenProps<PatientStackParams, T>;
