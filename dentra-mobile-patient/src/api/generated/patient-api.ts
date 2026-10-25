import { baseApi as api } from "../base-api";
export const addTagTypes = [
  "Consultations",
  "Patient Files",
  "Notifications",
  "Auth",
  "Patients",
  "Dentists",
  "Appointments",
  "Privacy",
] as const;
const injectedRtkApi = api
  .enhanceEndpoints({
    addTagTypes,
  })
  .injectEndpoints({
    endpoints: (build) => ({
      getAppointmentsByAppointmentIdPrescriptionPdf: build.query<
        GetAppointmentsByAppointmentIdPrescriptionPdfApiResponse,
        GetAppointmentsByAppointmentIdPrescriptionPdfApiArg
      >({
        query: (queryArg) => ({
          url: `/appointments/${queryArg.appointmentId}/prescription/pdf`,
        }),
        providesTags: ["Consultations"],
      }),
      getAppointmentsByAppointmentIdVisitSummaryPdf: build.query<
        GetAppointmentsByAppointmentIdVisitSummaryPdfApiResponse,
        GetAppointmentsByAppointmentIdVisitSummaryPdfApiArg
      >({
        query: (queryArg) => ({
          url: `/appointments/${queryArg.appointmentId}/visit-summary/pdf`,
        }),
        providesTags: ["Consultations"],
      }),
      postPatientsMeFiles: build.mutation<
        PostPatientsMeFilesApiResponse,
        PostPatientsMeFilesApiArg
      >({
        query: (queryArg) => ({
          url: `/patients/me/files`,
          method: "POST",
          body: queryArg.body,
        }),
        invalidatesTags: ["Patient Files"],
      }),
      getPatientsMeFiles: build.query<
        GetPatientsMeFilesApiResponse,
        GetPatientsMeFilesApiArg
      >({
        query: (queryArg) => ({
          url: `/patients/me/files`,
          params: {
            page: queryArg.page,
            appointmentId: queryArg.appointmentId,
          },
        }),
        providesTags: ["Patient Files"],
      }),
      deletePatientsMeFilesByFileId: build.mutation<
        DeletePatientsMeFilesByFileIdApiResponse,
        DeletePatientsMeFilesByFileIdApiArg
      >({
        query: (queryArg) => ({
          url: `/patients/me/files/${queryArg.fileId}`,
          method: "DELETE",
        }),
        invalidatesTags: ["Patient Files"],
      }),
      getAppointmentsByAppointmentIdAttachments: build.query<
        GetAppointmentsByAppointmentIdAttachmentsApiResponse,
        GetAppointmentsByAppointmentIdAttachmentsApiArg
      >({
        query: (queryArg) => ({
          url: `/appointments/${queryArg.appointmentId}/attachments`,
        }),
        providesTags: ["Patient Files"],
      }),
      getAppointmentsByAppointmentIdVideo: build.query<
        GetAppointmentsByAppointmentIdVideoApiResponse,
        GetAppointmentsByAppointmentIdVideoApiArg
      >({
        query: (queryArg) => ({
          url: `/appointments/${queryArg.appointmentId}/video`,
        }),
        providesTags: ["Consultations"],
      }),
      postAppointmentsByAppointmentIdVideoToken: build.mutation<
        PostAppointmentsByAppointmentIdVideoTokenApiResponse,
        PostAppointmentsByAppointmentIdVideoTokenApiArg
      >({
        query: (queryArg) => ({
          url: `/appointments/${queryArg.appointmentId}/video/token`,
          method: "POST",
          body: queryArg.body,
        }),
        invalidatesTags: ["Consultations"],
      }),
      getNotifications: build.query<
        GetNotificationsApiResponse,
        GetNotificationsApiArg
      >({
        query: (queryArg) => ({
          url: `/notifications`,
          params: {
            cursor: queryArg.cursor,
          },
        }),
        providesTags: ["Notifications"],
      }),
      patchNotificationsByNotificationIdRead: build.mutation<
        PatchNotificationsByNotificationIdReadApiResponse,
        PatchNotificationsByNotificationIdReadApiArg
      >({
        query: (queryArg) => ({
          url: `/notifications/${queryArg.notificationId}/read`,
          method: "PATCH",
        }),
        invalidatesTags: ["Notifications"],
      }),
      postNotificationsReadAll: build.mutation<
        PostNotificationsReadAllApiResponse,
        PostNotificationsReadAllApiArg
      >({
        query: (queryArg) => ({
          url: `/notifications/read-all`,
          method: "POST",
          body: queryArg.body,
        }),
        invalidatesTags: ["Notifications"],
      }),
      postAuthOtpRequest: build.mutation<
        PostAuthOtpRequestApiResponse,
        PostAuthOtpRequestApiArg
      >({
        query: (queryArg) => ({
          url: `/auth/otp/request`,
          method: "POST",
          body: queryArg.body,
        }),
        invalidatesTags: ["Auth"],
      }),
      postAuthOtpVerify: build.mutation<
        PostAuthOtpVerifyApiResponse,
        PostAuthOtpVerifyApiArg
      >({
        query: (queryArg) => ({
          url: `/auth/otp/verify`,
          method: "POST",
          body: queryArg.body,
        }),
        invalidatesTags: ["Auth"],
      }),
      postPatientsRegister: build.mutation<
        PostPatientsRegisterApiResponse,
        PostPatientsRegisterApiArg
      >({
        query: (queryArg) => ({
          url: `/patients/register`,
          method: "POST",
          body: queryArg.patientRegistration,
        }),
        invalidatesTags: ["Patients"],
      }),
      getPatientsMe: build.query<GetPatientsMeApiResponse, GetPatientsMeApiArg>(
        {
          query: () => ({ url: `/patients/me` }),
          providesTags: ["Patients"],
        },
      ),
      patchPatientsMe: build.mutation<
        PatchPatientsMeApiResponse,
        PatchPatientsMeApiArg
      >({
        query: (queryArg) => ({
          url: `/patients/me`,
          method: "PATCH",
          body: queryArg.patientUpdate,
        }),
        invalidatesTags: ["Patients"],
      }),
      getPatientsMeChart: build.query<
        GetPatientsMeChartApiResponse,
        GetPatientsMeChartApiArg
      >({
        query: () => ({ url: `/patients/me/chart` }),
        providesTags: ["Patients"],
      }),
      getDentists: build.query<GetDentistsApiResponse, GetDentistsApiArg>({
        query: (queryArg) => ({
          url: `/dentists`,
          params: {
            specialization: queryArg.specialization,
            type: queryArg["type"],
            q: queryArg.q,
            page: queryArg.page,
          },
        }),
        providesTags: ["Dentists"],
      }),
      getDentistsByDentistId: build.query<
        GetDentistsByDentistIdApiResponse,
        GetDentistsByDentistIdApiArg
      >({
        query: (queryArg) => ({ url: `/dentists/${queryArg.dentistId}` }),
        providesTags: ["Dentists"],
      }),
      getDentistsByDentistIdSlots: build.query<
        GetDentistsByDentistIdSlotsApiResponse,
        GetDentistsByDentistIdSlotsApiArg
      >({
        query: (queryArg) => ({
          url: `/dentists/${queryArg.dentistId}/slots`,
          params: {
            date: queryArg.date,
            type: queryArg["type"],
            clinicId: queryArg.clinicId,
          },
        }),
        providesTags: ["Dentists"],
      }),
      getAppointments: build.query<
        GetAppointmentsApiResponse,
        GetAppointmentsApiArg
      >({
        query: (queryArg) => ({
          url: `/appointments`,
          params: {
            status: queryArg.status,
            date: queryArg.date,
            page: queryArg.page,
          },
        }),
        providesTags: ["Appointments"],
      }),
      postAppointments: build.mutation<
        PostAppointmentsApiResponse,
        PostAppointmentsApiArg
      >({
        query: (queryArg) => ({
          url: `/appointments`,
          method: "POST",
          body: queryArg.bookAppointment,
        }),
        invalidatesTags: ["Appointments", "Patient Files"],
      }),
      getAppointmentsByAppointmentId: build.query<
        GetAppointmentsByAppointmentIdApiResponse,
        GetAppointmentsByAppointmentIdApiArg
      >({
        query: (queryArg) => ({
          url: `/appointments/${queryArg.appointmentId}`,
        }),
        providesTags: ["Appointments"],
      }),
      postAppointmentsByAppointmentIdCancel: build.mutation<
        PostAppointmentsByAppointmentIdCancelApiResponse,
        PostAppointmentsByAppointmentIdCancelApiArg
      >({
        query: (queryArg) => ({
          url: `/appointments/${queryArg.appointmentId}/cancel`,
          method: "POST",
        }),
        invalidatesTags: ["Appointments"],
      }),
      postAppointmentsByAppointmentIdReschedule: build.mutation<
        PostAppointmentsByAppointmentIdRescheduleApiResponse,
        PostAppointmentsByAppointmentIdRescheduleApiArg
      >({
        query: (queryArg) => ({
          url: `/appointments/${queryArg.appointmentId}/reschedule`,
          method: "POST",
          body: queryArg.body,
        }),
        invalidatesTags: ["Appointments"],
      }),
      getAppointmentsByAppointmentIdConsultation: build.query<
        GetAppointmentsByAppointmentIdConsultationApiResponse,
        GetAppointmentsByAppointmentIdConsultationApiArg
      >({
        query: (queryArg) => ({
          url: `/appointments/${queryArg.appointmentId}/consultation`,
        }),
        providesTags: ["Consultations"],
      }),
      postPrivacyRequests: build.mutation<
        PostPrivacyRequestsApiResponse,
        PostPrivacyRequestsApiArg
      >({
        query: (queryArg) => ({
          url: `/privacy-requests`,
          method: "POST",
          body: queryArg.body,
        }),
        invalidatesTags: ["Privacy"],
      }),
    }),
    overrideExisting: false,
  });
