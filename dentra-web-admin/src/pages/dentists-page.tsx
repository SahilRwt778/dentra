import { useState, type MouseEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  useGetAdminDentistsQuery,
  usePostAdminDentistsByDentistIdDisableMutation,
  usePostAdminDentistsByDentistIdEnableMutation,
  usePostAdminDentistsByDentistIdReconsiderMutation,
  type Dentist,
} from '@/api/generated-api';
import { PageHead } from '@/components/page-head';
import { CreateDentistDialog } from '@/components/create-dentist-dialog';

function errorMessage(err: unknown, fallback: string): string {
  return (
    (err as { data?: { message?: string } } | undefined)?.data?.message ??
    fallback
  );
}

export function DentistsPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);

  const {
    currentData: data,
    error,
    isLoading,
    isFetching,
    refetch,
  } = useGetAdminDentistsQuery({ page }, { refetchOnMountOrArgChange: true });

  const [disable, { isLoading: isDisabling }] =
    usePostAdminDentistsByDentistIdDisableMutation();
  const [enable, { isLoading: isEnabling }] =
    usePostAdminDentistsByDentistIdEnableMutation();
  const [reconsider, { isLoading: isReconsidering }] =
    usePostAdminDentistsByDentistIdReconsiderMutation();

  function openDentist(
    event: MouseEvent<HTMLTableRowElement>,
    dentist: Dentist,
  ) {
    // Links handle keyboard navigation; action buttons keep their own behavior.
    if (!dentist.id || (event.target as HTMLElement).closest('a, button'))
      return;
    navigate(`/dentists/${dentist.id}`);
  }

  async function handleDisable(dentist: Dentist) {
    if (
      !window.confirm(
        `Disable ${dentist.fullName}? Patients will no longer be able to book them.`,
      )
    )
      return;
    try {
      const result = await disable({ dentistId: dentist.id! }).unwrap();
      toast.success(
        `${result.fullName} disabled. Hidden from the patient app.`,
      );
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to disable.'));
    }
  }

  async function handleEnable(dentist: Dentist) {
    try {
      const result = await enable({ dentistId: dentist.id! }).unwrap();
      toast.success(
        `${result.fullName} enabled. Visible in the patient app again.`,
      );
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to enable.'));
    }
  }

  async function handleReconsider(dentist: Dentist) {
    try {
      const result = await reconsider({ dentistId: dentist.id! }).unwrap();
      toast.success(`${result.fullName} moved back to review.`);
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to move back to review.'));
    }
  }

  const items = data?.items ?? [];
  const verified = items.filter((d) => d.status === 'verified');
  const offboarded = items.filter(
    (d) => d.status === 'disabled' || d.status === 'rejected',
  );

  return (
    <>
      <PageHead
        title="Dentists"
        subtitle="Only verified dentists appear in the patient app."
        actions={<CreateDentistDialog />}
      />

      {error ? (
        <div className="card stack" role="alert">
          <h2>Could not load dentists</h2>
          <p>Please try again.</p>
          <button
            type="button"
            className="btn"
            disabled={isFetching}
            onClick={() => void refetch()}
          >
            Try again
          </button>
        </div>
      ) : isLoading || !data ? (
        <p className="muted">Loading…</p>
      ) : (
        <>
          <h2 style={{ marginBottom: 12 }}>Verified dentists</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Dentist</th>
                  <th>Mobile number</th>
                  <th>Specialty</th>
                  <th>Clinic</th>
                  <th>Registration</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {verified.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="muted"
                      style={{ textAlign: 'center' }}
                    >
                      No verified dentists.
                    </td>
                  </tr>
                )}
                {verified.map((dentist) => (
                  <tr
                    key={dentist.id}
                    className="dentist-row"
                    onClick={(event) => openDentist(event, dentist)}
                  >
                    <td>
                      <Link
                        className="dentist-name"
                        to={`/dentists/${dentist.id}`}
                      >
                        <b>{dentist.fullName}</b>
                      </Link>
                      <div className="tiny muted">{dentist.qualification}</div>
                    </td>
                    <td className="dentist-mobile">{dentist.mobile || '—'}</td>
                    <td>{dentist.specialization}</td>
                    <td>{dentist.clinics?.[0]?.name ?? '—'}</td>
                    <td>{dentist.councilRegNo}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className="btn btn-danger"
                        disabled={isDisabling}
                        onClick={() => handleDisable(dentist)}
                      >
                        Disable
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {offboarded.length > 0 && (
            <>
              <h2 style={{ margin: '24px 0 12px' }}>Disabled and rejected</h2>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Dentist</th>
                      <th>Mobile number</th>
                      <th>Specialty</th>
                      <th>Status</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {offboarded.map((dentist) => (
                      <tr
                        key={dentist.id}
                        className="dentist-row"
                        onClick={(event) => openDentist(event, dentist)}
                      >
                        <td>
                          <Link
                            className="dentist-name"
                            to={`/dentists/${dentist.id}`}
                          >
                            <b>{dentist.fullName}</b>
                          </Link>
                          <div className="tiny muted">
                            {dentist.qualification}
                          </div>
                          {dentist.rejectionReason && (
                            <div className="tiny muted">
                              Reason: {dentist.rejectionReason}
                            </div>
                          )}
                        </td>
                        <td className="dentist-mobile">
                          {dentist.mobile || '—'}
                        </td>
                        <td>{dentist.specialization}</td>
                        <td>
                          {dentist.status === 'disabled' ? (
                            <span className="badge amber">Disabled</span>
                          ) : (
                            <span className="badge red">Rejected</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {dentist.status === 'disabled' ? (
                            <button
                              type="button"
                              className="btn"
                              disabled={isEnabling}
                              onClick={() => handleEnable(dentist)}
                            >
                              Enable
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="btn"
                              disabled={isReconsidering}
                              onClick={() => handleReconsider(dentist)}
                            >
                              Move to review
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          <div
            className="row"
            style={{ justifyContent: 'flex-end', marginTop: 16 }}
          >
            <button
              type="button"
              className="btn"
              disabled={page <= 1 || isFetching}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </button>
            <span className="small muted">Page {page}</span>
            <button
              type="button"
              className="btn"
              disabled={!data?.nextPage || isFetching}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </>
      )}
    </>
  );
}
