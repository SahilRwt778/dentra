import { paymentsApi } from '../api/payments.api';
import { walletApi } from '../api/wallet.api';
import type {
  DentistWallet,
  RequestWithdrawal,
  WithdrawalDetail,
  WithdrawalPage,
  WithdrawalQuery,
} from '../common/types/wallet';
import { payoutBatchesApi } from '../api/payout-batches.api';
import type {
  PayoutBatchDetail,
  PayoutBatchPage,
  PayoutBatchQuery,
} from '../common/types/payout-batch';
import type {
  DentistPayment,
  DentistPayments,
  PaymentsQuery,
} from '../common/types/payments';
import { clinicPaymentsApi } from '../api/clinic-payments.api';
import type { CollectClinicPayment } from '../common/types/clinic-payment';
import { availabilityApi } from '../api/availability.api';
import type {
  TimeOff,
  TimeOffInput,
  TimeOffPreview,
} from '../common/types/availability';
import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react';
import { appointmentsApi } from '../api/appointments.api';
import { dentistsApi } from '../api/dentists.api';
import { notificationsApi } from '../api/notifications.api';
import { patientFilesApi } from '../api/patient-files.api';
import { videoApi } from '../api/video.api';
import { settingsApi } from '../api/settings.api';
import { consultationsApi } from '../api/consultations.api';
import { patientsApi } from '../api/patients.api';
import { prescriptionsApi } from '../api/prescriptions.api';
import type {
  MedicineForm,
  PatientAllergies,
  PrescriptionSignature,
} from '../common/types/prescription';
import type {
  PatientDentalChart,
  ToothFinding,
} from '../common/types/dental-chart';
import type { ClinicalNote, Consultation } from '../common/types/consultation';
import type { TreatmentPlan } from '../common/types/treatment-plan';
import type { PatientRecord, PatientSummary } from '../common/types/patient';
import type {
  AppointmentSlotRequest,
  AppointmentSlots,
  ScheduleDay,
  RescheduleAppointment,
} from '../common/types/appointment-actions';
import type {
  ClinicInput,
  DentistUpdate,
  PayoutProfile,
  PayoutRequest,
  PayoutSubmission,
} from '../common/types/settings';
import type {
  Appointment,
  Clinic,
  Dentist,
  NotificationPage,
  OtpChallenge,
  Page,
  PatientFile,
  VideoStatus,
} from '../common/types/api';
import { queryResult, type ApiError } from './queryResult';

