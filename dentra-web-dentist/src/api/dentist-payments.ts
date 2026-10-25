import { dentraApi } from "./generated-api";

// Reports and receipts contain patient data; remove them when their views close.
const paymentsApi = dentraApi.enhanceEndpoints({
  endpoints: {
    getDentistsMePayments: { keepUnusedDataFor: 0 },
    getDentistsMePaymentsByTransactionId: { keepUnusedDataFor: 0 },
  },
});

export const {
  useGetDentistsMePaymentsQuery,
  useGetDentistsMePaymentsByTransactionIdQuery,
} = paymentsApi;
