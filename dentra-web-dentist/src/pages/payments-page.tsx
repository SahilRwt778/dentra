import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { useGetDentistsMePaymentsQuery } from "@/api/dentist-payments";
import { PageHead } from "@/components/page-head";
import { PaymentSummary } from "@/components/payments/payment-summary";
import { PaymentFiltersForm } from "@/components/payments/payment-filters";
import {
  EMPTY_PAYMENT_FILTERS,
  type PaymentFilters,
} from "@/lib/payment-filters";
import { PaymentTable } from "@/components/payments/payment-table";
import { PaymentDetailDialog } from "@/components/payments/payment-detail-dialog";
import { apiErrorMessage } from "@/lib/api-error";

export function PaymentsPage() {
  const [draft, setDraft] = useState(EMPTY_PAYMENT_FILTERS);
  const [filters, setFilters] = useState(EMPTY_PAYMENT_FILTERS);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [filterError, setFilterError] = useState<string | null>(null);
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const result = useGetDentistsMePaymentsQuery(
    {
      page,
      limit,
      q: filters.q || undefined,
      source: filters.source || undefined,
      status: filters.status || undefined,
      from: filters.from || undefined,
      to: filters.to || undefined,
    },
    {
      refetchOnMountOrArgChange: true,
      refetchOnFocus: true,
      refetchOnReconnect: true,
      pollingInterval: 15000,
      skipPollingIfUnfocused: true,
    }
  );
  function change(changes: Partial<PaymentFilters>) {
    setDraft((current) => ({ ...current, ...changes }));
    setFilterError(null);
  }
  function apply() {
    if (draft.from && draft.to && draft.from > draft.to) {
      setFilterError("The start date must be on or before the end date.");
      return;
    }
    setFilters({ ...draft, q: draft.q.trim() });
    setPage(1);
    setFilterError(null);
  }
  function clear() {
    setDraft(EMPTY_PAYMENT_FILTERS);
    setFilters(EMPTY_PAYMENT_FILTERS);
    setPage(1);
    setFilterError(null);
  }
  const data = result.currentData;
  return (
    <>
      <PageHead
        title="Payments"
        subtitle="Collections, outstanding fees and refunds for your appointments."
        actions={
          <button
            type="button"
            className="btn"
            disabled={result.isFetching}
            onClick={() => void result.refetch()}
          >
            <RefreshCw size={16} />
            {result.isFetching ? "Refreshing…" : "Refresh"}
          </button>
        }
      />
      <div className="stack">
        <PaymentFiltersForm
          value={draft}
          onChange={change}
          onApply={apply}
          onClear={clear}
          error={filterError}
        />
        {result.error ? (
          <div className="card stack" role="alert">
            <h3>Could not load payments</h3>
            <p>{apiErrorMessage(result.error, "Please try again.")}</p>
            <button
              type="button"
              className="btn"
              onClick={() => void result.refetch()}
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
            <PaymentSummary summary={data.summary} />
            <div className="row between wrap">
              <h2>Payment history</h2>
              <label className="row small dentist-payment-page-size">
                Rows per page{" "}
                <select
                  className="input"
                  aria-label="Rows per page"
                  value={limit}
                  onChange={(event) => {
                    setLimit(Number(event.target.value));
                    setPage(1);
                  }}
                >
                  {[20, 50, 100].map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {data.items.length ? (
              <PaymentTable payments={data.items} onOpen={setReceiptId} />
            ) : (
              <div className="card empty">
                <h3>
                  {data.summary.totalTransactions
                    ? "No payments on this page"
                    : "No matching payments"}
                </h3>
                <p>Try another date, status or source.</p>
              </div>
            )}
            <div className="row between wrap">
              <span className="small muted">
                Page {page} · {data.summary.totalTransactions} transactions ·
                Latest first · IST
              </span>
              <nav className="row" aria-label="Payment pages">
                <button
                  className="btn"
                  type="button"
                  disabled={page === 1 || result.isFetching}
                  onClick={() => setPage((current) => current - 1)}
                >
                  Previous page
                </button>
                <button
                  className="btn"
                  type="button"
                  disabled={!data.nextPage || result.isFetching}
                  onClick={() => setPage(data.nextPage!)}
                >
                  Next page
                </button>
              </nav>
            </div>
          </>
        )}
      </div>
      {receiptId && (
        <PaymentDetailDialog
          key={receiptId}
          id={receiptId}
          onClose={() => setReceiptId(null)}
        />
      )}
    </>
  );
}
