import { baseApi as api } from "./base-api";
export const addTagTypes = [
  "Consultations",
  "Patient Files",
  "Notifications",
  "Auth",
  "Patients",
  "Dentists",
  "Dentist Onboarding",
  "Admin",
  "Wallet",
  "Payout Batches",
  "Dentist Payouts",
  "Admin Payouts",
  "Appointments",
  "Payments",
  "Privacy",
  "Video Chat",
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
      getPatientFilesByFileIdContent: build.query<
        GetPatientFilesByFileIdContentApiResponse,
        GetPatientFilesByFileIdContentApiArg
      >({
        query: (queryArg) => ({
          url: `/patient-files/${queryArg.fileId}/content`,
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
      getNotificationsByNotificationId: build.query<
        GetNotificationsByNotificationIdApiResponse,
        GetNotificationsByNotificationIdApiArg
      >({
        query: (queryArg) => ({
          url: `/notifications/${queryArg.notificationId}`,
        }),
        providesTags: ["Notifications"],
      }),
      getNotificationsPushDevice: build.query<
        GetNotificationsPushDeviceApiResponse,
        GetNotificationsPushDeviceApiArg
      >({
        query: () => ({ url: `/notifications/push-device` }),
        providesTags: ["Notifications"],
      }),
      putNotificationsPushDevice: build.mutation<
        PutNotificationsPushDeviceApiResponse,
        PutNotificationsPushDeviceApiArg
      >({
        query: (queryArg) => ({
          url: `/notifications/push-device`,
          method: "PUT",
          body: queryArg.body,
        }),
        invalidatesTags: ["Notifications"],
      }),
      deleteNotificationsPushDevice: build.mutation<
        DeleteNotificationsPushDeviceApiResponse,
        DeleteNotificationsPushDeviceApiArg
      >({
        query: () => ({ url: `/notifications/push-device`, method: "DELETE" }),
        invalidatesTags: ["Notifications"],
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
      postAuthAdminLogin: build.mutation<
        PostAuthAdminLoginApiResponse,
        PostAuthAdminLoginApiArg
      >({
        query: (queryArg) => ({
          url: `/auth/admin/login`,
          method: "POST",
          body: queryArg.body,
        }),
        invalidatesTags: ["Auth"],
      }),
      postAuthRefresh: build.mutation<
        PostAuthRefreshApiResponse,
        PostAuthRefreshApiArg
      >({
        query: (queryArg) => ({
          url: `/auth/refresh`,
          method: "POST",
          body: queryArg.body,
        }),
        invalidatesTags: ["Auth"],
      }),
      postAuthLogout: build.mutation<
        PostAuthLogoutApiResponse,
        PostAuthLogoutApiArg
      >({
        query: (queryArg) => ({
          url: `/auth/logout`,
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
      postDentistsApplications: build.mutation<
        PostDentistsApplicationsApiResponse,
        PostDentistsApplicationsApiArg
      >({
        query: (queryArg) => ({
          url: `/dentists/applications`,
          method: "POST",
          body: queryArg.dentistApplication,
        }),
        invalidatesTags: ["Dentist Onboarding"],
      }),
      patchDentistsApplicationsMe: build.mutation<
        PatchDentistsApplicationsMeApiResponse,
        PatchDentistsApplicationsMeApiArg
      >({
        query: (queryArg) => ({
          url: `/dentists/applications/me`,
          method: "PATCH",
          body: queryArg.dentistApplication,
        }),
        invalidatesTags: ["Dentist Onboarding"],
      }),
      postDentistsApplicationsMeSubmit: build.mutation<
        PostDentistsApplicationsMeSubmitApiResponse,
        PostDentistsApplicationsMeSubmitApiArg
      >({
        query: () => ({
          url: `/dentists/applications/me/submit`,
          method: "POST",
        }),
        invalidatesTags: ["Dentist Onboarding"],
      }),
      postDentistsApplicationsByDentistIdDocuments: build.mutation<
        PostDentistsApplicationsByDentistIdDocumentsApiResponse,
        PostDentistsApplicationsByDentistIdDocumentsApiArg
      >({
        query: (queryArg) => ({
          url: `/dentists/applications/${queryArg.dentistId}/documents`,
          method: "POST",
          body: queryArg.body,
        }),
        invalidatesTags: ["Dentist Onboarding"],
      }),
      getDentistsApplicationsByDentistIdDocumentsAndDocumentId: build.query<
        GetDentistsApplicationsByDentistIdDocumentsAndDocumentIdApiResponse,
        GetDentistsApplicationsByDentistIdDocumentsAndDocumentIdApiArg
      >({
        query: (queryArg) => ({
          url: `/dentists/applications/${queryArg.dentistId}/documents/${queryArg.documentId}`,
        }),
        providesTags: ["Dentist Onboarding"],
      }),
      getAdminMe: build.query<GetAdminMeApiResponse, GetAdminMeApiArg>({
        query: () => ({ url: `/admin/me` }),
        providesTags: ["Admin"],
      }),
      patchAdminMe: build.mutation<PatchAdminMeApiResponse, PatchAdminMeApiArg>(
        {
          query: (queryArg) => ({
            url: `/admin/me`,
            method: "PATCH",
            body: queryArg.adminProfileUpdate,
          }),
          invalidatesTags: ["Admin"],
        },
      ),
      getAdminSettings: build.query<
        GetAdminSettingsApiResponse,
        GetAdminSettingsApiArg
      >({
        query: () => ({ url: `/admin/settings` }),
        providesTags: ["Admin"],
      }),
      patchAdminSettings: build.mutation<
        PatchAdminSettingsApiResponse,
        PatchAdminSettingsApiArg
      >({
        query: (queryArg) => ({
          url: `/admin/settings`,
          method: "PATCH",
          body: queryArg.platformSettingsUpdate,
        }),
        invalidatesTags: ["Admin"],
      }),
      getAdminPayments: build.query<
        GetAdminPaymentsApiResponse,
        GetAdminPaymentsApiArg
      >({
        query: (queryArg) => ({
          url: `/admin/payments`,
          params: {
            status: queryArg.status,
            method: queryArg.method,
            q: queryArg.q,
            from: queryArg["from"],
            to: queryArg.to,
            page: queryArg.page,
          },
        }),
        providesTags: ["Admin"],
      }),
      postAdminPaymentsByTransactionIdRefundRetry: build.mutation<
        PostAdminPaymentsByTransactionIdRefundRetryApiResponse,
        PostAdminPaymentsByTransactionIdRefundRetryApiArg
      >({
        query: (queryArg) => ({
          url: `/admin/payments/${queryArg.transactionId}/refund/retry`,
          method: "POST",
        }),
        invalidatesTags: ["Admin"],
      }),
      getDentistWallet: build.query<
        GetDentistWalletApiResponse,
        GetDentistWalletApiArg
      >({
        query: () => ({ url: `/dentists/me/wallet` }),
        providesTags: ["Wallet"],
      }),
      listDentistWithdrawals: build.query<
        ListDentistWithdrawalsApiResponse,
        ListDentistWithdrawalsApiArg
      >({
        query: (queryArg) => ({
          url: `/dentists/me/withdrawals`,
          params: {
            page: queryArg.page,
            limit: queryArg.limit,
            status: queryArg.status,
          },
        }),
        providesTags: ["Wallet"],
      }),
      requestDentistWithdrawal: build.mutation<
        RequestDentistWithdrawalApiResponse,
        RequestDentistWithdrawalApiArg
      >({
        query: (queryArg) => ({
          url: `/dentists/me/withdrawals`,
          method: "POST",
          body: queryArg.requestWithdrawal,
        }),
        invalidatesTags: ["Wallet"],
      }),
      getDentistWithdrawal: build.query<
        GetDentistWithdrawalApiResponse,
        GetDentistWithdrawalApiArg
      >({
        query: (queryArg) => ({
          url: `/dentists/me/withdrawals/${queryArg.withdrawalId}`,
        }),
        providesTags: ["Wallet"],
      }),
      getWalletSettings: build.query<
        GetWalletSettingsApiResponse,
        GetWalletSettingsApiArg
      >({
        query: () => ({ url: `/admin/wallet-settings` }),
        providesTags: ["Wallet"],
      }),
      updateWalletSettings: build.mutation<
        UpdateWalletSettingsApiResponse,
        UpdateWalletSettingsApiArg
      >({
        query: (queryArg) => ({
          url: `/admin/wallet-settings`,
          method: "PATCH",
          body: queryArg.walletSettingsUpdate,
        }),
        invalidatesTags: ["Wallet"],
      }),
      listAdminWithdrawals: build.query<
        ListAdminWithdrawalsApiResponse,
        ListAdminWithdrawalsApiArg
      >({
        query: (queryArg) => ({
          url: `/admin/withdrawals`,
          params: {
            page: queryArg.page,
            limit: queryArg.limit,
            status: queryArg.status,
            q: queryArg.q,
          },
        }),
        providesTags: ["Wallet"],
      }),
      getAdminWithdrawal: build.query<
        GetAdminWithdrawalApiResponse,
        GetAdminWithdrawalApiArg
      >({
        query: (queryArg) => ({
          url: `/admin/withdrawals/${queryArg.withdrawalId}`,
        }),
        providesTags: ["Wallet"],
      }),
      changeWithdrawal: build.mutation<
        ChangeWithdrawalApiResponse,
        ChangeWithdrawalApiArg
      >({
        query: (queryArg) => ({
          url: `/admin/withdrawals/${queryArg.withdrawalId}/actions`,
          method: "POST",
          body: queryArg.withdrawalAction,
        }),
        invalidatesTags: ["Wallet"],
      }),
      listPayoutDentists: build.query<
        ListPayoutDentistsApiResponse,
        ListPayoutDentistsApiArg
      >({
        query: (queryArg) => ({
          url: `/admin/payout-batches/dentists`,
          params: {
            page: queryArg.page,
            limit: queryArg.limit,
            q: queryArg.q,
          },
        }),
        providesTags: ["Payout Batches"],
      }),
      listEligiblePayouts: build.query<
        ListEligiblePayoutsApiResponse,
        ListEligiblePayoutsApiArg
      >({
        query: (queryArg) => ({
          url: `/admin/payout-batches/eligible`,
          params: {
            page: queryArg.page,
            limit: queryArg.limit,
            dentistId: queryArg.dentistId,
          },
        }),
        providesTags: ["Payout Batches"],
      }),
      listAdminPayoutBatches: build.query<
        ListAdminPayoutBatchesApiResponse,
        ListAdminPayoutBatchesApiArg
      >({
        query: (queryArg) => ({
          url: `/admin/payout-batches`,
          params: {
            page: queryArg.page,
            limit: queryArg.limit,
            status: queryArg.status,
            dentistId: queryArg.dentistId,
          },
        }),
        providesTags: ["Payout Batches"],
      }),
      createPayoutBatch: build.mutation<
        CreatePayoutBatchApiResponse,
        CreatePayoutBatchApiArg
      >({
        query: (queryArg) => ({
          url: `/admin/payout-batches`,
          method: "POST",
          body: queryArg.createPayoutBatch,
        }),
        invalidatesTags: ["Payout Batches"],
      }),
      getAdminPayoutBatch: build.query<
        GetAdminPayoutBatchApiResponse,
        GetAdminPayoutBatchApiArg
      >({
        query: (queryArg) => ({
          url: `/admin/payout-batches/${queryArg.batchId}`,
        }),
        providesTags: ["Payout Batches"],
      }),
      changePayoutBatch: build.mutation<
        ChangePayoutBatchApiResponse,
        ChangePayoutBatchApiArg
      >({
        query: (queryArg) => ({
          url: `/admin/payout-batches/${queryArg.batchId}/actions`,
          method: "POST",
          body: queryArg.changePayoutBatch,
        }),
        invalidatesTags: ["Payout Batches"],
      }),
      listDentistPayoutBatches: build.query<
        ListDentistPayoutBatchesApiResponse,
        ListDentistPayoutBatchesApiArg
      >({
        query: (queryArg) => ({
          url: `/dentists/me/payout-batches`,
          params: {
            page: queryArg.page,
            limit: queryArg.limit,
            status: queryArg.status,
          },
        }),
        providesTags: ["Payout Batches"],
      }),
      getDentistPayoutBatch: build.query<
        GetDentistPayoutBatchApiResponse,
        GetDentistPayoutBatchApiArg
      >({
        query: (queryArg) => ({
          url: `/dentists/me/payout-batches/${queryArg.batchId}`,
        }),
        providesTags: ["Payout Batches"],
      }),
      getDentistPayoutDetails: build.query<
        GetDentistPayoutDetailsApiResponse,
        GetDentistPayoutDetailsApiArg
      >({
        query: () => ({ url: `/dentists/me/payout-details` }),
        providesTags: ["Dentist Payouts"],
      }),
      submitDentistPayoutRequest: build.mutation<
        SubmitDentistPayoutRequestApiResponse,
        SubmitDentistPayoutRequestApiArg
      >({
        query: (queryArg) => ({
          url: `/dentists/me/payout-requests`,
          method: "POST",
          body: queryArg.payoutSubmission,
        }),
        invalidatesTags: ["Dentist Payouts", "Dentists"],
      }),
      getAdminDentistPayoutDetails: build.query<
        GetAdminDentistPayoutDetailsApiResponse,
        GetAdminDentistPayoutDetailsApiArg
      >({
        query: (queryArg) => ({
          url: `/admin/dentists/${queryArg.dentistId}/payout-details`,
        }),
        providesTags: ["Admin Payouts"],
      }),
      listAdminPayoutRequests: build.query<
        ListAdminPayoutRequestsApiResponse,
        ListAdminPayoutRequestsApiArg
      >({
        query: (queryArg) => ({
          url: `/admin/payout-requests`,
          params: {
            status: queryArg.status,
            page: queryArg.page,
          },
        }),
        providesTags: ["Admin Payouts"],
      }),
      approveAdminPayoutRequest: build.mutation<
        ApproveAdminPayoutRequestApiResponse,
        ApproveAdminPayoutRequestApiArg
      >({
        query: (queryArg) => ({
          url: `/admin/payout-requests/${queryArg.requestId}/approve`,
          method: "POST",
        }),
        invalidatesTags: ["Admin Payouts", "Admin"],
      }),
      rejectAdminPayoutRequest: build.mutation<
        RejectAdminPayoutRequestApiResponse,
        RejectAdminPayoutRequestApiArg
      >({
        query: (queryArg) => ({
          url: `/admin/payout-requests/${queryArg.requestId}/reject`,
          method: "POST",
          body: queryArg.body,
        }),
        invalidatesTags: ["Admin Payouts", "Admin"],
      }),
      getAdminAppointments: build.query<
        GetAdminAppointmentsApiResponse,
        GetAdminAppointmentsApiArg
      >({
        query: (queryArg) => ({
          url: `/admin/appointments`,
          params: {
            filter: queryArg.filter,
            from: queryArg["from"],
            to: queryArg.to,
            status: queryArg.status,
            type: queryArg["type"],
            page: queryArg.page,
            limit: queryArg.limit,
          },
        }),
        providesTags: ["Admin"],
      }),
      getAdminDentists: build.query<
        GetAdminDentistsApiResponse,
        GetAdminDentistsApiArg
      >({
        query: (queryArg) => ({
          url: `/admin/dentists`,
          params: {
            status: queryArg.status,
            page: queryArg.page,
          },
        }),
        providesTags: ["Admin"],
      }),
      postAdminDentists: build.mutation<
        PostAdminDentistsApiResponse,
        PostAdminDentistsApiArg
      >({
        query: (queryArg) => ({
          url: `/admin/dentists`,
          method: "POST",
          body: queryArg.adminCreateDentist,
        }),
        invalidatesTags: ["Admin"],
      }),
      getAdminDentistsByDentistId: build.query<
        GetAdminDentistsByDentistIdApiResponse,
        GetAdminDentistsByDentistIdApiArg
      >({
        query: (queryArg) => ({ url: `/admin/dentists/${queryArg.dentistId}` }),
        providesTags: ["Admin"],
      }),
      postAdminDentistsByDentistIdApprove: build.mutation<
        PostAdminDentistsByDentistIdApproveApiResponse,
        PostAdminDentistsByDentistIdApproveApiArg
      >({
        query: (queryArg) => ({
          url: `/admin/dentists/${queryArg.dentistId}/approve`,
          method: "POST",
          body: queryArg.body,
        }),
        invalidatesTags: ["Admin"],
      }),
      postAdminDentistsByDentistIdReject: build.mutation<
        PostAdminDentistsByDentistIdRejectApiResponse,
        PostAdminDentistsByDentistIdRejectApiArg
      >({
        query: (queryArg) => ({
          url: `/admin/dentists/${queryArg.dentistId}/reject`,
          method: "POST",
          body: queryArg.body,
        }),
        invalidatesTags: ["Admin"],
      }),
      postAdminDentistsByDentistIdDisable: build.mutation<
        PostAdminDentistsByDentistIdDisableApiResponse,
        PostAdminDentistsByDentistIdDisableApiArg
      >({
        query: (queryArg) => ({
          url: `/admin/dentists/${queryArg.dentistId}/disable`,
          method: "POST",
        }),
        invalidatesTags: ["Admin"],
      }),
      postAdminDentistsByDentistIdEnable: build.mutation<
        PostAdminDentistsByDentistIdEnableApiResponse,
        PostAdminDentistsByDentistIdEnableApiArg
      >({
        query: (queryArg) => ({
          url: `/admin/dentists/${queryArg.dentistId}/enable`,
          method: "POST",
        }),
        invalidatesTags: ["Admin"],
      }),
      postAdminDentistsByDentistIdReconsider: build.mutation<
        PostAdminDentistsByDentistIdReconsiderApiResponse,
        PostAdminDentistsByDentistIdReconsiderApiArg
      >({
        query: (queryArg) => ({
          url: `/admin/dentists/${queryArg.dentistId}/reconsider`,
          method: "POST",
        }),
        invalidatesTags: ["Admin"],
      }),
      getAdminAuditLog: build.query<
        GetAdminAuditLogApiResponse,
        GetAdminAuditLogApiArg
      >({
        query: (queryArg) => ({
          url: `/admin/audit-log`,
          params: {
            entityType: queryArg.entityType,
            entityId: queryArg.entityId,
            page: queryArg.page,
          },
        }),
        providesTags: ["Admin"],
      }),
      getDentistsMe: build.query<GetDentistsMeApiResponse, GetDentistsMeApiArg>(
        {
          query: () => ({ url: `/dentists/me` }),
          providesTags: ["Dentists"],
        },
      ),
      patchDentistsMe: build.mutation<
        PatchDentistsMeApiResponse,
        PatchDentistsMeApiArg
      >({
        query: (queryArg) => ({
          url: `/dentists/me`,
          method: "PATCH",
          body: queryArg.dentistSelfUpdate,
        }),
        invalidatesTags: ["Dentists"],
      }),
      getDentistsMeTimeOff: build.query<
        GetDentistsMeTimeOffApiResponse,
        GetDentistsMeTimeOffApiArg
      >({
        query: () => ({ url: `/dentists/me/time-off` }),
        providesTags: ["Dentists"],
      }),
      postDentistsMeTimeOff: build.mutation<
        PostDentistsMeTimeOffApiResponse,
        PostDentistsMeTimeOffApiArg
      >({
        query: (queryArg) => ({
          url: `/dentists/me/time-off`,
          method: "POST",
          body: queryArg.body,
        }),
        invalidatesTags: ["Dentists"],
      }),
      postDentistsMeTimeOffPreview: build.mutation<
        PostDentistsMeTimeOffPreviewApiResponse,
        PostDentistsMeTimeOffPreviewApiArg
      >({
        query: (queryArg) => ({
          url: `/dentists/me/time-off/preview`,
          method: "POST",
          body: queryArg.timeOffInput,
        }),
        invalidatesTags: ["Dentists"],
      }),
      deleteDentistsMeTimeOffById: build.mutation<
        DeleteDentistsMeTimeOffByIdApiResponse,
        DeleteDentistsMeTimeOffByIdApiArg
      >({
        query: (queryArg) => ({
          url: `/dentists/me/time-off/${queryArg.id}`,
          method: "DELETE",
        }),
        invalidatesTags: ["Dentists"],
      }),
      getDentistsMeClinics: build.query<
        GetDentistsMeClinicsApiResponse,
        GetDentistsMeClinicsApiArg
      >({
        query: () => ({ url: `/dentists/me/clinics` }),
        providesTags: ["Dentists"],
      }),
      postDentistsMeClinics: build.mutation<
        PostDentistsMeClinicsApiResponse,
        PostDentistsMeClinicsApiArg
      >({
        query: (queryArg) => ({
          url: `/dentists/me/clinics`,
          method: "POST",
          body: queryArg.clinicInput,
        }),
        invalidatesTags: ["Dentists"],
      }),
      patchDentistsMeClinicsByClinicId: build.mutation<
        PatchDentistsMeClinicsByClinicIdApiResponse,
        PatchDentistsMeClinicsByClinicIdApiArg
      >({
        query: (queryArg) => ({
          url: `/dentists/me/clinics/${queryArg.clinicId}`,
          method: "PATCH",
          body: queryArg.clinicInput,
        }),
        invalidatesTags: ["Dentists"],
      }),
      deleteDentistsMeClinicsByClinicId: build.mutation<
        DeleteDentistsMeClinicsByClinicIdApiResponse,
        DeleteDentistsMeClinicsByClinicIdApiArg
      >({
        query: (queryArg) => ({
          url: `/dentists/me/clinics/${queryArg.clinicId}`,
          method: "DELETE",
        }),
        invalidatesTags: ["Dentists"],
      }),
      getDentistsMePayments: build.query<
        GetDentistsMePaymentsApiResponse,
        GetDentistsMePaymentsApiArg
      >({
        query: (queryArg) => ({
          url: `/dentists/me/payments`,
          params: {
            status: queryArg.status,
            source: queryArg.source,
            q: queryArg.q,
            from: queryArg["from"],
            to: queryArg.to,
            page: queryArg.page,
            limit: queryArg.limit,
          },
        }),
        providesTags: ["Appointments"],
      }),
      getDentistsMePaymentsByTransactionId: build.query<
        GetDentistsMePaymentsByTransactionIdApiResponse,
        GetDentistsMePaymentsByTransactionIdApiArg
      >({
        query: (queryArg) => ({
          url: `/dentists/me/payments/${queryArg.transactionId}`,
        }),
        providesTags: ["Appointments"],
      }),
      getDentistsMePatients: build.query<
        GetDentistsMePatientsApiResponse,
        GetDentistsMePatientsApiArg
      >({
        query: () => ({ url: `/dentists/me/patients` }),
        providesTags: ["Dentists"],
      }),
      getDentistsMePatientsByPatientId: build.query<
        GetDentistsMePatientsByPatientIdApiResponse,
        GetDentistsMePatientsByPatientIdApiArg
      >({
        query: (queryArg) => ({
          url: `/dentists/me/patients/${queryArg.patientId}`,
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
      postAppointmentsByAppointmentIdClinicPayment: build.mutation<
        PostAppointmentsByAppointmentIdClinicPaymentApiResponse,
        PostAppointmentsByAppointmentIdClinicPaymentApiArg
      >({
        query: (queryArg) => ({
          url: `/appointments/${queryArg.appointmentId}/clinic-payment`,
          method: "POST",
          body: queryArg.collectClinicPayment,
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
      postAppointmentsByAppointmentIdCheckIn: build.mutation<
        PostAppointmentsByAppointmentIdCheckInApiResponse,
        PostAppointmentsByAppointmentIdCheckInApiArg
      >({
        query: (queryArg) => ({
          url: `/appointments/${queryArg.appointmentId}/check-in`,
          method: "POST",
        }),
        invalidatesTags: ["Appointments"],
      }),
      postAppointmentsByAppointmentIdStart: build.mutation<
        PostAppointmentsByAppointmentIdStartApiResponse,
        PostAppointmentsByAppointmentIdStartApiArg
      >({
        query: (queryArg) => ({
          url: `/appointments/${queryArg.appointmentId}/start`,
          method: "POST",
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
      putAppointmentsByAppointmentIdConsultation: build.mutation<
        PutAppointmentsByAppointmentIdConsultationApiResponse,
        PutAppointmentsByAppointmentIdConsultationApiArg
      >({
        query: (queryArg) => ({
          url: `/appointments/${queryArg.appointmentId}/consultation`,
          method: "PUT",
          body: queryArg.consultationDraft,
        }),
        invalidatesTags: ["Consultations"],
      }),
      postAppointmentsByAppointmentIdConsultationComplete: build.mutation<
        PostAppointmentsByAppointmentIdConsultationCompleteApiResponse,
        PostAppointmentsByAppointmentIdConsultationCompleteApiArg
      >({
        query: (queryArg) => ({
          url: `/appointments/${queryArg.appointmentId}/consultation/complete`,
          method: "POST",
        }),
        invalidatesTags: [
          "Consultations",
          "Appointments",
          "Dentists",
          "Patients",
        ],
      }),
      postAppointmentsByAppointmentIdPrescriptionOtp: build.mutation<
        PostAppointmentsByAppointmentIdPrescriptionOtpApiResponse,
        PostAppointmentsByAppointmentIdPrescriptionOtpApiArg
      >({
        query: (queryArg) => ({
          url: `/appointments/${queryArg.appointmentId}/prescription/otp`,
          method: "POST",
        }),
        invalidatesTags: ["Consultations"],
      }),
      postAppointmentsByAppointmentIdPrescriptionSign: build.mutation<
        PostAppointmentsByAppointmentIdPrescriptionSignApiResponse,
        PostAppointmentsByAppointmentIdPrescriptionSignApiArg
      >({
        query: (queryArg) => ({
          url: `/appointments/${queryArg.appointmentId}/prescription/sign`,
          method: "POST",
          body: queryArg.body,
        }),
        invalidatesTags: ["Consultations"],
      }),
      postPaymentsWebhook: build.mutation<
        PostPaymentsWebhookApiResponse,
        PostPaymentsWebhookApiArg
      >({
        query: (queryArg) => ({
          url: `/payments/webhook`,
          method: "POST",
          body: queryArg.body,
        }),
        invalidatesTags: ["Payments"],
      }),
      getPrivacyRequests: build.query<
        GetPrivacyRequestsApiResponse,
        GetPrivacyRequestsApiArg
      >({
        query: (queryArg) => ({
          url: `/privacy-requests`,
          params: {
            status: queryArg.status,
          },
        }),
        providesTags: ["Privacy"],
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
      postPrivacyRequestsByRequestIdResolve: build.mutation<
        PostPrivacyRequestsByRequestIdResolveApiResponse,
        PostPrivacyRequestsByRequestIdResolveApiArg
      >({
        query: (queryArg) => ({
          url: `/privacy-requests/${queryArg.requestId}/resolve`,
          method: "POST",
        }),
        invalidatesTags: ["Privacy"],
      }),
      getAppointmentsByAppointmentIdVideoChat: build.query<
        GetAppointmentsByAppointmentIdVideoChatApiResponse,
        GetAppointmentsByAppointmentIdVideoChatApiArg
      >({
        query: (queryArg) => ({
          url: `/appointments/${queryArg.appointmentId}/video/chat`,
          params: {
            after: queryArg.after,
            before: queryArg.before,
            limit: queryArg.limit,
          },
        }),
        providesTags: ["Video Chat"],
      }),
      postAppointmentsByAppointmentIdVideoChat: build.mutation<
        PostAppointmentsByAppointmentIdVideoChatApiResponse,
        PostAppointmentsByAppointmentIdVideoChatApiArg
      >({
        query: (queryArg) => ({
          url: `/appointments/${queryArg.appointmentId}/video/chat`,
          method: "POST",
          body: queryArg.body,
        }),
        invalidatesTags: ["Video Chat"],
      }),
      getAppointmentsByAppointmentIdVideoChatAndMessageIdContent: build.query<
        GetAppointmentsByAppointmentIdVideoChatAndMessageIdContentApiResponse,
        GetAppointmentsByAppointmentIdVideoChatAndMessageIdContentApiArg
      >({
        query: (queryArg) => ({
          url: `/appointments/${queryArg.appointmentId}/video/chat/${queryArg.messageId}/content`,
        }),
        providesTags: ["Video Chat"],
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
export type GetPatientFilesByFileIdContentApiResponse = unknown;
export type GetPatientFilesByFileIdContentApiArg = {
  fileId: string;
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
export type GetNotificationsByNotificationIdApiResponse =
  /** status 200 Owned notification, including its destination appointment, withdrawal or application */ Notification;
export type GetNotificationsByNotificationIdApiArg = {
  notificationId: string;
};
export type GetNotificationsPushDeviceApiResponse =
  /** status 200 Availability for the current app environment */ {
    available: boolean;
  };
export type GetNotificationsPushDeviceApiArg = void;
export type PutNotificationsPushDeviceApiResponse =
  /** status 200 Registered device; FCM token is never returned */ {
    id: string;
    platform: "android" | "ios";
    enabled: boolean;
    lastSeenAt: string;
  };
export type PutNotificationsPushDeviceApiArg = {
  body: {
    token: string;
    platform: "android" | "ios";
  };
};
export type DeleteNotificationsPushDeviceApiResponse = unknown;
export type DeleteNotificationsPushDeviceApiArg = void;
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
export type PostAuthAdminLoginApiResponse =
  /** status 200 Logged in */ AuthTokens;
export type PostAuthAdminLoginApiArg = {
  body: {
    email: string;
    password: string;
    /** Stable browser identifier for an independent refresh-token session. Older clients use the legacy admin-web slot. */
    deviceId?: string;
  };
};
export type PostAuthRefreshApiResponse = /** status 200 Rotated */ AuthTokens;
export type PostAuthRefreshApiArg = {
  body: {
    refreshToken: string;
  };
};
export type PostAuthLogoutApiResponse = unknown;
export type PostAuthLogoutApiArg = {
  body: {
    refreshToken: string;
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
export type PostDentistsApplicationsApiResponse =
  /** status 201 Draft saved */ Dentist;
export type PostDentistsApplicationsApiArg = {
  dentistApplication: DentistApplication;
};
export type PatchDentistsApplicationsMeApiResponse =
  /** status 200 Draft updated */ Dentist;
export type PatchDentistsApplicationsMeApiArg = {
  dentistApplication: DentistApplication;
};
export type PostDentistsApplicationsMeSubmitApiResponse =
  /** status 200 Sent to admin; wait for approval before accessing the clinic portal */ Dentist;
export type PostDentistsApplicationsMeSubmitApiArg = void;
export type PostDentistsApplicationsByDentistIdDocumentsApiResponse =
  /** status 201 Stored */ DentistDocument;
export type PostDentistsApplicationsByDentistIdDocumentsApiArg = {
  dentistId: string;
  body: {
    docType: KycDocType;
    file: Blob;
  };
};
export type GetDentistsApplicationsByDentistIdDocumentsAndDocumentIdApiResponse =
  /** status 200 The file */ Blob;
export type GetDentistsApplicationsByDentistIdDocumentsAndDocumentIdApiArg = {
  dentistId: string;
  documentId: string;
};
export type GetAdminMeApiResponse =
  /** status 200 Own profile, including the actual login email; never includes credentials */ AdminProfile;
export type GetAdminMeApiArg = void;
export type PatchAdminMeApiResponse =
  /** status 200 Saved profile */ AdminProfile;
export type PatchAdminMeApiArg = {
  adminProfileUpdate: AdminProfileUpdateWrite;
};
export type GetAdminSettingsApiResponse =
  /** status 200 Saved platform details */ PlatformSettings;
export type GetAdminSettingsApiArg = void;
export type PatchAdminSettingsApiResponse =
  /** status 200 Saved platform details */ PlatformSettings;
export type PatchAdminSettingsApiArg = {
  platformSettingsUpdate: PlatformSettingsUpdate;
};
export type GetAdminPaymentsApiResponse =
  /** status 200 Newest transactions first, 20 per page, with totals from the same database snapshot */ AdminPayments;
export type GetAdminPaymentsApiArg = {
  status?: PaymentStatus;
  method?: PaymentMethod;
  /** Search patient or dentist names, transaction or appointment IDs, and gateway references. */
  q?: string;
  from?: string;
  to?: string;
  page?: number;
};
export type PostAdminPaymentsByTransactionIdRefundRetryApiResponse =
  /** status 202 Saved refund request queued for background processing */ {
    queued: boolean;
  };
export type PostAdminPaymentsByTransactionIdRefundRetryApiArg = {
  transactionId: string;
};
export type GetDentistWalletApiResponse =
  /** status 200 Private wallet data; Cache-Control no-store */ DentistWallet;
export type GetDentistWalletApiArg = void;
export type ListDentistWithdrawalsApiResponse =
  /** status 200 Private wallet data; Cache-Control no-store */ WithdrawalPage;
export type ListDentistWithdrawalsApiArg = {
  page?: number;
  limit?: number;
  status?: WithdrawalStatus;
};
export type RequestDentistWithdrawalApiResponse =
  /** status 200 Private wallet data; Cache-Control no-store */ WithdrawalDetail;
export type RequestDentistWithdrawalApiArg = {
  requestWithdrawal: RequestWithdrawal;
};
export type GetDentistWithdrawalApiResponse =
  /** status 200 Private wallet data; Cache-Control no-store */ WithdrawalDetail;
export type GetDentistWithdrawalApiArg = {
  withdrawalId: string;
};
export type GetWalletSettingsApiResponse =
  /** status 200 Private wallet data; Cache-Control no-store */ WalletSettings;
export type GetWalletSettingsApiArg = void;
export type UpdateWalletSettingsApiResponse =
  /** status 200 Private wallet data; Cache-Control no-store */ WalletSettings;
export type UpdateWalletSettingsApiArg = {
  walletSettingsUpdate: WalletSettingsUpdate;
};
export type ListAdminWithdrawalsApiResponse =
  /** status 200 Private wallet data; Cache-Control no-store */ WithdrawalPage;
export type ListAdminWithdrawalsApiArg = {
  page?: number;
  limit?: number;
  status?: WithdrawalStatus;
  q?: string;
};
export type GetAdminWithdrawalApiResponse =
  /** status 200 Private wallet data; Cache-Control no-store */ WithdrawalDetail;
export type GetAdminWithdrawalApiArg = {
  withdrawalId: string;
};
export type ChangeWithdrawalApiResponse =
  /** status 200 Private wallet data; Cache-Control no-store */ WithdrawalDetail;
export type ChangeWithdrawalApiArg = {
  withdrawalId: string;
  withdrawalAction: WithdrawalAction;
};
export type ListPayoutDentistsApiResponse =
  /** status 200 Private payout ledger data; Cache-Control no-store */ PayoutDentists;
export type ListPayoutDentistsApiArg = {
  page?: number;
  limit?: number;
  q?: string;
};
export type ListEligiblePayoutsApiResponse =
  /** status 200 Private payout ledger data; Cache-Control no-store */ EligiblePayouts;
export type ListEligiblePayoutsApiArg = {
  page?: number;
  limit?: number;
  dentistId: string;
};
export type ListAdminPayoutBatchesApiResponse =
  /** status 200 Private payout ledger data; Cache-Control no-store */ PayoutBatchPage;
export type ListAdminPayoutBatchesApiArg = {
  page?: number;
  limit?: number;
  status?: PayoutBatchStatus;
  dentistId?: string;
};
export type CreatePayoutBatchApiResponse =
  /** status 200 Created batch or identical request replay; no bank transfer is initiated */ PayoutBatchDetail;
export type CreatePayoutBatchApiArg = {
  createPayoutBatch: CreatePayoutBatch;
};
export type GetAdminPayoutBatchApiResponse =
  /** status 200 Private payout ledger data; Cache-Control no-store */ PayoutBatchDetail;
export type GetAdminPayoutBatchApiArg = {
  batchId: string;
};
export type ChangePayoutBatchApiResponse =
  /** status 200 Updated batch or identical request replay */ PayoutBatchDetail;
export type ChangePayoutBatchApiArg = {
  batchId: string;
  changePayoutBatch: ChangePayoutBatch;
};
export type ListDentistPayoutBatchesApiResponse =
  /** status 200 Private payout ledger data; Cache-Control no-store */ PayoutBatchPage;
export type ListDentistPayoutBatchesApiArg = {
  page?: number;
  limit?: number;
  status?: PayoutBatchStatus;
};
export type GetDentistPayoutBatchApiResponse =
  /** status 200 Private payout ledger data; Cache-Control no-store */ PayoutBatchDetail;
export type GetDentistPayoutBatchApiArg = {
  batchId: string;
};
export type GetDentistPayoutDetailsApiResponse =
  /** status 200 Private payout details for the signed-in verified dentist */ PayoutProfile;
export type GetDentistPayoutDetailsApiArg = void;
export type SubmitDentistPayoutRequestApiResponse =
  /** status 201 Request waiting for admin review */ PayoutRequest;
export type SubmitDentistPayoutRequestApiArg = {
  payoutSubmission: PayoutSubmission;
};
export type GetAdminDentistPayoutDetailsApiResponse =
  /** status 200 Private dentist payout details */ PayoutProfile;
export type GetAdminDentistPayoutDetailsApiArg = {
  dentistId: string;
};
export type ListAdminPayoutRequestsApiResponse =
  /** status 200 Twenty requests per page, without bank or tax identifiers */ {
    items: {
      id: string;
      dentistId: string;
      dentistName: string;
      mobile: string;
      status: PayoutRequestStatus;
      submittedAt: string;
      reviewedAt: string | null;
    }[];
    nextPage: number | null;
  };
export type ListAdminPayoutRequestsApiArg = {
  status?: "pending" | "approved" | "rejected";
  page?: number;
};
export type ApproveAdminPayoutRequestApiResponse =
  /** status 200 Approved request */ PayoutRequest;
export type ApproveAdminPayoutRequestApiArg = {
  requestId: string;
};
export type RejectAdminPayoutRequestApiResponse =
  /** status 200 Rejected request with reason visible to the dentist */ PayoutRequest;
export type RejectAdminPayoutRequestApiArg = {
  requestId: string;
  body: {
    reason: string;
  };
};
export type GetAdminAppointmentsApiResponse =
  /** status 200 OK */ AdminAppointmentPage;
export type GetAdminAppointmentsApiArg = {
  filter?: "all" | "today" | "upcoming" | "past";
  from?: string;
  to?: string;
  status?: AppointmentStatus;
  type?: AppointmentType;
  page?: number;
  limit?: number;
};
export type GetAdminDentistsApiResponse = /** status 200 OK */ {
  items?: Dentist[];
  nextPage?: number | null;
};
export type GetAdminDentistsApiArg = {
  status?: DentistStatus;
  page?: number;
};
export type PostAdminDentistsApiResponse = /** status 201 Created */ Dentist;
export type PostAdminDentistsApiArg = {
  adminCreateDentist: AdminCreateDentist;
};
export type GetAdminDentistsByDentistIdApiResponse =
  /** status 200 Dentist details and documents, including the current review status */ Dentist;
export type GetAdminDentistsByDentistIdApiArg = {
  dentistId: string;
};
export type PostAdminDentistsByDentistIdApproveApiResponse =
  /** status 200 Verified — now visible to patients */ Dentist;
export type PostAdminDentistsByDentistIdApproveApiArg = {
  dentistId: string;
  body: {
    force?: boolean;
  };
};
export type PostAdminDentistsByDentistIdRejectApiResponse =
  /** status 200 Rejected */ Dentist;
export type PostAdminDentistsByDentistIdRejectApiArg = {
  dentistId: string;
  body: {
    reason: string;
  };
};
export type PostAdminDentistsByDentistIdDisableApiResponse =
  /** status 200 Disabled */ Dentist;
export type PostAdminDentistsByDentistIdDisableApiArg = {
  dentistId: string;
};
export type PostAdminDentistsByDentistIdEnableApiResponse =
  /** status 200 Enabled */ Dentist;
export type PostAdminDentistsByDentistIdEnableApiArg = {
  dentistId: string;
};
export type PostAdminDentistsByDentistIdReconsiderApiResponse =
  /** status 200 Back in pending_review */ Dentist;
export type PostAdminDentistsByDentistIdReconsiderApiArg = {
  dentistId: string;
};
export type GetAdminAuditLogApiResponse = /** status 200 OK */ {
  items?: AuditLogEntry[];
  nextPage?: number | null;
};
export type GetAdminAuditLogApiArg = {
  entityType?: "dentist" | "patient" | "appointment";
  entityId?: string;
  page?: number;
};
export type GetDentistsMeApiResponse = /** status 200 OK */ Dentist;
export type GetDentistsMeApiArg = void;
export type PatchDentistsMeApiResponse = /** status 200 Updated */ Dentist;
export type PatchDentistsMeApiArg = {
  dentistSelfUpdate: DentistSelfUpdate;
};
export type GetDentistsMeTimeOffApiResponse =
  /** status 200 Upcoming and current periods, ordered by date */ TimeOff[];
export type GetDentistsMeTimeOffApiArg = void;
export type PostDentistsMeTimeOffApiResponse =
  /** status 201 Saved, or the original result on retry */ TimeOff;
export type PostDentistsMeTimeOffApiArg = {
  body: TimeOffInput & {
    /** Reuse on retries to avoid duplicate periods. */
    requestId: string;
  };
};
export type PostDentistsMeTimeOffPreviewApiResponse =
  /** status 200 Total count and the first 20 affected active appointments owned by this dentist */ TimeOffPreview;
export type PostDentistsMeTimeOffPreviewApiArg = {
  timeOffInput: TimeOffInput;
};
export type DeleteDentistsMeTimeOffByIdApiResponse = unknown;
export type DeleteDentistsMeTimeOffByIdApiArg = {
  id: string;
};
export type GetDentistsMeClinicsApiResponse = /** status 200 OK */ Clinic[];
export type GetDentistsMeClinicsApiArg = void;
export type PostDentistsMeClinicsApiResponse = /** status 201 Added */ Clinic;
export type PostDentistsMeClinicsApiArg = {
  clinicInput: ClinicInput;
};
export type PatchDentistsMeClinicsByClinicIdApiResponse =
  /** status 200 Updated */ Clinic;
export type PatchDentistsMeClinicsByClinicIdApiArg = {
  clinicId: string;
  clinicInput: ClinicInput;
};
export type DeleteDentistsMeClinicsByClinicIdApiResponse = unknown;
export type DeleteDentistsMeClinicsByClinicIdApiArg = {
  clinicId: string;
};
export type GetDentistsMePaymentsApiResponse =
  /** status 200 Own payment history and totals for all matching pages */ DentistPayments;
export type GetDentistsMePaymentsApiArg = {
  status?: PaymentStatus;
  source?: "online" | "clinic";
  /** Literal patient name, transaction, appointment, receipt or gateway reference search. */
  q?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
};
export type GetDentistsMePaymentsByTransactionIdApiResponse =
  /** status 200 Payment owned by the signed-in verified dentist */ DentistPayment;
export type GetDentistsMePaymentsByTransactionIdApiArg = {
  transactionId: string;
};
export type GetDentistsMePatientsApiResponse =
  /** status 200 OK */ DentistPatientSummary[];
export type GetDentistsMePatientsApiArg = void;
export type GetDentistsMePatientsByPatientIdApiResponse =
  /** status 200 OK */ DentistPatientRecord;
export type GetDentistsMePatientsByPatientIdApiArg = {
  patientId: string;
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
export type PostAppointmentsByAppointmentIdClinicPaymentApiResponse =
  /** status 200 Updated appointment, or original receipt on an identical retry */ Appointment;
export type PostAppointmentsByAppointmentIdClinicPaymentApiArg = {
  appointmentId: string;
  collectClinicPayment: CollectClinicPayment;
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
export type PostAppointmentsByAppointmentIdCheckInApiResponse =
  /** status 200 OK */ Appointment;
export type PostAppointmentsByAppointmentIdCheckInApiArg = {
  appointmentId: string;
};
export type PostAppointmentsByAppointmentIdStartApiResponse =
  /** status 200 OK */ Appointment;
export type PostAppointmentsByAppointmentIdStartApiArg = {
  appointmentId: string;
};
export type GetAppointmentsByAppointmentIdConsultationApiResponse =
  /** status 200 OK */ Consultation;
export type GetAppointmentsByAppointmentIdConsultationApiArg = {
  appointmentId: string;
};
export type PutAppointmentsByAppointmentIdConsultationApiResponse =
  /** status 200 Saved */ Consultation;
export type PutAppointmentsByAppointmentIdConsultationApiArg = {
  appointmentId: string;
  consultationDraft: ConsultationDraft;
};
export type PostAppointmentsByAppointmentIdConsultationCompleteApiResponse =
  /** status 200 Completed — visit summary, prescription and chart available in patient records */ Appointment;
export type PostAppointmentsByAppointmentIdConsultationCompleteApiArg = {
  appointmentId: string;
};
export type PostAppointmentsByAppointmentIdPrescriptionOtpApiResponse =
  /** status 200 Challenge created */ {
    otpId: string;
    expiresInSeconds: number;
    resendAfterSeconds: number;
  };
export type PostAppointmentsByAppointmentIdPrescriptionOtpApiArg = {
  appointmentId: string;
};
export type PostAppointmentsByAppointmentIdPrescriptionSignApiResponse =
  /** status 200 Signed */ Consultation;
export type PostAppointmentsByAppointmentIdPrescriptionSignApiArg = {
  appointmentId: string;
  body: {
    otpId: string;
    confirmationCode: string;
    /** Required true if any item conflicts with the patient's recorded allergies. */
    allergyOverrideAck?: boolean;
  };
};
export type PostPaymentsWebhookApiResponse = unknown;
export type PostPaymentsWebhookApiArg = {
  body: object;
};
export type GetPrivacyRequestsApiResponse =
  /** status 200 OK */ PrivacyRequest[];
export type GetPrivacyRequestsApiArg = {
  status?: PrivacyRequestStatus;
};
export type PostPrivacyRequestsApiResponse =
  /** status 201 Filed, with an SLA due date set from the statutory response window */ PrivacyRequest;
export type PostPrivacyRequestsApiArg = {
  body: {
    type: PrivacyRequestType;
  };
};
export type PostPrivacyRequestsByRequestIdResolveApiResponse =
  /** status 200 Resolved */ PrivacyRequest;
export type PostPrivacyRequestsByRequestIdResolveApiArg = {
  requestId: string;
};
export type GetAppointmentsByAppointmentIdVideoChatApiResponse =
  /** status 200 Messages in ascending sequence order; newest page by default */ VideoChatPage;
export type GetAppointmentsByAppointmentIdVideoChatApiArg = {
  appointmentId: string;
  after?: string;
  before?: string;
  limit?: number;
};
export type PostAppointmentsByAppointmentIdVideoChatApiResponse =
  /** status 201 Sent or identical previously sent message */ VideoChatMessage;
export type PostAppointmentsByAppointmentIdVideoChatApiArg = {
  appointmentId: string;
  body: {
    /** Reuse for an identical retry */
    requestId: string;
    text?: string;
    /** JPEG/PNG/PDF up to 10 MB */
    file?: Blob;
  };
};
export type GetAppointmentsByAppointmentIdVideoChatAndMessageIdContentApiResponse =
  unknown;
export type GetAppointmentsByAppointmentIdVideoChatAndMessageIdContentApiArg = {
  appointmentId: string;
  messageId: string;
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
export type DentistStatus =
  "draft" | "pending_review" | "verified" | "rejected" | "disabled";
export type KycDocType =
  "degree" | "council" | "id_proof" | "clinic_proof" | "insurance" | "selfie";
export type DentistDocument = {
  id?: string;
  docType?: KycDocType;
  fileUrl?: string;
  uploadedAt?: string;
  verifiedAt?: string | null;
};
export type Dentist = DentistPublic & {
  mobile?: string;
  email?: string;
  status?: DentistStatus;
  submittedBy?: "self" | "admin";
  submittedAt?: string;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  rejectionReason?: string | null;
  resubmissionCount?: number;
  councilRegValidTill?: string | null;
  pan?: string | null;
  bankAccountHolder?: string | null;
  bankAccountNo?: string | null;
  bankIfsc?: string | null;
  gstin?: string | null;
  documents?: DentistDocument[];
};
export type DentistApplication = {
  fullName: string;
  email?: string;
  qualification: string;
  specialization: string;
  councilRegNo: string;
  yearsExperience?: number;
  languages?: string[];
  /** A second location can be added later from Settings, once verified. */
  primaryClinicName: string;
  offersVideo?: boolean;
  feeVideoPaise?: number;
  feeClinicPaise?: number;
  termsConsent: boolean;
  telemedicineConsent: boolean;
};
export type AdminProfile = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  version: number;
  updatedAt: string;
};
export type AdminProfileUpdate = {
  version: number;
  name?: string;
  email?: string;
  /** E.164 number, or an Indian 10-digit mobile. Null or blank clears it. */
  phone?: string | null;
};
export type AdminProfileUpdateWrite = {
  version: number;
  name?: string;
  email?: string;
  /** E.164 number, or an Indian 10-digit mobile. Null or blank clears it. */
  phone?: string | null;
  /** Required only when changing the login email. Never stored in the audit log. */
  currentPassword?: string;
};
export type PlatformSettings = {
  id: string;
  name: string;
  region: string;
  supportEmail: string;
  version: number;
  updatedAt: string;
};
export type PlatformSettingsUpdate = {
  version: number;
  name?: string;
  region?: string;
  supportEmail?: string;
};
export type ClinicCollectionMethod = "cash" | "upi" | "card";
export type ClinicPaymentReceipt = {
  id: string;
  amountPaise: number;
  method: ClinicCollectionMethod;
  /** Server-recorded receipt time. */
  collectedAt: string;
} | null;
export type PaymentMethod = "upi" | "card" | "netbanking" | "pay_at_clinic";
export type PaymentStatus =
  | "pending"
  | "paid"
  | "due_at_clinic"
  | "refund_pending"
  | "refund_failed"
  | "refunded"
  | "cancelled"
  | "failed";
export type AdminPayment = {
  collection?: ClinicPaymentReceipt;
  id: string;
  appointmentId: string;
  patientName: string;
  dentistName: string;
  appointmentDate: string;
  appointmentTime: string;
  amountPaise: number;
  method: PaymentMethod;
  status: PaymentStatus;
  gatewayOrderId: string | null;
  gatewayPaymentId: string | null;
  gatewayRefundId: string | null;
  createdAt: string;
  updatedAt: string;
};
export type AdminPayments = {
  gateway: {
    provider: "razorpay";
    mode: "test" | "live" | "unconfigured";
    checkoutConfigured: boolean;
    webhookConfigured: boolean;
  };
  summary: {
    totalTransactions: number;
    paidAmountPaise: number;
    refundedAmountPaise: number;
    refundPendingAmountPaise: number;
    refundFailedAmountPaise: number;
    pendingAmountPaise: number;
    dueAtClinicAmountPaise: number;
  };
  items: AdminPayment[];
  page: number;
  pageSize: number;
  nextPage: number | null;
};
export type WalletBalance = {
  availablePaise: number;
  shortfallPaise: number;
  reservedPaise: number;
  withdrawnPaise: number;
  pendingPaise: number;
  eligibleGrossPaise: number;
  eligibleFeePaise: number;
  unpricedGrossPaise: number;
  unpricedCount: number;
};
export type WalletSettings = {
  feeBps: number | null;
  minimumWithdrawalPaise: number | null;
  version: number;
  unpricedBookings?: number;
  pricedBookings?: number;
};
export type DentistWallet = WalletBalance &
  WalletSettings & {
    configured: boolean;
    account: {
      approvalId: string;
      last4: string;
      ifsc: string;
    } | null;
  };
export type WithdrawalStatus =
  | "requested"
  | "approved"
  | "processing"
  | "paid"
  | "rejected"
  | "failed"
  | "cancelled";
export type Withdrawal = {
  id: string;
  dentistId: string;
  dentistName: string;
  amountPaise: number;
  minimumPaise: number;
  status: WithdrawalStatus;
  version: number;
  accountLast4: string;
  bankIfsc: string;
  bankReference: string | null;
  paidOn: string | null;
  createdAt: string;
  updatedAt: string;
};
export type WithdrawalPage = {
  total: number;
  nextPage: number | null;
  items: Withdrawal[];
};
export type WithdrawalDetail = Withdrawal & {
  wallet: WalletBalance;
  accountChanged: boolean;
  approvalId: string;
  account: {
    holder: string;
    accountNo: string;
    ifsc: string;
  } | null;
  events: {
    id: string;
    status: WithdrawalStatus;
    note: string | null;
    createdAt: string;
  }[];
};
export type RequestWithdrawal = {
  requestId: string;
  accountApprovalId: string;
  amountPaise: number;
};
export type WalletSettingsUpdate = {
  version: number;
  feeBps: number;
  minimumWithdrawalPaise: number;
  applyToUnpriced?: boolean;
};
export type WithdrawalAction = {
  requestId: string;
  version: number;
  action:
    "approved" | "rejected" | "processing" | "paid" | "failed" | "cancelled";
  note?: string;
  reference?: string;
  paidOn?: string;
  acknowledgeChanges?: boolean;
};
export type PayoutDentists = {
  nextPage: number | null;
  items: {
    id: string;
    name: string;
    eligibleCount: number;
    grossPaise: number;
  }[];
};
export type EligiblePayouts = {
  total: number;
  grossPaise: number;
  nextPage: number | null;
  account: {
    approvalId: string;
    last4: string;
    ifsc: string;
  } | null;
  items: {
    id: string;
    appointmentId: string;
    appointmentDate: string;
    appointmentTime: string;
    patientName: string;
    amountPaise: number;
  }[];
};
export type PayoutBatchStatus =
  "pending" | "processing" | "paid" | "failed" | "cancelled";
export type PayoutBatch = {
  id: string;
  dentistId: string;
  dentistName: string;
  status: PayoutBatchStatus;
  version: number;
  feeBps: number;
  grossPaise: number;
  feePaise: number;
  netPaise: number;
  accountLast4: string;
  bankIfsc: string;
  createdAt: string;
  updatedAt: string;
  bankReference: string | null;
  paidOn: string | null;
  needsAttention: boolean;
};
export type PayoutBatchPage = {
  items: PayoutBatch[];
  total: number;
  reservedPaise: number;
  paidPaise: number;
  nextPage: number | null;
};
export type PayoutBatchDetail = PayoutBatch & {
  account: {
    holder: string;
    accountNo: string;
    ifsc: string;
  } | null;
  items: {
    transactionId: string;
    appointmentId: string;
    patientName: string;
    amountPaise: number;
    feePaise: number;
    paymentStatus: string;
    appointmentStatus: string;
    released: boolean;
  }[];
  events: {
    id: string;
    status: PayoutBatchStatus;
    note: string | null;
    createdAt: string;
  }[];
};
export type CreatePayoutBatch = {
  requestId: string;
  dentistId: string;
  accountApprovalId: string;
  transactionIds: string[];
  /** Explicit percentage in basis points: 1250 means 12.50 percent. Each item rounds half-up to paise. */
  feeBps: number;
};
export type ChangePayoutBatch = {
  requestId: string;
  version: number;
  action: "processing" | "paid" | "failed" | "cancelled";
  reference?: string;
  paidOn?: string;
  note?: string;
  acknowledgeChanges?: boolean;
};
export type PayoutDetails = {
  bankAccountHolder: string | null;
  bankAccountNo: string | null;
  bankIfsc: string | null;
  pan: string | null;
  gstin: string | null;
};
export type PayoutRequestStatus = "pending" | "approved" | "rejected";
export type PayoutRequest = PayoutDetails & {
  id: string;
  dentistId: string;
  status: PayoutRequestStatus;
  submittedAt: string;
  reviewedAt: string | null;
  rejectionReason: string | null;
};
export type PayoutProfile = {
  approved: PayoutDetails | null;
  request: PayoutRequest | null;
};
export type PayoutSubmission = {
  bankAccountHolder: string;
  bankAccountNo: string;
  confirmAccountNo: string;
  bankIfsc: string;
  pan: string;
  gstin?: string | null;
  previousRequestId?: string | null;
};
export type AppointmentType = "video" | "clinic";
export type AppointmentStatus =
  "booked" | "waiting" | "in_consult" | "completed" | "cancelled";
export type AdminAppointment = {
  id?: string;
  patientName?: string;
  dentistName?: string;
  type?: AppointmentType;
  date?: string;
  time?: string;
  concern?: string;
  status?: AppointmentStatus;
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
  } | null;
};
export type AdminAppointmentPage = {
  items: AdminAppointment[];
  total: number;
  page: number;
  limit: number;
  nextPage: number | null;
  summary: {
    notCancelled: number;
    completed: number;
    cancelled: number;
    paidAmountPaise: number;
  };
};
export type AdminCreateDentist = {
  fullName: string;
  mobile: string;
  email?: string;
  qualification?: string;
  specialization?: string;
  councilRegNo?: string;
  primaryClinicName: string;
  offersVideo?: boolean;
  feeVideoPaise?: number;
  feeClinicPaise?: number;
  /** Mark verified immediately on the strength of documents checked outside the app. */
  overrideVerify?: boolean;
  /** Required when overrideVerify is true; written to the audit log. */
  overrideReason?: string;
};
export type AuditLogEntry = {
  id?: string;
  actorLabel?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  detail?: string | null;
  createdAt?: string;
};
export type DentistSelfUpdate = {
  videoWorkingDays?: WorkingDays;
  qualification?: string;
  councilRegNo?: string;
  /** Settable here so an admin-created dentist (created without it) can fill it in before their application is reviewed. */
  specialization?: string;
  languages?: string[];
  email?: string;
  mobile?: string;
  /** Turning this on requires videoHoursFrom/videoHoursTo in the same request if neither is set yet. */
  offersVideo?: boolean;
  feeVideoPaise?: number;
  feeClinicPaise?: number;
  videoHoursFrom?: string;
  videoHoursTo?: string;
};
export type TimeOff = {
  id: string;
  startDate: string;
  endDate: string;
  allDay: boolean;
  fromTime: string | null;
  toTime: string | null;
  reason: string | null;
};
export type TimeOffInput = {
  startDate: string;
  /** Inclusive */
  endDate: string;
  allDay: boolean;
  /** HH:MM, required when allDay is false. */
  fromTime?: string;
  /** HH:MM, required when allDay is false; after fromTime. */
  toTime?: string;
  /** Private to the dentist. */
  reason?: string;
};
export type TimeOffPreview = {
  total: number;
  appointments: {
    id: string;
    patientName: string;
    date: string;
    time: string;
    type: "clinic" | "video";
    clinicName?: string | null;
  }[];
};
export type ClinicInput = {
  workingDays?: WorkingDays;
  name: string;
  addressLine?: string;
  pincode?: string;
  phone?: string;
  hoursFrom: string;
  hoursTo: string;
};
export type DentistPaymentSummary = {
  totalTransactions: number;
  onlinePaidAmountPaise: number;
  clinicCollectedAmountPaise: number;
  dueAtClinicAmountPaise: number;
  pendingOnlineAmountPaise: number;
  refundPendingAmountPaise: number;
  refundFailedAmountPaise: number;
  refundedAmountPaise: number;
};
export type DentistPayment = {
  id: string;
  appointmentId: string;
  patientName: string;
  appointmentDate: string;
  appointmentTime: string;
  appointmentType: AppointmentType;
  appointmentStatus: AppointmentStatus;
  clinicName: string | null;
  amountPaise: number;
  source: "online" | "clinic";
  method: PaymentMethod;
  status: PaymentStatus;
  collection: ClinicPaymentReceipt;
  gatewayOrderId: string | null;
  gatewayPaymentId: string | null;
  gatewayRefundId: string | null;
  createdAt: string;
  updatedAt: string;
};
export type DentistPayments = {
  summary: DentistPaymentSummary;
  items: DentistPayment[];
  page: number;
  limit: number;
  nextPage: number | null;
};
export type DentistPatientSummary = {
  id?: string;
  fullName?: string;
  age?: number | null;
  gender?: string | null;
  mobile?: string;
  /** Null until a completed visit with this dentist exists. */
  lastVisitDate?: string | null;
  /** Completed visits with this dentist only. */
  visitCount?: number;
  /** Allergy information is on file. Read the patient record for the recorded details. */
  hasAllergies?: boolean;
};
export type DentistPatientRecord = {
  id?: string;
  fullName?: string;
  mobile?: string;
  dateOfBirth?: string;
  age?: number | null;
  gender?: string | null;
  city?: string | null;
  preferredLanguage?: string;
  allergies?: string | null;
  hasAllergies?: boolean;
  conditions?: string | null;
  medications?: string | null;
  emergencyContact?: string | null;
  guardian?: {
    name?: string;
    relationship?: string;
    mobile?: string;
  } | null;
  chart?: ChartEntry[];
  appointments?: {
    id?: string;
    date?: string;
    time?: string;
    type?: "video" | "clinic";
    clinicName?: string | null;
    concern?: string;
    diagnosis?: string | null;
    status?: AppointmentStatus;
  }[];
};
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
export type CollectClinicPayment = {
  /** Reuse for identical retries. */
  requestId: string;
  /** Must equal the full booked consultation fee. */
  amountPaise: number;
  method: ClinicCollectionMethod;
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
export type ConsultationDraft = {
  chiefComplaint?: string;
  findings?: string;
  diagnosis?: string;
  treatmentDone?: string;
  plan?: string;
  planItems?: TreatmentPlanItem[];
  /** Calendar date (YYYY-MM-DD). Omit to preserve the saved date; send null to clear it. */
  followUpDate?: string | null;
  chart?: {
    toothNumber?: string;
    status?: ToothStatus;
  }[];
  prescriptionItems?: PrescriptionItemInput[];
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
export type VideoChatAttachment = {
  id: string;
  name: string;
  mimeType: "image/jpeg" | "image/png" | "application/pdf";
  sizeBytes: number;
};
export type VideoChatMessage = {
  id: string;
  sequence: string;
  requestId: string;
  text: string;
  senderRole: "patient" | "dentist";
  own: boolean;
  createdAt: string;
  attachment: VideoChatAttachment | null;
};
export type VideoChatPage = {
  items: VideoChatMessage[];
  hasMore: boolean;
};
export const {
  useGetAppointmentsByAppointmentIdPrescriptionPdfQuery,
  useGetAppointmentsByAppointmentIdVisitSummaryPdfQuery,
  usePostPatientsMeFilesMutation,
  useGetPatientsMeFilesQuery,
  useDeletePatientsMeFilesByFileIdMutation,
  useGetAppointmentsByAppointmentIdAttachmentsQuery,
  useGetPatientFilesByFileIdContentQuery,
  useGetAppointmentsByAppointmentIdVideoQuery,
  usePostAppointmentsByAppointmentIdVideoTokenMutation,
  useGetNotificationsQuery,
  useGetNotificationsByNotificationIdQuery,
  useGetNotificationsPushDeviceQuery,
  usePutNotificationsPushDeviceMutation,
  useDeleteNotificationsPushDeviceMutation,
  usePatchNotificationsByNotificationIdReadMutation,
  usePostNotificationsReadAllMutation,
  usePostAuthOtpRequestMutation,
  usePostAuthOtpVerifyMutation,
  usePostAuthAdminLoginMutation,
  usePostAuthRefreshMutation,
  usePostAuthLogoutMutation,
  usePostPatientsRegisterMutation,
  useGetPatientsMeQuery,
  usePatchPatientsMeMutation,
  useGetPatientsMeChartQuery,
  useGetDentistsQuery,
  useGetDentistsByDentistIdQuery,
  useGetDentistsByDentistIdSlotsQuery,
  usePostDentistsApplicationsMutation,
  usePatchDentistsApplicationsMeMutation,
  usePostDentistsApplicationsMeSubmitMutation,
  usePostDentistsApplicationsByDentistIdDocumentsMutation,
  useGetDentistsApplicationsByDentistIdDocumentsAndDocumentIdQuery,
  useGetAdminMeQuery,
  usePatchAdminMeMutation,
  useGetAdminSettingsQuery,
  usePatchAdminSettingsMutation,
  useGetAdminPaymentsQuery,
  usePostAdminPaymentsByTransactionIdRefundRetryMutation,
  useGetDentistWalletQuery,
  useListDentistWithdrawalsQuery,
  useRequestDentistWithdrawalMutation,
  useGetDentistWithdrawalQuery,
  useGetWalletSettingsQuery,
  useUpdateWalletSettingsMutation,
  useListAdminWithdrawalsQuery,
  useGetAdminWithdrawalQuery,
  useChangeWithdrawalMutation,
  useListPayoutDentistsQuery,
  useListEligiblePayoutsQuery,
  useListAdminPayoutBatchesQuery,
  useCreatePayoutBatchMutation,
  useGetAdminPayoutBatchQuery,
  useChangePayoutBatchMutation,
  useListDentistPayoutBatchesQuery,
  useGetDentistPayoutBatchQuery,
  useGetDentistPayoutDetailsQuery,
  useSubmitDentistPayoutRequestMutation,
  useGetAdminDentistPayoutDetailsQuery,
  useListAdminPayoutRequestsQuery,
  useApproveAdminPayoutRequestMutation,
  useRejectAdminPayoutRequestMutation,
  useGetAdminAppointmentsQuery,
  useGetAdminDentistsQuery,
  usePostAdminDentistsMutation,
  useGetAdminDentistsByDentistIdQuery,
  usePostAdminDentistsByDentistIdApproveMutation,
  usePostAdminDentistsByDentistIdRejectMutation,
  usePostAdminDentistsByDentistIdDisableMutation,
  usePostAdminDentistsByDentistIdEnableMutation,
  usePostAdminDentistsByDentistIdReconsiderMutation,
  useGetAdminAuditLogQuery,
  useGetDentistsMeQuery,
  usePatchDentistsMeMutation,
  useGetDentistsMeTimeOffQuery,
  usePostDentistsMeTimeOffMutation,
  usePostDentistsMeTimeOffPreviewMutation,
  useDeleteDentistsMeTimeOffByIdMutation,
  useGetDentistsMeClinicsQuery,
  usePostDentistsMeClinicsMutation,
  usePatchDentistsMeClinicsByClinicIdMutation,
  useDeleteDentistsMeClinicsByClinicIdMutation,
  useGetDentistsMePaymentsQuery,
  useGetDentistsMePaymentsByTransactionIdQuery,
  useGetDentistsMePatientsQuery,
  useGetDentistsMePatientsByPatientIdQuery,
  useGetAppointmentsQuery,
  usePostAppointmentsMutation,
  useGetAppointmentsByAppointmentIdQuery,
  usePostAppointmentsByAppointmentIdCancelMutation,
  usePostAppointmentsByAppointmentIdClinicPaymentMutation,
  usePostAppointmentsByAppointmentIdRescheduleMutation,
  usePostAppointmentsByAppointmentIdCheckInMutation,
  usePostAppointmentsByAppointmentIdStartMutation,
  useGetAppointmentsByAppointmentIdConsultationQuery,
  usePutAppointmentsByAppointmentIdConsultationMutation,
  usePostAppointmentsByAppointmentIdConsultationCompleteMutation,
  usePostAppointmentsByAppointmentIdPrescriptionOtpMutation,
  usePostAppointmentsByAppointmentIdPrescriptionSignMutation,
  usePostPaymentsWebhookMutation,
  useGetPrivacyRequestsQuery,
  usePostPrivacyRequestsMutation,
  usePostPrivacyRequestsByRequestIdResolveMutation,
  useGetAppointmentsByAppointmentIdVideoChatQuery,
  usePostAppointmentsByAppointmentIdVideoChatMutation,
  useGetAppointmentsByAppointmentIdVideoChatAndMessageIdContentQuery,
} = injectedRtkApi;