export const dentraApi = createApi({
  reducerPath: 'dentraApi',
  baseQuery: fakeBaseQuery<ApiError>(),
  keepUnusedDataFor: 30,
  refetchOnMountOrArgChange: true,
  tagTypes: [
    'Dentist',
    'Appointments',
    'Notifications',
    'PatientFiles',
    'VideoStatus',
    'Clinics',
    'Payout',
    'Wallet',
    'Consultation',
    'PatientChart',
    'PatientAllergies',
    'Patients',
    'PatientRecord',
    'AppointmentSlots',
    'TimeOff',
  ],
  endpoints: builder => ({
    getWallet: builder.query<DentistWallet, void>({
      queryFn: (_, { signal }) => queryResult(() => walletApi.get(signal)),
      providesTags: ['Wallet', 'Appointments'],
      keepUnusedDataFor: 0,
    }),
    getWithdrawals: builder.query<WithdrawalPage, WithdrawalQuery>({
      queryFn: (params, { signal }) =>
        queryResult(() => walletApi.withdrawals(params, signal)),
      providesTags: ['Wallet'],
      keepUnusedDataFor: 0,
    }),
    getWithdrawal: builder.query<WithdrawalDetail, string>({
      queryFn: (id, { signal }) =>
        queryResult(() => walletApi.withdrawal(id, signal)),
      providesTags: ['Wallet'],
      keepUnusedDataFor: 0,
    }),
    requestWithdrawal: builder.mutation<WithdrawalDetail, RequestWithdrawal>({
      queryFn: input => queryResult(() => walletApi.request(input)),
      invalidatesTags: ['Wallet'],
    }),
    getPayoutBatches: builder.query<PayoutBatchPage, PayoutBatchQuery>({
      queryFn: (filters, { signal }) =>
        queryResult(() => payoutBatchesApi.list(filters, signal)),
      providesTags: ['Payout'],
      keepUnusedDataFor: 0,
    }),
    getPayoutBatch: builder.query<PayoutBatchDetail, string>({
      queryFn: (id, { signal }) =>
        queryResult(() => payoutBatchesApi.get(id, signal)),
      providesTags: ['Payout'],
      keepUnusedDataFor: 0,
    }),
    getPayments: builder.query<DentistPayments, PaymentsQuery>({
      queryFn: (filters, { signal }) =>
        queryResult(() => paymentsApi.list(filters, signal)),
      providesTags: ['Appointments'],
      keepUnusedDataFor: 0,
    }),
    getPayment: builder.query<DentistPayment, string>({
      queryFn: (id, { signal }) =>
        queryResult(() => paymentsApi.get(id, signal)),
      providesTags: ['Appointments'],
      keepUnusedDataFor: 0,
    }),
    getTimeOff: builder.query<TimeOff[], void>({
      queryFn: (_arg, { signal }) =>
        queryResult(() => availabilityApi.list(signal)),
      providesTags: ['TimeOff'],
      keepUnusedDataFor: 0,
    }),
    previewTimeOff: builder.mutation<TimeOffPreview, TimeOffInput>({
      queryFn: (input, { signal }) =>
        queryResult(() => availabilityApi.preview(input, signal)),
    }),
    createTimeOff: builder.mutation<
      TimeOff,
      TimeOffInput & { requestId: string }
    >({
      queryFn: (input, { signal }) =>
        queryResult(() => availabilityApi.create(input, signal)),
      invalidatesTags: ['TimeOff', 'AppointmentSlots'],
    }),
    removeTimeOff: builder.mutation<null, string>({
      queryFn: (id, { signal }) =>
        queryResult(() => availabilityApi.remove(id, signal)),
      invalidatesTags: ['TimeOff', 'AppointmentSlots'],
    }),
    getDentist: builder.query<Dentist | null, void>({
      queryFn: (_arg, { signal }) =>
        queryResult(() => dentistsApi.getMe(signal)),
      providesTags: ['Dentist'],
    }),
    updateDentist: builder.mutation<Dentist, DentistUpdate>({
      queryFn: (details, { signal }) =>
        queryResult(() => settingsApi.updateProfile(details, signal)),
      invalidatesTags: (_result, error) =>
        error ? [] : ['Dentist', 'VideoStatus', 'AppointmentSlots'],
    }),
    getClinics: builder.query<Clinic[], void>({
      queryFn: (_arg, { signal }) =>
        queryResult(() => settingsApi.listClinics(signal)),
      providesTags: ['Clinics'],
    }),
    addClinic: builder.mutation<Clinic, ClinicInput>({
      queryFn: (details, { signal }) =>
        queryResult(() => settingsApi.addClinic(details, signal)),
      invalidatesTags: (_result, error) =>
        error ? [] : ['Clinics', 'Dentist', 'AppointmentSlots'],
    }),
    updateClinic: builder.mutation<
      Clinic,
      { id: string; details: ClinicInput }
    >({
      queryFn: ({ id, details }, { signal }) =>
        queryResult(() => settingsApi.updateClinic(id, details, signal)),
      invalidatesTags: (_result, error) =>
        error ? [] : ['Clinics', 'Dentist', 'AppointmentSlots'],
    }),
    removeClinic: builder.mutation<null, string>({
      queryFn: (id, { signal }) =>
        queryResult(() => settingsApi.removeClinic(id, signal)),
      invalidatesTags: (_result, error) =>
        error ? [] : ['Clinics', 'Dentist', 'AppointmentSlots'],
    }),
    getPayoutProfile: builder.query<PayoutProfile, void>({
      queryFn: (_arg, { signal }) =>
        queryResult(() => settingsApi.getPayoutProfile(signal)),
      providesTags: ['Payout'],
      keepUnusedDataFor: 0,
    }),
    submitPayout: builder.mutation<PayoutRequest, PayoutSubmission>({
      queryFn: (details, { signal }) =>
        queryResult(() => settingsApi.submitPayout(details, signal)),
      invalidatesTags: (_result, error) =>
        !error || error.status === 409 ? ['Payout'] : [],
    }),
    getScheduleWeek: builder.query<ScheduleDay[], string>({
      queryFn: (startDate, { signal }) =>
        queryResult(() => appointmentsApi.week(startDate, signal)),
      providesTags: ['Appointments'],
      keepUnusedDataFor: 0,
    }),
    getTodayAppointments: builder.query<Appointment[], string>({
      queryFn: (date, { signal }) =>
        queryResult(() => appointmentsApi.listDay(date, signal)),
      providesTags: ['Appointments'],
      keepUnusedDataFor: 0,
    }),
    getDayAppointments: builder.query<
      Page<Appointment>,
      { date: string; page: number }
    >({
      queryFn: ({ date, page }, { signal }) =>
        queryResult(() => appointmentsApi.list(date, page, signal)),
      providesTags: ['Appointments'],
    }),
    getAppointment: builder.query<Appointment, string>({
      queryFn: (id, { signal }) =>
        queryResult(() => appointmentsApi.get(id, signal)),
      providesTags: ['Appointments'],
    }),
    collectClinicPayment: builder.mutation<
      Appointment,
      { appointmentId: string; details: CollectClinicPayment }
    >({
      queryFn: ({ appointmentId, details }, { signal }) =>
        queryResult(() =>
          clinicPaymentsApi.collect(appointmentId, details, signal),
        ),
      invalidatesTags: ['Appointments', 'PatientRecord'],
    }),
    checkInAppointment: builder.mutation<Appointment, string>({
      queryFn: (id, { signal }) =>
        queryResult(() => appointmentsApi.checkIn(id, signal)),
      invalidatesTags: ['Appointments', 'PatientRecord', 'VideoStatus'],
    }),
    cancelAppointment: builder.mutation<Appointment, string>({
      queryFn: (id, { signal }) =>
        queryResult(() => appointmentsApi.cancel(id, signal)),
      invalidatesTags: [
        'Appointments',
        'PatientRecord',
        'AppointmentSlots',
        'VideoStatus',
      ],
    }),
    rescheduleAppointment: builder.mutation<
      Appointment,
      { appointmentId: string; details: RescheduleAppointment }
    >({
      queryFn: ({ appointmentId, details }, { signal }) =>
        queryResult(() =>
          appointmentsApi.reschedule(appointmentId, details, signal),
        ),
      invalidatesTags: [
        'Appointments',
        'PatientRecord',
        'AppointmentSlots',
        'VideoStatus',
      ],
    }),
    getAppointmentSlots: builder.query<
      AppointmentSlots,
      AppointmentSlotRequest
    >({
      queryFn: (request, { signal }) =>
        queryResult(() => appointmentsApi.slots(request, signal)),
      providesTags: ['AppointmentSlots'],
      keepUnusedDataFor: 0,
    }),
    startConsultation: builder.mutation<Appointment, string>({
      queryFn: (id, { signal }) =>
        queryResult(() => appointmentsApi.start(id, signal)),
      invalidatesTags: (_result, error) =>
        !error || error.status === 409
          ? ['Appointments', 'VideoStatus', 'PatientRecord']
          : [],
    }),
    getConsultation: builder.query<Consultation, string>({
      queryFn: (id, { signal }) =>
        queryResult(() => consultationsApi.get(id, signal)),
      providesTags: (_result, _error, id) => [{ type: 'Consultation', id }],
      keepUnusedDataFor: 0,
    }),
    completeConsultation: builder.mutation<Appointment, string>({
      queryFn: (id, { signal }) =>
        queryResult(() => consultationsApi.complete(id, signal)),
      invalidatesTags: (_result, error, id) =>
        !error || error.status === 409
          ? [
              'Appointments',
              'VideoStatus',
              'Patients',
              'PatientRecord',
              { type: 'Consultation', id },
            ]
          : [],
    }),
    saveClinicalNote: builder.mutation<
      Consultation,
      { appointmentId: string; changes: Partial<ClinicalNote> }
    >({
      queryFn: ({ appointmentId, changes }, { signal }) =>
        queryResult(() =>
          consultationsApi.saveNote(appointmentId, changes, signal),
        ),
      invalidatesTags: (_result, error, { appointmentId }) =>
        !error
          ? [{ type: 'Consultation', id: appointmentId }, 'PatientRecord']
          : error.status === 409
          ? ['Appointments']
          : [],
    }),
    saveTreatmentPlan: builder.mutation<
      Consultation,
      { appointmentId: string; changes: Partial<TreatmentPlan> }
    >({
      queryFn: ({ appointmentId, changes }, { signal }) =>
        queryResult(() =>
          consultationsApi.savePlan(appointmentId, changes, signal),
        ),
      invalidatesTags: (_result, error, { appointmentId }) =>
        !error
          ? [{ type: 'Consultation', id: appointmentId }]
          : error.status === 409
          ? ['Appointments']
          : [],
    }),
    getPatients: builder.query<PatientSummary[], void>({
      queryFn: (_arg, { signal }) =>
        queryResult(() => patientsApi.list(signal)),
      providesTags: ['Patients'],
      keepUnusedDataFor: 0,
    }),
    getPatientRecord: builder.query<PatientRecord, string>({
      queryFn: (id, { signal }) =>
        queryResult(() => patientsApi.get(id, signal)),
      providesTags: (_result, _error, id) => [
        { type: 'PatientRecord', id },
        { type: 'PatientChart', id },
        { type: 'PatientAllergies', id },
      ],
      keepUnusedDataFor: 0,
    }),
    getPatientChart: builder.query<PatientDentalChart, string>({
      queryFn: (patientId, { signal }) =>
        queryResult(() => patientsApi.getDentalChart(patientId, signal)),
      providesTags: (_result, _error, patientId) => [
        { type: 'PatientChart', id: patientId },
      ],
      keepUnusedDataFor: 0,
    }),
    getPatientAllergies: builder.query<PatientAllergies, string>({
      queryFn: (id, { signal }) =>
        queryResult(() => patientsApi.getAllergies(id, signal)),
      providesTags: (_result, _error, id) => [{ type: 'PatientAllergies', id }],
      keepUnusedDataFor: 0,
    }),
    savePrescription: builder.mutation<
      Consultation,
      { appointmentId: string; items: MedicineForm[] }
    >({
      queryFn: ({ appointmentId, items }, { signal }) =>
        queryResult(() => prescriptionsApi.save(appointmentId, items, signal)),
      invalidatesTags: (_result, error, { appointmentId }) =>
        !error || error.status === 409
          ? [{ type: 'Consultation', id: appointmentId }]
          : [],
    }),
    requestPrescriptionCode: builder.mutation<OtpChallenge, string>({
      queryFn: (id, { signal }) =>
        queryResult(() => prescriptionsApi.requestCode(id, signal)),
      invalidatesTags: (_result, error, id) =>
        error?.status === 409
          ? [{ type: 'Consultation', id }, 'Appointments']
          : [],
    }),
    signPrescription: builder.mutation<
      Consultation,
      { appointmentId: string; signature: PrescriptionSignature }
    >({
      queryFn: ({ appointmentId, signature }, { signal }) =>
        queryResult(() =>
          prescriptionsApi.sign(appointmentId, signature, signal),
        ),
      invalidatesTags: (_result, error, { appointmentId }) =>
        !error || error.status === 409
          ? [{ type: 'Consultation', id: appointmentId }, 'Appointments']
          : [],
    }),
    saveDentalChart: builder.mutation<
      Consultation,
      { appointmentId: string; patientId: string; changes: ToothFinding[] }
    >({
      queryFn: ({ appointmentId, changes }, { signal }) =>
        queryResult(() =>
          consultationsApi.saveChart(appointmentId, changes, signal),
        ),
      invalidatesTags: (_result, error, { patientId }) =>
        !error
          ? [{ type: 'PatientChart', id: patientId }]
          : error.status === 409
          ? ['Appointments']
          : [],
    }),
    getNotifications: builder.query<NotificationPage, string | void>({
      queryFn: (cursor, { signal }) =>
        queryResult(() => notificationsApi.list(cursor || undefined, signal)),
      providesTags: ['Notifications'],
    }),
    markNotificationRead: builder.mutation<unknown, string>({
      queryFn: id => queryResult(() => notificationsApi.markRead(id)),
      invalidatesTags: (_result, error) => (error ? [] : ['Notifications']),
    }),
    markAllNotificationsRead: builder.mutation<unknown, string>({
      queryFn: through =>
        queryResult(() => notificationsApi.markAllRead(through)),
      invalidatesTags: (_result, error) => (error ? [] : ['Notifications']),
    }),
    getPatientFiles: builder.query<PatientFile[], string>({
      queryFn: (id, { signal }) =>
        queryResult(() => patientFilesApi.list(id, signal)),
      providesTags: ['PatientFiles'],
    }),
    getVideoStatus: builder.query<VideoStatus, string>({
      queryFn: (id, { signal }) =>
        queryResult(() => videoApi.getStatus(id, signal)),
      providesTags: ['VideoStatus'],
    }),
  }),
});

