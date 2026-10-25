import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import {
  useGetAdminSettingsQuery,
  usePatchAdminSettingsMutation,
  type PlatformSettings,
} from '@/api/generated-api';

function failureMessage(error: unknown) {
  const message = (error as { data?: { message?: unknown } })?.data?.message;
  if (typeof message === 'string') return message;
  if (Array.isArray(message)) return message.join('. ');
  return 'Could not save platform details. Please try again.';
}

export function PlatformSettingsCard() {
  const {
    data: platform,
    error,
    isLoading,
    refetch,
  } = useGetAdminSettingsQuery(undefined, { refetchOnMountOrArgChange: true });
  const [updatePlatform, { isLoading: saving }] = usePatchAdminSettingsMutation();
  const [draft, setDraft] = useState<PlatformSettings | null>(null);
  const [message, setMessage] = useState('');

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft || saving) return;
    setMessage('');
    try {
      await updatePlatform({
        platformSettingsUpdate: {
          name: draft.name,
          region: draft.region,
          supportEmail: draft.supportEmail,
          version: draft.version,
        },
      }).unwrap();
      setDraft(null);
      toast.success('Platform details saved.');
    } catch (err) {
      setMessage(failureMessage(err));
    }
  }

  return (
    <div className="card">
      <div className="row between" style={{ marginBottom: 10 }}>
        <h3>Platform</h3>
        {!draft && platform && !error && (
          <button
            type="button"
            className="btn-link btn small"
            onClick={() => {
              setDraft({ ...platform });
              setMessage('');
            }}
          >
            Edit
          </button>
        )}
      </div>
      {draft ? (
        <form
          className="stack"
          onSubmit={(event) => {
            void save(event);
          }}
        >
          <fieldset disabled={saving} className="settings-fields">
            <label className="field">
              <span>Name</span>
              <input
                className="input"
                required
                maxLength={100}
                value={draft.name}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              />
            </label>
            <label className="field">
              <span>Region</span>
              <input
                className="input"
                required
                maxLength={100}
                value={draft.region}
                onChange={(event) => setDraft({ ...draft, region: event.target.value })}
              />
            </label>
            <label className="field">
              <span>Support email</span>
              <input
                className="input"
                type="email"
                required
                maxLength={254}
                value={draft.supportEmail}
                onChange={(event) => setDraft({ ...draft, supportEmail: event.target.value })}
              />
            </label>
          </fieldset>
          {message && (
            <p className="small" role="alert">
              {message}
            </p>
          )}
          <div className="row">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              className="btn"
              disabled={saving}
              onClick={() => {
                setDraft(null);
                setMessage('');
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : error ? (
        <div className="stack" role="alert">
          <p className="small">Could not load platform details.</p>
          <button
            type="button"
            className="btn small"
            onClick={() => {
              void refetch();
            }}
          >
            Try again
          </button>
        </div>
      ) : isLoading || !platform ? (
        <p className="small muted">Loading platform details…</p>
      ) : (
        <dl className="kv">
          <dt>Name</dt>
          <dd>{platform.name}</dd>
          <dt>Region</dt>
          <dd>{platform.region}</dd>
          <dt>Support</dt>
          <dd>{platform.supportEmail}</dd>
        </dl>
      )}
    </div>
  );
}