export { injectedRtkApi as dentraApi };
export type GetAppointmentsByAppointmentIdPrescriptionPdfApiResponse = unknown;
export type GetAppointmentsByAppointmentIdPrescriptionPdfApiArg = {
  appointmentId: string;
};
export type GetAppointmentsByAppointmentIdVisitSummaryPdfApiResponse = unknown;
export type GetAppointmentsByAppointmentIdVisitSummaryPdfApiArg = {
  appointmentId: string;
};
export type PostPatientsMeFilesApiResponse =
  /** status 201 Private upload, including an idempotent retry */ PatientFile;
export type PostPatientsMeFilesApiArg = {
  body: {
    uploadKey: string;
    file: Blob;
  };
};
export type GetPatientsMeFilesApiResponse =
  /** status 200 Newest first, 20 per page */ PatientFilePage;
export type GetPatientsMeFilesApiArg = {
  page?: number;
  appointmentId?: string;
};
export type DeletePatientsMeFilesByFileIdApiResponse = unknown;
export type DeletePatientsMeFilesByFileIdApiArg = {
  fileId: string;
};
export type GetAppointmentsByAppointmentIdAttachmentsApiResponse =
  /** status 200 Appointment attachments */ PatientFile[];
export type GetAppointmentsByAppointmentIdAttachmentsApiArg = {
  appointmentId: string;
};
export type GetAppointmentsByAppointmentIdVideoApiResponse =
  /** status 200 Appointment-scoped video availability; never includes a call token */ VideoStatus;