export const {
  useGetWalletQuery,
  useGetWithdrawalsQuery,
  useGetWithdrawalQuery,
  useRequestWithdrawalMutation,
  useGetPayoutBatchesQuery,
  useGetPayoutBatchQuery,
  useGetPaymentsQuery,
  useGetPaymentQuery,
  useCollectClinicPaymentMutation,
  useGetTimeOffQuery,
  usePreviewTimeOffMutation,
  useCreateTimeOffMutation,
  useRemoveTimeOffMutation,
  useCheckInAppointmentMutation,
  useCancelAppointmentMutation,
  useRescheduleAppointmentMutation,
  useGetAppointmentSlotsQuery,
  useGetPatientsQuery,
  useGetPatientRecordQuery,
  useCompleteConsultationMutation,
  useSaveTreatmentPlanMutation,
  useGetDentistQuery,
  useUpdateDentistMutation,
  useGetClinicsQuery,
  useAddClinicMutation,
  useUpdateClinicMutation,
  useRemoveClinicMutation,
  useGetPayoutProfileQuery,
  useSubmitPayoutMutation,
  useGetDayAppointmentsQuery,
  useGetTodayAppointmentsQuery,
  useGetScheduleWeekQuery,
  useGetAppointmentQuery,
  useStartConsultationMutation,
  useGetConsultationQuery,
  useSaveClinicalNoteMutation,
  useGetPatientChartQuery,
  useSaveDentalChartMutation,
  useGetPatientAllergiesQuery,
  useSavePrescriptionMutation,
  useRequestPrescriptionCodeMutation,
  useSignPrescriptionMutation,
  useGetNotificationsQuery,
  useMarkNotificationReadMutation,
  useMarkAllNotificationsReadMutation,
  useGetPatientFilesQuery,
  useGetVideoStatusQuery,
} = dentraApi;
