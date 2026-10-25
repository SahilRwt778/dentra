import { useState, type FormEvent } from 'react';
import { Pencil, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import {
  useGetDentistsMeQuery,
  usePatchDentistsMeMutation,
} from '@/api/generated-api';
import { apiErrorMessage } from '@/lib/api-error';
import { SettingsDetail, SettingsSection } from './settings-section';

export function ProfileSettings() {
  const { data: me, error, isLoading, refetch } = useGetDentistsMeQuery();
  const [update, { isLoading: isSaving }] = usePatchDentistsMeMutation();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    qualification: '',
    specialization: '',
    councilRegNo: '',
    languages: '',
    email: '',
  });

  function startEdit() {
    setForm({
      qualification: me?.qualification ?? '',
      specialization: me?.specialization ?? '',
      councilRegNo: me?.councilRegNo ?? '',
      languages: (me?.languages ?? []).join(', '),
      email: me?.email ?? '',
    });
    setEditing(true);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await update({
        dentistSelfUpdate: {
          qualification: form.qualification,
          specialization: form.specialization,
          councilRegNo: form.councilRegNo,
          languages: form.languages
            .split(',')
            .map((language) => language.trim())
            .filter(Boolean),
          email: form.email || undefined,
        },
      }).unwrap();
      toast.success('Profile saved');
      setEditing(false);
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Could not save your profile.'));
    }
  }

  return (
    <SettingsSection
      id="profile"
      title="Professional profile"
      description="Your qualifications and contact information."
      icon={UserRound}
      busy={isLoading}
      action={
        !editing &&
        me &&
        !error && (
          <button type="button" className="btn" onClick={startEdit}>
            <Pencil size={15} />
            Edit profile
          </button>
        )
      }
    >
      {error ? (
        <div className="settings-feedback" role="alert">
          <p>Could not load your profile.</p>
          <button type="button" className="btn" onClick={() => void refetch()}>
            Try again
          </button>
        </div>
      ) : isLoading ? (
        <p className="muted" role="status">
          Loading profile…
        </p>
      ) : editing ? (
        <form onSubmit={save}>
          <fieldset disabled={isSaving} className="settings-form-grid">
            <label className="field">
              <span>Qualification</span>
              <input
                className="input"
                value={form.qualification}
                onChange={(event) =>
                  setForm({ ...form, qualification: event.target.value })
                }
              />
            </label>
            <label className="field">
              <span>Specialization</span>
              <input
                className="input"
                value={form.specialization}
                onChange={(event) =>
                  setForm({ ...form, specialization: event.target.value })
                }
              />
            </label>
            <label className="field">
              <span>Council registration number</span>
              <input
                className="input"
                value={form.councilRegNo}
                onChange={(event) =>
                  setForm({ ...form, councilRegNo: event.target.value })
                }
              />
            </label>
            <label className="field">
              <span>Email address</span>
              <input
                className="input"
                type="email"
                value={form.email}
                onChange={(event) =>
                  setForm({ ...form, email: event.target.value })
                }
              />
            </label>
            <label className="field settings-field-wide">
              <span>Languages</span>
              <input
                className="input"
                value={form.languages}
                onChange={(event) =>
                  setForm({ ...form, languages: event.target.value })
                }
              />
              <p className="hint">
                Separate languages with commas, for example English, Hindi.
              </p>
            </label>
          </fieldset>
          <div className="settings-actions">
            <button
              type="button"
              className="btn"
              disabled={isSaving}
              onClick={() => setEditing(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSaving}
            >
              {isSaving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      ) : (
        <dl className="settings-detail-grid">
          <SettingsDetail label="Full name">{me?.fullName}</SettingsDetail>
          <SettingsDetail label="Qualification">
            {me?.qualification}
          </SettingsDetail>
          <SettingsDetail label="Specialization">
            {me?.specialization}
          </SettingsDetail>
          <SettingsDetail label="Council registration number">
            {me?.councilRegNo}
          </SettingsDetail>
          <SettingsDetail label="Email address">{me?.email}</SettingsDetail>
          <SettingsDetail label="Mobile number">{me?.mobile}</SettingsDetail>
          <SettingsDetail label="Languages">
            {me?.languages?.join(', ')}
          </SettingsDetail>
        </dl>
      )}
    </SettingsSection>
  );
}
