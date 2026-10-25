import { useRef, useState } from 'react';
import { Alert } from 'react-native';
import type { Appointment } from '../../common/types/api';
import { appointmentsApi } from '../../api/appointments.api';
import { errorMessage } from '../../common/utils/api-error';
import { useMounted } from '../../common/hooks/useMounted';
import {
  dentraApi,
  useCompleteConsultationMutation,
} from '../../store/dentraApi';
import { useAppStore } from '../../store/hooks';
import { callClosed } from '../../store/videoSlice';
import type { ConsultationSection } from './ConsultationSections';
import type { useClinicalNote } from './useClinicalNote';
import type { useDentalChart } from './dental-chart/useDentalChart';
import type { usePrescription } from './prescription/usePrescription';
import type { useTreatmentPlan } from './treatment-plan/useTreatmentPlan';

type Options = {
  appointment: Appointment;
  note: ReturnType<typeof useClinicalNote>;
  chart: ReturnType<typeof useDentalChart>;
  rx: ReturnType<typeof usePrescription>;
  plan: ReturnType<typeof useTreatmentPlan>;
  disabled: boolean;
  selectSection: (section: ConsultationSection) => void;
  onCompleted: (appointment: Appointment) => void;
};

export function useConsultationCompletion(options: Options) {
  const latest = useRef(options);
  latest.current = options;
  const lock = useRef(false);
  const confirming = useRef(false);
  const mounted = useMounted();
  const store = useAppStore();
  const [complete, mutation] = useCompleteConsultationMutation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function validate() {
    const { appointment, note, rx, plan, disabled, selectSection } =
      latest.current;
    if (disabled || appointment.status !== 'in_consult') return false;
    let section: ConsultationSection | null = null;
    let message = '';
    if (rx.editor) {
      section = 'rx';
      message = 'Add or cancel the medicine you are editing before completing.';
    } else if (plan.editor) {
      section = 'plan';
      message =
        'Add or cancel the procedure you are editing before completing.';
    } else if (!note.form.diagnosis.trim()) {
      section = 'note';
      message = 'Add a diagnosis to complete the consultation.';
    } else if (rx.items.length && !rx.signedAt) {
      section = 'rx';
      message = 'Preview and sign the prescription before completing.';
    }
    if (section) {
      selectSection(section);
      setError(message);
      return false;
    }
    return true;
  }

  function completed(appointment: Appointment, recovered = false) {
    if (!mounted.current) return;
    if (store.getState().video.call?.appointmentId === appointment.id)
      store.dispatch(callClosed());
    latest.current.onCompleted(appointment);
    if (recovered)
      store.dispatch(
        dentraApi.util.invalidateTags([
          'Appointments',
          'VideoStatus',
          'Patients',
          'PatientRecord',
          { type: 'Consultation', id: appointment.id },
        ]),
      );
    setError(null);
  }

  async function finish() {
    confirming.current = false;
    if (lock.current || !validate()) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    const { appointment, note, chart, rx, plan, selectSection } =
      latest.current;
    try {
      // Each save sends only its section's changes. Stop on failure; never discard a draft.
      for (const [section, draft] of [
        ['note', note],
        ['chart', chart],
        ['rx', rx],
        ['plan', plan],
      ] as const) {
        if (!mounted.current) return;
        if (draft.dirty && !(await draft.save())) {
          if (mounted.current) {
            selectSection(section);
            setError(
              'The visit is still open. Save the highlighted section and try again.',
            );
          }
          return;
        }
      }
      if (!mounted.current) return;
      try {
        completed(await complete(appointment.id).unwrap());
      } catch (failure) {
        // A response can be lost after completion committed. Read the status before offering retry.
        const current = await appointmentsApi
          .get(appointment.id)
          .catch(() => null);
        if (current?.status === 'completed') completed(current, true);
        else if (mounted.current) setError(errorMessage(failure));
      }
    } catch (failure) {
      if (mounted.current) setError(errorMessage(failure));
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
      mutation.reset();
    }
  }

  function request() {
    if (lock.current || confirming.current || !validate()) return;
    setError(null);
    confirming.current = true;
    Alert.alert(
      'Complete consultation?',
      'Your changes will be saved and the patient can view their visit summary. Clinical records become read-only when you complete the visit.',
      [
        {
          text: 'Keep editing',
          style: 'cancel',
          onPress: () => {
            confirming.current = false;
          },
        },
        { text: 'Save and complete', onPress: finish },
      ],
      {
        cancelable: true,
        onDismiss: () => {
          confirming.current = false;
        },
      },
    );
  }
  return { request, busy, error };
}
