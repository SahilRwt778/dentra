import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import {
  useGetAdminPaymentsQuery,
  usePostAdminPaymentsByTransactionIdRefundRetryMutation,
  type PaymentMethod,
  type PaymentStatus,
} from '@/api/generated-api';
import { toast } from 'sonner';
import { PageHead } from '@/components/page-head';

const STATUSES: Record<PaymentStatus, { label: string; color: string }> = {
  paid: { label: 'Paid', color: 'green' },
  pending: { label: 'Pending', color: 'amber' },
  due_at_clinic: { label: 'Due at clinic', color: 'amber' },
  refund_pending: { label: 'Refund processing', color: 'amber' },
  refund_failed: { label: 'Refund needs attention', color: 'red' },
  refunded: { label: 'Refunded', color: 'blue' },
  cancelled: { label: 'Cancelled', color: '' },
  failed: { label: 'Failed', color: 'red' },
};
const METHODS: Record<PaymentMethod, string> = {
  upi: 'UPI',
  card: 'Card',
  netbanking: 'Netbanking',
  pay_at_clinic: 'Pay at clinic',
};
const CLINIC_METHODS = { cash: 'Cash', upi: 'UPI', card: 'Card' };
const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });
const timestamp = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'Asia/Kolkata',
});
function displayError(error: unknown) {
  const message = (error as { data?: { message?: string | string[] } })?.data?.message;
  return Array.isArray(message)
    ? message.join('. ')
    : message ?? 'Could not load payments. Please try again.';
}

