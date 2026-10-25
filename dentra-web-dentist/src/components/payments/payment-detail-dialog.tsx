import { Link } from "react-router-dom";
import { X } from "lucide-react";
import { useGetDentistsMePaymentsByTransactionIdQuery } from "@/api/dentist-payments";
import { Modal } from "@/components/modal";
import { apiErrorMessage } from "@/lib/api-error";
import { formatDate, formatTime, rupees } from "@/lib/date";
import { collectedTime } from "@/lib/clinic-payment";
import { reportPaymentMethod, PAYMENT_STATUSES } from "@/lib/payment-report";

export function PaymentDetailDialog({
  id,
  onClose,
}: {
  id: string;
  onClose: () => void;
}) {
  const {
    currentData: payment,
    error,
    refetch,
  } = useGetDentistsMePaymentsByTransactionIdQuery(
    { transactionId: id },
    {
      refetchOnMountOrArgChange: true,
      refetchOnFocus: true,
      refetchOnReconnect: true,
      pollingInterval: 15000,
      skipPollingIfUnfocused: true,
    }
  );
  return (
    <Modal open onClose={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="payment-detail-title"
        className="stack"
      >
        <header className="row between">
          <h2 id="payment-detail-title">Payment details</h2>
          <button
            className="btn"
            type="button"
            aria-label="Close payment details"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </header>
        {error ? (
          <div role="alert" className="stack">
            <p>{apiErrorMessage(error, "Could not load this payment.")}</p>
            <button
              className="btn"
              type="button"
              onClick={() => void refetch()}
            >
              Try again
            </button>
          </div>
        ) : !payment ? (
          <p role="status">Loading payment…</p>
        ) : (
          <>
            <div>
              <h3>{payment.patientName}</h3>
              <p className="dentist-payment-detail-amount">
                {rupees(payment.amountPaise)}
              </p>
              <span
                className={`badge ${PAYMENT_STATUSES[payment.status].color}`}
              >
                {PAYMENT_STATUSES[payment.status].label}
              </span>
            </div>
            <dl className="kv dentist-payment-references">
              <dt>Method</dt>
              <dd>{reportPaymentMethod(payment)}</dd>
              <dt>Transaction date</dt>
              <dd>{collectedTime(payment.createdAt)} IST</dd>
              <dt>Transaction</dt>
              <dd>{payment.id}</dd>
              {payment.collection && (
                <>
                  <dt>Collected</dt>
                  <dd>{collectedTime(payment.collection.collectedAt)} IST</dd>
                  <dt>Receipt</dt>
                  <dd>{payment.collection.id}</dd>
                </>
              )}
              {payment.gatewayOrderId && (
                <>
                  <dt>Gateway order</dt>
                  <dd>{payment.gatewayOrderId}</dd>
                </>
              )}
              {payment.gatewayPaymentId && (
                <>
                  <dt>Gateway payment</dt>
                  <dd>{payment.gatewayPaymentId}</dd>
                </>
              )}
              {payment.gatewayRefundId && (
                <>
                  <dt>Gateway refund</dt>
                  <dd>{payment.gatewayRefundId}</dd>
                </>
              )}
              <dt>Appointment</dt>
              <dd>
                {formatDate(payment.appointmentDate)} ·{" "}
                {formatTime(payment.appointmentTime)}
              </dd>
              <dt>Visit</dt>
              <dd>
                {payment.appointmentType === "video"
                  ? "Video consultation"
                  : payment.clinicName ?? "In-clinic visit"}
              </dd>
              <dt>Visit status</dt>
              <dd>{payment.appointmentStatus.replace(/_/g, " ")}</dd>
            </dl>
            {payment.source === "clinic" &&
              payment.appointmentStatus === "cancelled" &&
              payment.status === "paid" && (
                <p className="hint">
                  This payment was received at the clinic. Any refund is
                  arranged directly with the clinic.
                </p>
              )}
            <p className="hint">
              This view records payment status. It does not confirm a bank
              payout.
            </p>
            <Link
              className="btn btn-primary"
              to={`/consult/${payment.appointmentId}`}
            >
              Open appointment
            </Link>
          </>
        )}
      </section>
    </Modal>
  );
}