export type GetAppointmentsByAppointmentIdVideoApiArg = {
  appointmentId: string;
};
export type PostAppointmentsByAppointmentIdVideoTokenApiResponse =
  /** status 200 No-store appointment room credentials; keep only in memory */ VideoSession;
export type PostAppointmentsByAppointmentIdVideoTokenApiArg = {
  appointmentId: string;
  body: {
    platform: "android" | "ios" | "web";
  };
};
export type GetNotificationsApiResponse =
  /** status 200 Personal notification inbox */ {
    items: Notification[];
    nextCursor: string | null;
    unreadCount: number;
  };
export type GetNotificationsApiArg = {
  /** nextCursor from the preceding page; must belong to the authenticated user. */
  cursor?: string;
};
export type PatchNotificationsByNotificationIdReadApiResponse =
  /** status 200 Read state saved; repeat calls preserve the original readAt */ Notification;
export type PatchNotificationsByNotificationIdReadApiArg = {
  notificationId: string;
};
export type PostNotificationsReadAllApiResponse =
  /** status 200 Read state saved */ {
    markedRead: number;
  };
export type PostNotificationsReadAllApiArg = {
  body: {
    /** ID of the newest displayed notification */
    through: string;
  };
};
export type PostAuthOtpRequestApiResponse =
  /** status 200 Code sent. isNewAccount is true whenever no profile exists yet for this role — a brand-new patient AND a brand-new dentist applicant both verify first, then complete their profile (POST /patients/register or POST /dentists/applications) with the token this flow ends in. */ {
    otpId?: string;
    expiresInSeconds?: number;
    resendAfterSeconds?: number;
    /** True if no profile (Patient or Dentist application) exists yet for this number under the requested role. */
    isNewAccount?: boolean;
  };
