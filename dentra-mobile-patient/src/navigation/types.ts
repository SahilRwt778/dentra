import type {
  NativeStackNavigationProp,
  NativeStackScreenProps,
} from '@react-navigation/native-stack';

export type TabName = 'Home' | 'Appointments' | 'Records' | 'Profile';
export type PatientStackParams = {
  Main: { tab?: TabName; prescriptions?: boolean } | undefined;
  Dentists: undefined;
  Dentist: { dentistId: string };
  Booking: { dentistId?: string; type?: 'video' | 'clinic' } | undefined;
  Appointment: { appointmentId: string; justBooked?: boolean };
  Reschedule: { appointmentId: string };
  Visit: { appointmentId: string };
  Notifications: undefined;
  Help: undefined;
};
export type PatientNavigation = NativeStackNavigationProp<PatientStackParams>;
export type PatientScreenProps<T extends keyof PatientStackParams> =
  NativeStackScreenProps<PatientStackParams, T>;
