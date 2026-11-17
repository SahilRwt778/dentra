import { useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import {
  useGetDentistsByDentistIdSlotsQuery,
  usePostAppointmentsByAppointmentIdRescheduleMutation,
} from "@/api/generated-api";
import { Modal } from "@/components/modal";
import { apiErrorMessage } from "@/lib/api-error";
import { addDaysIso, dayLabel, formatTime, todayIso } from "@/lib/date";

export function RescheduleModal({
  appointmentId,
  dentistId,
  clinicId,
  type,
  onClose,
}: {
  appointmentId: string;
  dentistId: string;
  clinicId?: string | null;
  type: "video" | "clinic";
  onClose: () => void;
}) {
  const [date, setDate] = useState(todayIso);
  const [time, setTime] = useState("");
  const { currentData, isFetching, error, refetch } =
    useGetDentistsByDentistIdSlotsQuery(
      { dentistId, date, type, clinicId: clinicId ?? undefined },
      { pollingInterval: 30000, refetchOnMountOrArgChange: true }
    );
  const [reschedule, { isLoading }] =
    usePostAppointmentsByAppointmentIdRescheduleMutation();
  const days = Array.from({ length: 5 }, (_, index) => addDaysIso(index));
  const slots = currentData?.date === date ? currentData.slots ?? [] : [];
  const canConfirm =
    !!time && slots.includes(time) && !isFetching && !error && !isLoading;

  async function confirm() {
    if (!canConfirm) return;
    try {
      await reschedule({ appointmentId, body: { date, time } }).unwrap();
      toast.success(`Rescheduled to ${dayLabel(date)}, ${formatTime(time)}`);
      onClose();
    } catch (failure) {
      setTime("");
      toast.error(apiErrorMessage(failure, "Could not reschedule."));
    }
  }

  return (
    <Modal open onClose={onClose}>
      <div className="row between" style={{ marginBottom: 14 }}>
        <h2>Reschedule</h2>
        <button
          type="button"
          className="btn"
          aria-label="Close"
          onClick={onClose}
        >
          <X size={16} />
        </button>
      </div>
      <div style={{ marginTop: 14 }}>
        <p className="q-label">New day</p>
        <div
          className="day-strip"
          style={{ display: "flex", gap: 8, overflowX: "auto" }}
        >
          {days.map((day) => (
            <button
              key={day}
              type="button"
              className={`choice${date === day ? " on" : ""}`}
              aria-pressed={date === day}
              disabled={isLoading}
              onClick={() => {
                setDate(day);
                setTime("");
              }}
            >
              {dayLabel(day)}
            </button>
          ))}
        </div>
      </div>
      <div style={{ marginTop: 14 }} aria-live="polite">
        <p className="q-label">New time</p>
        {error ? (
          <>
            <p role="alert">
              {apiErrorMessage(error, "Could not load available times.")}
            </p>
            <button type="button" className="btn" onClick={() => refetch()}>
              Retry availability
            </button>
          </>
        ) : isFetching || !currentData ? (
          <p className="hint">Checking available times…</p>
        ) : !slots.length ? (
          <p className="hint">
            No available times on this day. Please choose another date.
          </p>
        ) : (
          <div
            className="slot-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 8,
            }}
          >
            {slots.map((slot) => (
              <button
                key={slot}
                type="button"
                className={`choice${time === slot ? " on" : ""}`}
                aria-pressed={time === slot}
                disabled={isLoading}
                onClick={() => setTime(slot)}
              >
                {formatTime(slot)}
              </button>
            ))}
          </div>
        )}
      </div>
      <p className="hint">
        The patient's original payment carries over. They're notified of the new
        time.
      </p>
      <div
        className="row"
        style={{ marginTop: 14, justifyContent: "flex-end" }}
      >
        <button type="button" className="btn" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={!canConfirm}
          onClick={confirm}
        >
          Confirm new time
        </button>
      </div>
    </Modal>
  );
}
