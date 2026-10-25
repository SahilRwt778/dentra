import { useEffect, useRef, useState } from 'react';
import type { Appointment } from '../../../common/types/api';
import type {
  DentalChartState,
  ToothNumber,
  ToothStatus,
} from '../../../common/types/dental-chart';
import { useMounted } from '../../../common/hooks/useMounted';
import { errorMessage } from '../../../common/utils/api-error';
import {
  useGetPatientChartQuery,
  useSaveDentalChartMutation,
} from '../../../store/dentraApi';
import {
  dentalChartChanges,
  dentalChartForm,
  markTooth,
} from './dental-chart-form';

type ChartDraft = { form: DentalChartState; saved: DentalChartState };

export function useDentalChart(appointment: Appointment, opened: boolean) {
  const query = useGetPatientChartQuery(appointment.patientId, {
    skip: !opened,
  });
  const [draft, setDraft] = useState<ChartDraft | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<ToothStatus>('caries');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedSuccessfully, setSavedSuccessfully] = useState(false);
  const [saveChart, mutation] = useSaveDentalChartMutation();
  const mounted = useMounted();
  const lock = useRef(false);
  const editable = appointment.status === 'in_consult';

  // Initialize once; switching tabs and background refetches preserve local changes.
  useEffect(() => {
    if (!draft && query.currentData) {
      const form = dentalChartForm(query.currentData.teeth);
      setDraft({ form, saved: form });
    }
  }, [draft, query.currentData]);

  const changes = draft ? dentalChartChanges(draft.form, draft.saved) : [];
  function change(tooth: ToothNumber) {
    if (!editable || lock.current) return;
    setDraft(current =>
      current
        ? { ...current, form: markTooth(current.form, tooth, selectedStatus) }
        : current,
    );
    setError(null);
    setSavedSuccessfully(false);
  }
  async function reload() {
    if (lock.current) return;
    setError(null);
    try {
      const latest = await query.refetch().unwrap();
      if (!mounted.current) return;
      setDraft(current => {
        const saved = dentalChartForm(latest.teeth);
        const form = { ...saved };
        if (current) {
          for (const pendingChange of dentalChartChanges(
            current.form,
            current.saved,
          )) {
            form[pendingChange.toothNumber] = pendingChange.status;
          }
        }
        return { saved, form };
      });
    } catch (failure) {
      if (mounted.current) setError(errorMessage(failure));
    }
  }
  async function save() {
    if (!editable || lock.current) return false;
    if (!changes.length) return true;
    lock.current = true;
    setSaving(true);
    setError(null);
    setSavedSuccessfully(false);
    let written = false;
    try {
      await saveChart({
        appointmentId: appointment.id,
        patientId: appointment.patientId,
        changes,
      }).unwrap();
      written = true;
      // The save response contains notes, not the chart. Confirm the current chart separately.
      const latest = await query.refetch().unwrap();
      if (mounted.current) {
        const form = dentalChartForm(latest.teeth);
        setDraft({ form, saved: form });
        setSavedSuccessfully(true);
      }
      return true;
    } catch (failure) {
      if (mounted.current)
        setError(
          written
            ? 'Your chart changes were saved, but the latest chart could not be loaded. Try saving again to confirm.'
            : errorMessage(failure),
        );
      return false;
    } finally {
      lock.current = false;
      if (mounted.current) setSaving(false);
      mutation.reset();
    }
  }
  return {
    form: draft?.form,
    selectedStatus,
    selectStatus: setSelectedStatus,
    change,
    save,
    dirty: changes.length > 0,
    changedTeeth: changes.map(tooth => tooth.toothNumber),
    editable,
    saving,
    savedSuccessfully,
    error,
    loadError: query.error ? errorMessage(query.error) : null,
    refreshing: query.isFetching,
    retry: reload,
  };
}
