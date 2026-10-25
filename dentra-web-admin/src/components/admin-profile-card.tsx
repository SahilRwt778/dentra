import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { useGetAdminMeQuery, usePatchAdminMeMutation, type AdminProfile } from '@/api/generated-api';

function failureMessage(error: unknown) {
  const message = (error as { data?: { message?: unknown } })?.data?.message;
  if (typeof message === 'string') return message;
  if (Array.isArray(message)) return message.join('. ');
  return 'Could not save your profile. Please try again.';
}

export function AdminProfileCard() {
  const {
    data: profile,
    error,
    isLoading,
    refetch,
  } = useGetAdminMeQuery(undefined, { refetchOnMountOrArgChange: true });
  const [updateProfile, { isLoading: saving }] = usePatchAdminMeMutation();
  const [draft, setDraft] = useState<AdminProfile | null>(null);
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const emailChanged = !!draft && draft.email.trim().toLowerCase() !== profile?.email.toLowerCase();

  function cancel() {
    setDraft(null);
    setPassword('');
    setMessage('');
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft || saving) return;
    setMessage('');
    try {
      await updateProfile({
        adminProfileUpdate: {
          name: draft.name,
          email: draft.email,
          phone: draft.phone,
          version: draft.version,
          ...(emailChanged ? { currentPassword: password } : {}),
        },
      }).unwrap();
      cancel();
      toast.success(
        emailChanged ? 'Profile saved. Use your new email next time you sign in.' : 'Profile saved.',
      );
    } catch (err) {
      setMessage(failureMessage(err));
    }
  }

  return (
    <div className="card">
      <div className="row between" style={{ marginBottom: 10 }}>
        <h3>Your profile</h3>
        {!draft && profile && !error && (
          <button
            type="button"
            className="btn-link btn small"
            onClick={() => {
              setDraft({ ...profile });
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
                autoComplete="name"
                required
                maxLength={100}
                value={draft.name}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              />
            </label>
            <label className="field">
              <span>Email</span>
              <input
                className="input"
                type="email"
                autoComplete="email"
                required
                maxLength={254}
                value={draft.email}
                onChange={(event) => setDraft({ ...draft, email: event.target.value })}
              />
              <span className="tiny muted">This email is used to sign in to Admin Web.</span>
            </label>
            <label className="field">
              <span>Mobile number (optional)</span>
              <input
                className="input"
                type="tel"
                autoComplete="tel"
                maxLength={30}
                placeholder="+91 98100 23456"
                value={draft.phone ?? ''}
                onChange={(event) => setDraft({ ...draft, phone: event.target.value })}
              />
            </label>
            {emailChanged && (
              <label className="field">
                <span>Current password</span>
                <input
                  className="input"
                  type="password"
                  autoComplete="current-password"
                  required
                  maxLength={200}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <span className="tiny muted">Confirm your password to change the login email.</span>
              </label>
            )}
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
            <button type="button" className="btn" disabled={saving} onClick={cancel}>
              Cancel
            </button>
          </div>
        </form>
      ) : error ? (
        <div className="stack" role="alert">
          <p className="small">Could not load your profile.</p>
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
      ) : isLoading || !profile ? (
        <p className="small muted">Loading profile…</p>
      ) : (
        <dl className="kv">
          <dt>Name</dt>
          <dd>{profile.name}</dd>
          <dt>Email</dt>
          <dd>{profile.email}</dd>
          <dt>Mobile</dt>
          <dd>{profile.phone || 'Not added'}</dd>
        </dl>
      )}
    </div>
  );
}