export type PostAuthOtpRequestApiArg = {
  body: {
    mobile: string;
    /** Which app is requesting the code; resolves to the matching role's account lookup. */
    purpose: "patient" | "dentist";
  };
};
export type PostAuthOtpVerifyApiResponse =
  /** status 200 Verified */ AuthTokens;
export type PostAuthOtpVerifyApiArg = {
  body: {
    otpId: string;
    /** The generated 4-digit OTP, including any leading zeros. No bypass codes are accepted. */
    code: string;
    /** Stable per app install; used to scope the refresh token. */
    deviceId: string;
  };
};
export type PostPatientsRegisterApiResponse =
  /** status 201 Account created */ Patient;
export type PostPatientsRegisterApiArg = {
  patientRegistration: PatientRegistration;
};
export type GetPatientsMeApiResponse = /** status 200 OK */ Patient;
export type GetPatientsMeApiArg = void;
export type PatchPatientsMeApiResponse = /** status 200 Updated */ Patient;
export type PatchPatientsMeApiArg = {
  patientUpdate: PatientUpdate;
};
export type GetPatientsMeChartApiResponse = /** status 200 OK */ ChartEntry[];
export type GetPatientsMeChartApiArg = void;
export type GetDentistsApiResponse = /** status 200 OK */ {
  items?: DentistPublic[];
  nextPage?: number | null;
};
export type GetDentistsApiArg = {
  specialization?: string;
  /** Filter to dentists offering this visit type */
  type?: "video" | "clinic";
  /** Free-text match against name, specialization, clinic names, languages */
  q?: string;
  page?: number;
};
export type GetDentistsByDentistIdApiResponse =
  /** status 200 OK */ DentistPublic;
export type GetDentistsByDentistIdApiArg = {
  dentistId: string;
};
export type GetDentistsByDentistIdSlotsApiResponse = /** status 200 OK */ {
  date?: string;
  slots?: string[];
};
export type GetDentistsByDentistIdSlotsApiArg = {
  dentistId: string;
  date: string;
  type: "video" | "clinic";
  clinicId?: string;
};
export type GetAppointmentsApiResponse = /** status 200 OK */ {
  items?: Appointment[];
  nextPage?: number | null;
};
export type GetAppointmentsApiArg = {
  status?: AppointmentStatus;
  date?: string;
  page?: number;
};
export type PostAppointmentsApiResponse = /** status 201 Booked */ Appointment;
export type PostAppointmentsApiArg = {
  bookAppointment: BookAppointment;
};
export type GetAppointmentsByAppointmentIdApiResponse =
  /** status 200 OK */ Appointment;
export type GetAppointmentsByAppointmentIdApiArg = {
  appointmentId: string;
};
export type PostAppointmentsByAppointmentIdCancelApiResponse =
  /** status 200 Cancelled */ Appointment;
export type PostAppointmentsByAppointmentIdCancelApiArg = {
  appointmentId: string;
};
export type PostAppointmentsByAppointmentIdRescheduleApiResponse =
  /** status 200 Rescheduled */ Appointment;
