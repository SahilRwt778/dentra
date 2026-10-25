import { WorkingDaysField } from './working-days-field';
import { EVERY_DAY, workingDaysLabel } from '@/lib/working-days';
import { useState, type FormEvent } from 'react';
import { Clock3, MapPin, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  useGetDentistsMeClinicsQuery,
  usePostDentistsMeClinicsMutation,
  usePatchDentistsMeClinicsByClinicIdMutation,
  useDeleteDentistsMeClinicsByClinicIdMutation,
  type Clinic,
} from '@/api/generated-api';
import { formatTime } from '@/lib/date';
import { apiErrorMessage } from '@/lib/api-error';
import { SettingsSection } from './settings-section';

type ClinicForm = {
  name: string;
  hoursFrom: string;
  hoursTo: string;
  workingDays: number[];
};
const emptyClinic: ClinicForm = {
  name: '',
  hoursFrom: '10:00',
  hoursTo: '18:30',
  workingDays: EVERY_DAY,
};

function ClinicEditor({
  initial,
  saving,
  onSave,
  onCancel,
}: {
  initial: ClinicForm;
  saving: boolean;
  onSave: (form: ClinicForm) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState(initial);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void onSave(form);
  }
  return (
    <form className="settings-clinic-editor" onSubmit={submit}>
      <fieldset disabled={saving} className="settings-form-grid">
        <label className="field settings-field-wide">
          <span>Clinic name</span>
          <input
            className="input"
            required
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
        </label>
        <WorkingDaysField
          value={form.workingDays}
          onChange={(workingDays) => setForm({ ...form, workingDays })}
        />
        <label className="field">
          <span>Opens at</span>
          <input
            className="input"
            required
            type="time"
            value={form.hoursFrom}
            onChange={(event) =>
              setForm({ ...form, hoursFrom: event.target.value })
            }
          />
        </label>
        <label className="field">
          <span>Closes at</span>
          <input
            className="input"
            required
            type="time"
            value={form.hoursTo}
            onChange={(event) =>
              setForm({ ...form, hoursTo: event.target.value })
            }
          />
        </label>
      </fieldset>
      <div className="settings-actions">
        <button
          type="button"
          className="btn"
          disabled={saving}
          onClick={onCancel}
        >
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Saving…' : 'Save clinic'}
        </button>
      </div>
    </form>
  );
}

function ClinicCard({ clinic }: { clinic: Clinic }) {
  const [editing, setEditing] = useState(false);
  const [update, { isLoading: isSaving }] =
    usePatchDentistsMeClinicsByClinicIdMutation();
  const [remove, { isLoading: isRemoving }] =
    useDeleteDentistsMeClinicsByClinicIdMutation();
  async function save(form: ClinicForm) {
    try {
      await update({ clinicId: clinic.id!, clinicInput: form }).unwrap();
      toast.success('Location saved');
      setEditing(false);
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Could not save this clinic.'));
    }
  }
  async function handleRemove() {
    if (
      !window.confirm(
        'Remove this location? Future bookings here should be moved first.',
      )
    )
      return;
    try {
      await remove({ clinicId: clinic.id! }).unwrap();
      toast.success('Location removed');
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Could not remove this clinic.'));
    }
  }
  return (
    <article className="settings-clinic-card">
      {editing ? (
        <ClinicEditor
          initial={{
            name: clinic.name ?? '',
            hoursFrom: clinic.hoursFrom ?? '10:00',
            hoursTo: clinic.hoursTo ?? '18:30',
            workingDays: clinic.workingDays ?? EVERY_DAY,
          }}
          saving={isSaving}
          onSave={save}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <>
          <div className="settings-clinic-name">
            <span className="settings-section-icon">
              <MapPin size={19} aria-hidden="true" />
            </span>
            <div>
              <h3>{clinic.name}</h3>
              {clinic.addressLine && (
                <p className="small muted">{clinic.addressLine}</p>
              )}
            </div>
          </div>
          <div className="settings-clinic-hours">
            <Clock3 size={16} aria-hidden="true" />
            <span>
              {workingDaysLabel(clinic.workingDays)} ·{' '}
              {formatTime(clinic.hoursFrom)}–{formatTime(clinic.hoursTo)}
            </span>
          </div>
          <div className="settings-clinic-actions">
            <button
              type="button"
              className="btn"
              onClick={() => setEditing(true)}
            >
              <Pencil size={14} />
              Edit clinic
            </button>
            <button
              type="button"
              className="btn btn-danger"
              disabled={isRemoving}
              onClick={handleRemove}
            >
              <Trash2 size={14} />
              {isRemoving ? 'Removing…' : 'Remove'}
            </button>
          </div>
        </>
      )}
    </article>
  );
}

export function ClinicSettings() {
  const {
    data: clinics,
    isLoading,
    error,
    refetch,
  } = useGetDentistsMeClinicsQuery();
  const [adding, setAdding] = useState(false);
  const [create, { isLoading: isCreating }] =
    usePostDentistsMeClinicsMutation();
  async function save(form: ClinicForm) {
    try {
      await create({ clinicInput: form }).unwrap();
      toast.success('Location added');
      setAdding(false);
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Could not add this clinic.'));
    }
  }
  return (
    <SettingsSection
      id="clinics"
      title="Clinic locations"
      description="Manage your practice locations and opening hours."
      icon={MapPin}
      busy={isLoading}
      action={
        !adding &&
        !error && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setAdding(true)}
          >
            <Plus size={16} />
            Add clinic
          </button>
        )
      }
    >
      {error ? (
        <div className="settings-feedback" role="alert">
          <p>Could not load your clinics.</p>
          <button type="button" className="btn" onClick={() => void refetch()}>
            Try again
          </button>
        </div>
      ) : isLoading ? (
        <p className="muted">Loading clinics…</p>
      ) : (
        <div className="settings-clinic-grid">
          {(clinics ?? []).map((clinic) => (
            <ClinicCard key={clinic.id} clinic={clinic} />
          ))}
          {!clinics?.length && !adding && (
            <div className="settings-empty">
              <MapPin size={28} aria-hidden="true" />
              <h3>No clinics added</h3>
              <p>Add a clinic so patients can see you in person.</p>
            </div>
          )}
          {adding && (
            <div className="settings-clinic-card">
              <h3 className="settings-editor-title">New clinic</h3>
              <ClinicEditor
                initial={emptyClinic}
                saving={isCreating}
                onSave={save}
                onCancel={() => setAdding(false)}
              />
            </div>
          )}
        </div>
      )}
    </SettingsSection>
  );
}
