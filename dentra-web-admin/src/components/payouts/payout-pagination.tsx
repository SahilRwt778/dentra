export function PayoutPagination({
  page,
  nextPage,
  busy,
  change,
}: {
  page: number;
  nextPage: number | null;
  busy: boolean;
  change: (page: number) => void;
}) {
  return (
    <nav className="row wrap payout-pagination" aria-label="Payout pages">
      <button
        className="btn"
        disabled={page === 1 || busy}
        onClick={() => change(page - 1)}
      >
        Previous page
      </button>
      <span>Page {page}</span>
      <button
        className="btn"
        disabled={!nextPage || busy}
        onClick={() => change(nextPage!)}
      >
        Next page
      </button>
    </nav>
  );
}