export type PostAppointmentsByAppointmentIdRescheduleApiArg = {
  appointmentId: string;
  body: {
    date: string;
    time: string;
    /** Optional current date; send together with expectedTime to reject changes made on another device. An identical target is a safe retry. */
    expectedDate?: string;
    expectedTime?: string;
  };
};
export type GetAppointmentsByAppointmentIdConsultationApiResponse =
  /** status 200 OK */ Consultation;
export type GetAppointmentsByAppointmentIdConsultationApiArg = {
  appointmentId: string;
};
export type PostPrivacyRequestsApiResponse =
  /** status 201 Filed, with an SLA due date set from the statutory response window */ PrivacyRequest;
export type PostPrivacyRequestsApiArg = {
  body: {
    type: PrivacyRequestType;
  };
};
export type PatientFile = {
  id: string;
  appointmentId: string | null;
  name: string;
  mimeType: "image/jpeg" | "image/png" | "application/pdf";
  sizeBytes: number;
  createdAt: string;
  expiresAt: string | null;
  dentistName: string | null;
  appointmentDate: string | null;
};
export type PatientFilePage = {
  items: PatientFile[];
  nextPage: number | null;
};
export type VideoStatus = {
  available: boolean;
  canJoin: boolean;
  reason:
    | "ready"
    | "unavailable"
    | "not_video"
    | "closed"
    | "too_early"
    | "payment_required"
    | "dentist_unavailable"
    | "session_ended";
  opensAt: string;
  closesAt: string;
  serverNow: string;
  roomName: string | null;
};
export type VideoSession = {
  provider: "livekit";
  serverUrl: string;
  token: string;
  identity: string;
  roomName: string;
  role: "patient" | "dentist";
  closesAt: string;
  issuedAt: string;
};
export type BookingNotification = {
  id: string;
  type: "appointment_booked";
  appointmentId: string;
  patientName: string;
  date: string;
  time: string;
  appointmentType: "clinic" | "video";
  createdAt: string;
  readAt: string | null;
};
export type DentistOnboardingNotification = {
  id: string;
  type: "dentist_onboarding_submitted";
  dentistId: string;
  dentistName: string;
  qualification: string;
  specialization: string;
  createdAt: string;
  readAt: string | null;
};
export type WithdrawalNotification = {
  id: string;
  type: "wallet_withdrawal_requested";
  withdrawalId: string;
  dentistId: string;
  dentistName: string;
  amountPaise: number;
  readAt: string | null;
  createdAt: string;
};
export type WalletWithdrawalNotification = {
  id: string;
  type: "wallet_withdrawal_updated";
  withdrawalId: string;
  amountPaise: number;
  status:
    "approved" | "rejected" | "processing" | "paid" | "failed" | "cancelled";
  reason: string | null;
  readAt: string | null;
  createdAt: string;
};
export type PatientAppointmentNotification = {
  id: string;
  type:
    | "booking_confirmed"
    | "appointment_cancelled"
    | "appointment_rescheduled"
    | "appointment_reminder"
    | "visit_summary_ready";
  appointmentId: string;
  dentistName: string;
  date: string;
  time: string;
  appointmentType: "clinic" | "video";
  /** Booking reserves the slot but an online payment still needs completion */
  paymentRequired: boolean;
  previousDate?: string | null;
  previousTime?: string | null;
  createdAt: string;
  readAt: string | null;
};
export type Notification =
  | ({
      type: "appointment_booked";
    } & BookingNotification)
  | ({
      type: "dentist_onboarding_submitted";
    } & DentistOnboardingNotification)
  | ({
      type: "wallet_withdrawal_requested";
    } & WithdrawalNotification)
  | ({
      type: "wallet_withdrawal_updated";
    } & WalletWithdrawalNotification)
  | ({
      type: "booking_confirmed";
    } & PatientAppointmentNotification)
  | ({
      type: "appointment_cancelled";
    } & PatientAppointmentNotification)
  | ({
      type: "appointment_rescheduled";
    } & PatientAppointmentNotification)
  | ({
      type: "appointment_reminder";
    } & PatientAppointmentNotification)
  | ({
      type: "visit_summary_ready";
    } & PatientAppointmentNotification);
