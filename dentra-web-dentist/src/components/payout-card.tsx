import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Landmark, ShieldCheck } from 'lucide-react';
import {
  SettingsDetail,
  SettingsSection,
} from '@/components/settings/settings-section';
import {
  useGetDentistPayoutDetailsQuery,
  useSubmitDentistPayoutRequestMutation,
  type PayoutDetails,
  type PayoutProfile,
} from '@/api/generated-api';

function PayoutDetailsList({ details }: { details: PayoutDetails }) {
  return (
    <dl className="settings-detail-grid">
      <SettingsDetail label="Account holder">
        {details.bankAccountHolder}
      </SettingsDetail>
      <SettingsDetail label="Account number">
        {details.bankAccountNo}
      </SettingsDetail>
      <SettingsDetail label="IFSC">{details.bankIfsc}</SettingsDetail>
      <SettingsDetail label="PAN">{details.pan}</SettingsDetail>
      <SettingsDetail label="GSTIN">{details.gstin}</SettingsDetail>
    </dl>
  );
}

function PayoutForm({
  profile,
  onDone,
}: {
  profile: PayoutProfile;
  onDone: () => void;
}) {
  const base =
    profile.request?.status === 'rejected' ? profile.request : profile.approved;
  const [previousRequestId] = useState(profile.request?.id ?? null);
  const [form, setForm] = useState({
    bankAccountHolder: base?.bankAccountHolder ?? '',
    bankAccountNo: base?.bankAccountNo ?? '',
    confirmAccountNo: '',
    bankIfsc: base?.bankIfsc ?? '',
    pan: base?.pan ?? '',
    gstin: base?.gstin ?? '',
  });
  const [submit, { isLoading }] = useSubmitDentistPayoutRequestMutation();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (form.bankAccountNo.trim() !== form.confirmAccountNo.trim()) {
      toast.error('Account numbers do not match.');
      return;
    }
    try {
      await submit({
        payoutSubmission: {
          ...form,
          previousRequestId,
        },
      }).unwrap();
      toast.success('Payout details sent to admin for approval.');
      onDone();
    } catch (error) {
      const message = (error as { data?: { message?: string | string[] } }).data
        ?.message;
      toast.error(
        Array.isArray(message)
          ? message.join('. ')
          : message ?? 'Could not submit payout details. Please try again.',
      );
      if ((error as { status?: number }).status === 409) onDone();
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <fieldset disabled={isLoading} className="settings-form-grid">
        <label className="field">
          <span>Account holder name</span>
          <input
            className="input"
            required
            minLength={2}
            maxLength={120}
            autoComplete="off"
            value={form.bankAccountHolder}
            onChange={(event) =>
              setForm({ ...form, bankAccountHolder: event.target.value })
            }
          />
        </label>
        <label className="field">
          <span>IFSC</span>
          <input
            className="input"
            required
            pattern="[A-Z]{4}0[A-Z0-9]{6}"
            minLength={11}
            maxLength={11}
            autoComplete="off"
            value={form.bankIfsc}
            onChange={(event) =>
              setForm({ ...form, bankIfsc: event.target.value.toUpperCase() })
            }
          />
        </label>
        <label className="field">
          <span>Account number</span>
          <input
            className="input"
            required
            inputMode="numeric"
            pattern="[0-9]{6,20}"
            minLength={6}
            maxLength={20}
            autoComplete="off"
            value={form.bankAccountNo}
            onChange={(event) =>
              setForm({ ...form, bankAccountNo: event.target.value })
            }
          />
        </label>
        <label className="field">
          <span>Confirm account number</span>
          <input
            className="input"
            required
            inputMode="numeric"
            pattern="[0-9]{6,20}"
            minLength={6}
            maxLength={20}
            autoComplete="off"
            value={form.confirmAccountNo}
            onChange={(event) =>
              setForm({ ...form, confirmAccountNo: event.target.value })
            }
          />
        </label>
        <label className="field">
          <span>PAN</span>
          <input
            className="input"
            required
            pattern="[A-Z]{5}[0-9]{4}[A-Z]"
            minLength={10}
            maxLength={10}
            autoComplete="off"
            value={form.pan}
            onChange={(event) =>
              setForm({ ...form, pan: event.target.value.toUpperCase() })
            }
          />
        </label>
        <label className="field">
          <span>GSTIN (optional)</span>
          <input
            className="input"
            pattern="[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]"
            maxLength={15}
            autoComplete="off"
            value={form.gstin}
            onChange={(event) =>
              setForm({ ...form, gstin: event.target.value.toUpperCase() })
            }
          />
        </label>
        <div className="settings-note settings-field-wide">
          <ShieldCheck size={19} aria-hidden="true" />
          <p>
            Admin reviews these details before they become active. Your current
            approved account stays active while you wait.
          </p>
        </div>
        <div className="settings-actions settings-field-wide">
          <button type="button" className="btn" onClick={onDone}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary">
            {isLoading ? 'Submitting…' : 'Submit for approval'}
          </button>
        </div>
      </fieldset>
    </form>
  );
}

export function PayoutCard() {
  const { data, error, isFetching, refetch } = useGetDentistPayoutDetailsQuery(
    undefined,
    {
      pollingInterval: 15000,
      skipPollingIfUnfocused: true,
      refetchOnMountOrArgChange: true,
    },
  );
  const [editing, setEditing] = useState(false);
  const pending = data?.request?.status === 'pending';

  function finishEditing() {
    setEditing(false);
    void refetch();
  }

  return (
    <SettingsSection
      id="payout"
      title="Payout details"
      description="Manage the bank account used for your practice payouts."
      icon={Landmark}
      busy={isFetching}
      action={
        !editing &&
        data &&
        !pending &&
        !error && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setEditing(true)}
          >
            {data.approved ? 'Update details' : 'Add details'}
          </button>
        )
      }
    >
      {error ? (
        <div role="alert">
          <p>Could not load payout details.</p>
          <button
            type="button"
            className="btn"
            disabled={isFetching}
            onClick={() => void refetch()}
          >
            Try again
          </button>
        </div>
      ) : !data ? (
        <p className="small muted">Loading payout details…</p>
      ) : (
        <div className="settings-payout-content">
          {data.approved && !editing ? (
            <div className="settings-approved-account">
              <span className="badge green">Approved account</span>
              <PayoutDetailsList details={data.approved} />
            </div>
          ) : !editing && !pending && !data.approved ? (
            <div className="settings-empty">
              <span className="settings-empty-icon">
                <Landmark size={28} aria-hidden="true" />
              </span>
              <h3>Add your payout account</h3>
              <p>
                Submit your bank and tax details for admin approval.
                <br />
                Your approved account will appear here.
              </p>
            </div>
          ) : null}

          {data.request && data.request.status !== 'approved' && (
            <div
              className={`settings-payout-status${
                pending ? ' pending' : ' rejected'
              }`}
              role="status"
            >
              <span className={`badge ${pending ? 'amber' : 'red'}`}>
                {pending ? 'Awaiting admin approval' : 'Request rejected'}
              </span>
              {pending ? (
                <>
                  <p className="small">
                    Your payout details have been sent to admin. Please wait for
                    verification.
                  </p>
                  <PayoutDetailsList details={data.request} />
                </>
              ) : (
                <p className="small">{data.request.rejectionReason}</p>
              )}
            </div>
          )}
          {editing && !pending && (
            <PayoutForm profile={data} onDone={finishEditing} />
          )}
        </div>
      )}
    </SettingsSection>
  );
}