export function PaymentsPage() {
  const [status, setStatus] = useState<PaymentStatus | ''>('');
  const [method, setMethod] = useState<PaymentMethod | ''>('');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [retryRefund, { isLoading: retrying }] = usePostAdminPaymentsByTransactionIdRefundRetryMutation();
  async function recheckRefund(transactionId: string) {
    try {
      await retryRefund({ transactionId }).unwrap();
      toast.success('Refund queued for recheck.');
    } catch (err) {
      toast.error(displayError(err));
    }
  }
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);
  const {
    currentData: data,
    error,
    isFetching,
    refetch,
  } = useGetAdminPaymentsQuery(
    {
      status: status || undefined,
      method: method || undefined,
      q: query || undefined,
      from: from || undefined,
      to: to || undefined,
      page,
    },
    { pollingInterval: 15000, refetchOnMountOrArgChange: true }
  );
  const hasFilters = !!(status || method || query || from || to);
  const totalPages = Math.max(1, Math.ceil((data?.summary.totalTransactions ?? 0) / (data?.pageSize ?? 20)));

  function clearFilters() {
    setStatus('');
    setMethod('');
    setSearch('');
    setQuery('');
    setFrom('');
    setTo('');
    setPage(1);
  }

  return (
    <>
      <PageHead
        title="Payments"
        subtitle="Patient payments, refunds and amounts due at clinics."
        actions={
          <button
            type="button"
            className="btn"
            disabled={isFetching}
            onClick={() => {
              void refetch();
            }}
          >
            <RefreshCw size={16} />
            {isFetching ? 'Refreshing…' : 'Refresh'}
          </button>
        }
      />

      {data && (
        <div className="card payment-gateway-status">
          <div className="row wrap">
            <span
              className={`badge ${
                data.gateway.checkoutConfigured ? (data.gateway.mode === 'live' ? 'green' : 'teal') : 'amber'
              }`}
            >
              {data.gateway.checkoutConfigured
                ? `Razorpay · ${data.gateway.mode === 'live' ? 'Live' : 'Test'} mode`
                : 'Razorpay configuration incomplete'}
            </span>
            <span className={`badge ${data.gateway.webhookConfigured ? 'green' : 'amber'}`}>
              {data.gateway.webhookConfigured ? 'Webhook configured' : 'Webhook configuration required'}
            </span>
          </div>
          <p className="small muted">
            {data.gateway.mode === 'test'
              ? 'Test mode is active. Test checkout does not charge real money.'
              : data.gateway.mode === 'live'
              ? 'Live checkout is configured.'
              : 'Complete the payment gateway setup to enable online checkout.'}
          </p>
        </div>
      )}

      <div className="card payment-filters">
        <label className="field payment-search">
          <span>Search payments</span>
          <input
            className="input"
            placeholder="Patient, dentist or transaction reference"
            value={search}
            maxLength={100}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <label className="field">
          <span>Status</span>
          <select
            className="input"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as PaymentStatus | '');
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            {Object.entries(STATUSES).map(([value, item]) => (
              <option key={value} value={value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Method</span>
          <select
            className="input"
            value={method}
            onChange={(event) => {
              setMethod(event.target.value as PaymentMethod | '');
              setPage(1);
            }}
          >
            <option value="">All methods</option>
            {Object.entries(METHODS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Transaction date from</span>
          <input
            className="input"
            type="date"
            value={from}
            max={to || undefined}
            onChange={(event) => {
              setFrom(event.target.value);
              setPage(1);
            }}
          />
        </label>
        <label className="field">
          <span>Transaction date to</span>
          <input
            className="input"
            type="date"
            value={to}
            min={from || undefined}
            onChange={(event) => {
              setTo(event.target.value);
              setPage(1);
            }}
          />
        </label>
        {hasFilters && (
          <button type="button" className="btn" onClick={clearFilters}>
            Clear filters
          </button>
        )}
      </div>

      {error ? (
        <div className="card stack" role="alert">
          <h2>Unable to load payments</h2>
          <p>{displayError(error)}</p>
          <button
            type="button"
            className="btn"
            onClick={() => {
              void refetch();
            }}
          >
            Try again
          </button>
        </div>
      ) : !data ? (
        <p className="muted" role="status">
          Loading payments…
        </p>
      ) : (
        <>
          <div className="stats payment-stats">
            {[
              ['Paid', currency.format(data.summary.paidAmountPaise / 100)],
              ['Refunded', currency.format(data.summary.refundedAmountPaise / 100)],
              ['Refund processing', currency.format(data.summary.refundPendingAmountPaise / 100)],
              ['Refund needs attention', currency.format(data.summary.refundFailedAmountPaise / 100)],
              ['Pending online', currency.format(data.summary.pendingAmountPaise / 100)],
              ['Due at clinic', currency.format(data.summary.dueAtClinicAmountPaise / 100)],
              ['Transactions', data.summary.totalTransactions.toLocaleString('en-IN')],
            ].map(([label, value]) => (
              <div className="stat" key={label}>
                <b>{value}</b>
                <span>{label}</span>
              </div>
            ))}
          </div>
          <p className="small muted" style={{ marginBottom: 12 }}>
            Totals cover all transactions matching these filters. Dates and times are shown in IST.
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Transaction date</th>
                  <th>Transaction / gateway reference</th>
                  <th>Patient</th>
                  <th>Dentist</th>
                  <th>Appointment</th>
                  <th>Method</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((payment) => (
                  <tr key={payment.id}>
                    <td className="small">{timestamp.format(new Date(payment.createdAt))}</td>
                    <td className="payment-reference">
                      <span title={payment.id}>{payment.id}</span>
                      {(payment.gatewayPaymentId || payment.gatewayOrderId) && (
                        <span className="small muted">
                          {payment.gatewayPaymentId ?? payment.gatewayOrderId}
                        </span>
                      )}
                      {payment.gatewayRefundId && (
                        <span className="small muted">Refund: {payment.gatewayRefundId}</span>
                      )}
                    </td>
                    <td>{payment.patientName}</td>
                    <td>{payment.dentistName}</td>
                    <td className="small">
                      {new Date(
                        `${payment.appointmentDate}T${payment.appointmentTime}:00+05:30`
                      ).toLocaleString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                        timeZone: 'Asia/Kolkata',
                      })}
                    </td>
                    <td>{payment.collection ? `At clinic · ${CLINIC_METHODS[payment.collection.method]}` : METHODS[payment.method]}
                      {payment.collection && <div className="tiny muted">Collected {timestamp.format(new Date(payment.collection.collectedAt))}</div>}
                    </td>
                    <td>
                      <span className={`badge ${STATUSES[payment.status].color}`}>
                        {STATUSES[payment.status].label}
                      </span>
                      {payment.status === 'refund_failed' && (
                        <button
                          type="button"
                          className="btn small"
                          style={{ marginTop: 8 }}
                          disabled={retrying}
                          onClick={() => {
                            void recheckRefund(payment.id);
                          }}
                        >
                          Recheck refund
                        </button>
                      )}
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {currency.format(payment.amountPaise / 100)}
                    </td>
                  </tr>
                ))}
                {!data.items.length && (
                  <tr>
                    <td colSpan={8} className="empty">
                      <h3>{hasFilters ? 'No payments match these filters' : 'No payments yet'}</h3>
                      <p>
                        {hasFilters
                          ? 'Try another date, status or search.'
                          : 'Patient bookings will appear here with their payment status.'}
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="row between payment-pagination">
            <span className="small muted">
              Page {page} of {totalPages} · {data.summary.totalTransactions} transactions
            </span>
            <div className="row">
              <button
                type="button"
                className="btn"
                disabled={page === 1 || isFetching}
                onClick={() => setPage((value) => value - 1)}
              >
                Previous
              </button>
              <button
                type="button"
                className="btn"
                disabled={!data.nextPage || isFetching}
                onClick={() => setPage(data.nextPage!)}
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
