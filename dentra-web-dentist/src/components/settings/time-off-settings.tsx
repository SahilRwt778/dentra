import { useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { TimeOffInput, TimeOffPreview } from '@/api/generated-api';
import {
  useGetDentistsMeTimeOffQuery,
  usePostDentistsMeTimeOffMutation,
  usePostDentistsMeTimeOffPreviewMutation,
  useDeleteDentistsMeTimeOffByIdMutation,
} from '@/api/availability';
import { apiErrorMessage } from '@/lib/api-error';
import { formatDate, formatTime, todayIso } from '@/lib/date';
import { SettingsSection } from './settings-section';

const emptyForm = (): TimeOffInput => ({
  startDate: todayIso(),
  endDate: todayIso(),
  allDay: true,
  fromTime: '10:00',
  toTime: '18:30',
  reason: '',
});

export function TimeOffSettings({ active }: { active: boolean }) {
  const periods = useGetDentistsMeTimeOffQuery(undefined, {
    skip: !active,
    refetchOnMountOrArgChange: true,
    pollingInterval: active ? 15000 : 0,
  });
  const [form, setForm] = useState(emptyForm);
  const [preview, setPreview] = useState<TimeOffPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [check, checking] = usePostDentistsMeTimeOffPreviewMutation();
  const [create, creating] = usePostDentistsMeTimeOffMutation();
  const [remove, removing] = useDeleteDentistsMeTimeOffByIdMutation();
  const lock = useRef(false);
  const busy = checking.isLoading || creating.isLoading || removing.isLoading;
  function change(changes: Partial<TimeOffInput>) {
    if (lock.current) return;
    setForm((current) => ({ ...current, ...changes }));
    setPreview(null);
    setError(null);
    setRequestId(crypto.randomUUID());
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (lock.current) return;
    if (
      form.endDate < form.startDate ||
      (!form.allDay && form.fromTime! >= form.toTime!)
    ) {
      setError(
        'The end must be on or after the start date, with an end time after the start time.',
      );
      return;
    }
    lock.current = true;
    setError(null);
    const input = {
      ...form,
      fromTime: form.allDay ? undefined : form.fromTime,
      toTime: form.allDay ? undefined : form.toTime,
      reason: form.reason?.trim() || undefined,
    };
    try {
      if (!preview || preview.total) {
        setPreview(await check({ timeOffInput: input }).unwrap());
      } else {
        await create({ body: { ...input, requestId } }).unwrap();
        setPreview(null);
        setForm(emptyForm());
        setRequestId(crypto.randomUUID());
        toast.success(
          'Time off saved. These times are closed for new bookings.',
        );
      }
    } catch (failure) {
      setError(
        apiErrorMessage(failure, 'Could not save time off. Please try again.'),
      );
      setPreview(null);
    } finally {
      lock.current = false;
    }
  }
  async function removePeriod(id: string) {
    if (
      lock.current ||
      !window.confirm(
        'Remove this time off? Unbooked times will reopen on your working days.',
      )
    )
      return;
    lock.current = true;
    setError(null);
    try {
      await remove({ id }).unwrap();
      setPreview(null);
      toast.success('Time off removed');
    } catch (failure) {
      setError(apiErrorMessage(failure, 'Could not remove time off.'));
    } finally {
      lock.current = false;
    }
  }
  return (
    <SettingsSection
      id="time-off"
      title="Time off"
      icon={CalendarDays}
      description="Block leave or breaks across all clinics and video consultations."
    >
      <form onSubmit={submit}>
        <fieldset disabled={busy} className="settings-form-grid">
          <label className="field">
            <span>First day</span>
            <input
              className="input"
              type="date"
              required
              min={todayIso()}
              value={form.startDate}
              onChange={(event) =>
                change({
                  startDate: event.target.value,
                  endDate:
                    form.endDate < event.target.value
                      ? event.target.value
                      : form.endDate,
                })
              }
            />
          </label>
          <label className="field">
            <span>Last day</span>
            <input
              className="input"
              type="date"
              required
              min={form.startDate}
              value={form.endDate}
              onChange={(event) => change({ endDate: event.target.value })}
            />
          </label>
          <label className="settings-video-toggle settings-field-wide">
            <div>
              <b>All day</b>
              <p>Or block the same hours on each selected date (IST).</p>
            </div>
            <input
              type="checkbox"
              checked={form.allDay}
              onChange={(event) => change({ allDay: event.target.checked })}
            />
          </label>
          {!form.allDay && (
            <>
              <label className="field">
                <span>From</span>
                <input
                  className="input"
                  type="time"
                  required
                  value={form.fromTime}
                  onChange={(event) => change({ fromTime: event.target.value })}
                />
              </label>
              <label className="field">
                <span>To</span>
                <input
                  className="input"
                  type="time"
                  required
                  value={form.toTime}
                  onChange={(event) => change({ toTime: event.target.value })}
                />
              </label>
            </>
          )}
          <label className="field settings-field-wide">
            <span>Reason (optional, only you can see this)</span>
            <input
              className="input"
              maxLength={200}
              value={form.reason}
              onChange={(event) => change({ reason: event.target.value })}
            />
          </label>
        </fieldset>
        {error && (
          <p role="alert" className="settings-feedback">
            {error}
          </p>
        )}
        {preview && (
          <div className="settings-note">
            <CalendarDays size={20} aria-hidden="true" />
            <div className="stack grow">
              <b>
                {preview.total
                  ? `${preview.total} appointments need attention`
                  : 'Ready to block this period'}
              </b>
              <p>
                {preview.total
                  ? 'Move or cancel these appointments, then check again. Time off has not been saved.'
                  : 'No active appointments overlap this period. Confirm to close these times.'}
              </p>
              {preview.appointments.map((appointment) => (
                <Link
                  className="btn"
                  key={appointment.id}
                  to={`/consult/${appointment.id}`}
                >
                  {appointment.patientName} · {formatDate(appointment.date)},{' '}
                  {formatTime(appointment.time)} ·{' '}
                  {appointment.type === 'video'
                    ? 'Video'
                    : appointment.clinicName || 'Clinic'}
                </Link>
              ))}
              {preview.total > preview.appointments.length && (
                <p>
                  Showing the first {preview.appointments.length}. Check again
                  after resolving them to see the remaining appointments.
                </p>
              )}
            </div>
          </div>
        )}
        <div className="settings-actions">
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy
              ? 'Please wait…'
              : preview?.total === 0
              ? 'Confirm time off'
              : 'Check affected appointments'}
          </button>
        </div>
      </form>
      <h3>Upcoming time off</h3>
      {periods.error ? (
        <div role="alert" className="settings-feedback">
          Could not load time off.{' '}
          <button
            className="btn"
            type="button"
            onClick={() => void periods.refetch()}
          >
            Try again
          </button>
        </div>
      ) : !periods.currentData ? (
        <p className="muted">Loading time off…</p>
      ) : !periods.currentData.length ? (
        <p className="muted">No time off scheduled.</p>
      ) : (
        <div className="settings-clinic-grid">
          {periods.currentData.map((period) => (
            <article className="settings-clinic-card" key={period.id}>
              <h3>
                {formatDate(period.startDate)}
                {period.startDate !== period.endDate
                  ? ` – ${formatDate(period.endDate)}`
                  : ''}
              </h3>
              <p>
                {period.allDay
                  ? 'All day'
                  : `${formatTime(period.fromTime)}–${formatTime(
                      period.toTime,
                    )} IST, each day`}
              </p>
              {period.reason && <p className="muted">{period.reason}</p>}
              <button
                className="btn btn-danger"
                type="button"
                disabled={busy}
                onClick={() => void removePeriod(period.id)}
              >
                <Trash2 size={15} />
                Remove time off
              </button>
            </article>
          ))}
        </div>
      )}
    </SettingsSection>
  );
}
