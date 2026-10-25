import { WorkingDaysField } from './working-days-field';
import { EVERY_DAY, workingDaysLabel } from '@/lib/working-days';
import { useState, type FormEvent } from 'react';
import { Clock3, MapPin, Pencil, Video } from 'lucide-react';
import { toast } from 'sonner';
import {
  useGetDentistsMeQuery,
  usePatchDentistsMeMutation,
} from '@/api/generated-api';
import { apiErrorMessage } from '@/lib/api-error';
import { formatTime, rupees } from '@/lib/date';
import { SettingsSection } from './settings-section';

export function ConsultationSettings() {
  const { data: me, error, isLoading, refetch } = useGetDentistsMeQuery();
  const [update, { isLoading: isSaving }] = usePatchDentistsMeMutation();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    feeVideo: 0,
    feeClinic: 0,
    offersVideo: false,
    hoursFrom: '10:00',
    hoursTo: '18:30',
    workingDays: EVERY_DAY,
  });
  function startEdit() {
    setForm({
      feeVideo: (me?.feeVideoPaise ?? 0) / 100,
      feeClinic: (me?.feeClinicPaise ?? 0) / 100,
      offersVideo: me?.offersVideo ?? false,
      hoursFrom: me?.videoHoursFrom ?? '10:00',
      hoursTo: me?.videoHoursTo ?? '18:30',
      workingDays: me?.videoWorkingDays ?? EVERY_DAY,
    });
    setEditing(true);
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (form.offersVideo && form.hoursFrom >= form.hoursTo) {
      toast.error('Closing time must be after opening time');
      return;
    }
    try {
      await update({
        dentistSelfUpdate: {
          feeVideoPaise: Math.round(form.feeVideo * 100),
          feeClinicPaise: Math.round(form.feeClinic * 100),
          offersVideo: form.offersVideo,
          videoWorkingDays: form.workingDays,
          videoHoursFrom: form.offersVideo ? form.hoursFrom : undefined,
          videoHoursTo: form.offersVideo ? form.hoursTo : undefined,
        },
      }).unwrap();
      toast.success('Fees and video hours saved');
      setEditing(false);
    } catch (error) {
      toast.error(
        apiErrorMessage(error, 'Could not save your fees and hours.'),
      );
    }
  }
  return (
    <SettingsSection
      id="consultations"
      title="Fees & availability"
      description="Set consultation fees and the hours you offer video visits."
      icon={Video}
      busy={isLoading}
      action={
        !editing &&
        me &&
        !error && (
          <button type="button" className="btn" onClick={startEdit}>
            <Pencil size={15} />
            Edit fees & hours
          </button>
        )
      }
    >
      {error ? (
        <div className="settings-feedback" role="alert">
          <p>Could not load consultation settings.</p>
          <button type="button" className="btn" onClick={() => void refetch()}>
            Try again
          </button>
        </div>
      ) : isLoading ? (
        <p className="muted">Loading consultation settings…</p>
      ) : editing ? (
        <form onSubmit={save}>
          <fieldset disabled={isSaving} className="settings-form-grid">
            <label className="field">
              <span>In-clinic consultation fee (₹)</span>
              <input
                className="input"
                type="number"
                required
                min={0}
                step="0.01"
                value={form.feeClinic}
                onChange={(event) =>
                  setForm({ ...form, feeClinic: Number(event.target.value) })
                }
              />
              <p className="hint">Applies to all your clinics.</p>
            </label>
            <label className="field">
              <span>Video consultation fee (₹)</span>
              <input
                className="input"
                type="number"
                required
                min={0}
                step="0.01"
                value={form.feeVideo}
                onChange={(event) =>
                  setForm({ ...form, feeVideo: Number(event.target.value) })
                }
              />
            </label>
            <label className="settings-video-toggle settings-field-wide">
              <div>
                <b>Offer video consultations</b>
                <p>Let patients consult you from the Dentra app.</p>
              </div>
              <input
                type="checkbox"
                checked={form.offersVideo}
                onChange={(event) =>
                  setForm({ ...form, offersVideo: event.target.checked })
                }
              />
            </label>
            {form.offersVideo && (
              <>
                <WorkingDaysField
                  value={form.workingDays}
                  onChange={(workingDays) => setForm({ ...form, workingDays })}
                />
                <label className="field">
                  <span>Video consultations start at</span>
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
                  <span>Video consultations end at</span>
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
              </>
            )}
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
        <>
          <div className="settings-fee-grid">
            <div className="settings-fee-card">
              <MapPin size={21} aria-hidden="true" />
              <span>In-clinic consultation</span>
              <strong>{rupees(me?.feeClinicPaise)}</strong>
              <p>Per visit · All clinic locations</p>
            </div>
            <div className="settings-fee-card">
              <Video size={21} aria-hidden="true" />
              <span>Video consultation</span>
              <strong>
                {me?.offersVideo ? rupees(me.feeVideoPaise) : 'Not offered'}
              </strong>
              <p>
                {me?.offersVideo
                  ? 'Per consultation · Dentra app'
                  : 'Enable video visits to accept online bookings.'}
              </p>
            </div>
          </div>
          {me?.offersVideo && (
            <div className="settings-note">
              <Clock3 size={18} aria-hidden="true" />
              <div>
                <b>Video consultation hours</b>
                <p>
                  {workingDaysLabel(me.videoWorkingDays)},{' '}
                  {formatTime(me.videoHoursFrom)}–{formatTime(me.videoHoursTo)}{' '}
                  · IST
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </SettingsSection>
  );
}