export type Error = {
  code?: string;
  message?: string;
};
export type AuthTokens = {
  accessToken?: string;
  refreshToken?: string;
  expiresInSeconds?: number;
  /** Patients only — true if registration is still needed before the token can be used for anything but POST /patients/register. */
  isNewAccount?: boolean;
};
export type Patient = {
  id?: string;
  fullName?: string;
  mobile?: string;
  dateOfBirth?: string;
  gender?: string;
  email?: string;
  city?: string;
  preferredLanguage?: string;
  allergies?: string;
  conditions?: string;
  medications?: string;
  emergencyContact?: string;
  guardian?: {
    name?: string;
    relationship?: string;
    mobile?: string;
    consentAt?: string;
  } | null;
  createdAt?: string;
};
export type PatientRegistration = {
  fullName: string;
  dateOfBirth: string;
  gender?: string;
  email?: string;
  city?: string;
  preferredLanguage?: string;
  termsConsent: boolean;
  telemedicineConsent: boolean;
  guardianName?: string;
  guardianRelationship?: string;
  guardianMobile?: string;
  guardianConsent?: boolean;
};
export type PatientUpdate = {
  fullName?: string;
  email?: string;
  city?: string;
  preferredLanguage?: string;
  allergies?: string;
  conditions?: string;
  medications?: string;
  emergencyContact?: string;
};
export type ToothStatus =
  "healthy" | "caries" | "filled" | "crown" | "rct" | "missing" | "extract";
export type ChartEntry = {
  toothNumber?: string;
  status?: ToothStatus;
  recordedByDentistId?: string | null;
  recordedAt?: string;
};
export type WorkingDays = number[];
export type Clinic = {
  workingDays?: WorkingDays;
  id?: string;
  name?: string;
  addressLine?: string;
  pincode?: string;
  phone?: string;
  hoursFrom?: string;
  hoursTo?: string;
};
export type DentistPublic = {
  videoWorkingDays?: WorkingDays;
  id?: string;
  fullName?: string;
  qualification?: string;
  specialization?: string;
  yearsExperience?: number;
  languages?: string[];
  offersVideo?: boolean;
  feeVideoPaise?: number;
  feeClinicPaise?: number;
  videoHoursFrom?: string | null;
  videoHoursTo?: string | null;
  clinics?: Clinic[];
  councilRegNo?: string;
};
export type AppointmentType = "video" | "clinic";
export type AppointmentStatus =
  "booked" | "waiting" | "in_consult" | "completed" | "cancelled";
export type ClinicCollectionMethod = "cash" | "upi" | "card";
export type ClinicPaymentReceipt = {
  id: string;
  amountPaise: number;
  method: ClinicCollectionMethod;
  /** Server-recorded receipt time. */
  collectedAt: string;
} | null;
export type Appointment = {
  id?: string;
  patientId?: string;
  patientName?: string;
  patientAge?: number | null;
  patientGender?: string | null;
  dentistId?: string;
  dentistName?: string;
  clinicId?: string | null;
  clinicName?: string | null;
  type?: AppointmentType;
  date?: string;
  time?: string;
  status?: AppointmentStatus;
  concern?: string;
  concerns?: string[];
  symptomArea?: string;
  symptomSince?: string;
  painScore?: number | null;
  swelling?: boolean;
  note?: string;
  photoUrls?: string[];
  payment?: {
    collection?: ClinicPaymentReceipt;
    method?: string;
    amountPaise?: number;
    status?:
      | "pending"
      | "paid"
      | "due_at_clinic"
      | "refund_pending"
      | "refund_failed"
      | "refunded"
      | "cancelled"
      | "failed";
    /** New online bookings hold the slot for 15 minutes. Legacy and pay-at-clinic bookings have no checkout deadline. */
    expiresAt?: string | null;
    /** Razorpay order id. Null for pay_at_clinic bookings, which never create a gateway order. */
    gatewayOrderId?: string | null;
    /** Public Razorpay checkout key id. Never the API signing secret. */
    gatewayKeyId?: string | null;
  };
  bookedAt?: string;
  completedAt?: string | null;
  cancelledAt?: string | null;
  rescheduledAt?: string | null;
};
export type BookAppointment = {
  dentistId: string;
  /** Required when type=clinic and the dentist has more than one location; otherwise defaulted to the dentist's only clinic server-side. */
  clinicId?: string;
  type: AppointmentType;
  date: string;
  time: string;
  concern: string;
  concerns?: string[];
  symptomArea?: string;
  symptomSince?: string;
  painScore?: number;
  swelling?: boolean;
  note?: string;
  photoUrls?: string[];
  /** IDs of the patient's unexpired uploads to bind atomically to this booking. */
  attachmentIds?: string[];
  paymentMethod: "upi" | "card" | "netbanking" | "pay_at_clinic";
  /** One per booking attempt */
  idempotencyKey: string;
};
export type TreatmentPlanItem = {
  procedure: string;
  teeth: string[];
  estimatedCostPaise?: number | null;
};
export type PrescriptionItemInput = {
  medicineName: string;
  strength?: string;
  dose: string;
  frequency: string;
  duration: string;
  instructions?: string;
};
export type Consultation = {
  appointmentId?: string;
  chiefComplaint?: string;
  findings?: string;
  diagnosis?: string;
  treatmentDone?: string;
  plan?: string;
  planItems?: TreatmentPlanItem[];
  followUpDate?: string | null;
  isEdited?: boolean;
  editedAt?: string | null;
  prescription?: {
    id?: string;
    signedByDentistId?: string | null;
    signedAt?: string | null;
    items?: PrescriptionItemInput[];
  } | null;
};
export type PrivacyRequestType = "export" | "erase";
export type PrivacyRequestStatus = "open" | "resolved";
export type PrivacyRequest = {
  id?: string;
  patientId?: string;
  patientName?: string;
  type?: PrivacyRequestType;
  status?: PrivacyRequestStatus;
  slaDueAt?: string;
  resolvedAt?: string | null;
  createdAt?: string;
};
export const {
  useGetAppointmentsByAppointmentIdPrescriptionPdfQuery,
  useLazyGetAppointmentsByAppointmentIdPrescriptionPdfQuery,
  useGetAppointmentsByAppointmentIdVisitSummaryPdfQuery,
  useLazyGetAppointmentsByAppointmentIdVisitSummaryPdfQuery,
  usePostPatientsMeFilesMutation,
  useGetPatientsMeFilesQuery,
  useLazyGetPatientsMeFilesQuery,
  useDeletePatientsMeFilesByFileIdMutation,
  useGetAppointmentsByAppointmentIdAttachmentsQuery,
  useLazyGetAppointmentsByAppointmentIdAttachmentsQuery,
  useGetAppointmentsByAppointmentIdVideoQuery,
  useLazyGetAppointmentsByAppointmentIdVideoQuery,
  usePostAppointmentsByAppointmentIdVideoTokenMutation,
  useGetNotificationsQuery,
  useLazyGetNotificationsQuery,
  usePatchNotificationsByNotificationIdReadMutation,
  usePostNotificationsReadAllMutation,
  usePostAuthOtpRequestMutation,
  usePostAuthOtpVerifyMutation,
  usePostPatientsRegisterMutation,
  useGetPatientsMeQuery,
  useLazyGetPatientsMeQuery,
  usePatchPatientsMeMutation,
  useGetPatientsMeChartQuery,
  useLazyGetPatientsMeChartQuery,
  useGetDentistsQuery,
  useLazyGetDentistsQuery,
  useGetDentistsByDentistIdQuery,
  useLazyGetDentistsByDentistIdQuery,
  useGetDentistsByDentistIdSlotsQuery,
  useLazyGetDentistsByDentistIdSlotsQuery,
  useGetAppointmentsQuery,
  useLazyGetAppointmentsQuery,
  usePostAppointmentsMutation,
  useGetAppointmentsByAppointmentIdQuery,
  useLazyGetAppointmentsByAppointmentIdQuery,
  usePostAppointmentsByAppointmentIdCancelMutation,
  usePostAppointmentsByAppointmentIdRescheduleMutation,
  useGetAppointmentsByAppointmentIdConsultationQuery,
  useLazyGetAppointmentsByAppointmentIdConsultationQuery,
  usePostPrivacyRequestsMutation,
} = injectedRtkApi;
