import { useEffect, useRef, useState } from 'react';
import type { Appointment } from '../../../common/types/api';
import type { Consultation } from '../../../common/types/consultation';
import type { ProcedureForm } from '../../../common/types/treatment-plan';
import { useMounted } from '../../../common/hooks/useMounted';
import { errorMessage } from '../../../common/utils/api-error';
import { useSaveTreatmentPlanMutation } from '../../../store/dentraApi';
import {
  procedureForm,
  treatmentPlanChanges,
  treatmentPlanForm,
  validateProcedure,
} from './treatment-plan-form';

type ProcedureEditor = {
  index: number | null;
  form: ProcedureForm;
  initial: ProcedureForm;
};

export function useTreatmentPlan(
  appointment: Appointment,
  consultation: Consultation,
) {
  const [draft, setDraft] = useState(() => {
    const form = treatmentPlanForm(consultation);
    return { form, saved: form };
  });
  const [editor, setEditor] = useState<ProcedureEditor | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedSuccessfully, setSavedSuccessfully] = useState(false);
  const [savePlan, mutation] = useSaveTreatmentPlanMutation();
  const lock = useRef(false);
  const mounted = useMounted();
  const seen = useRef(JSON.stringify(treatmentPlanForm(consultation)));
  const editable = appointment.status === 'in_consult';
  const changes = treatmentPlanChanges(draft.form, draft.saved);
  const formDirty = Object.keys(changes).length > 0;
  const editorDirty =
    !!editor && JSON.stringify(editor.form) !== JSON.stringify(editor.initial);

  useEffect(() => {
    const incoming = treatmentPlanForm(consultation);
    const fingerprint = JSON.stringify(incoming);
    if (fingerprint === seen.current) return;
    if (editor) return;
    seen.current = fingerprint;
    setDraft(current =>
      Object.keys(treatmentPlanChanges(current.form, current.saved)).length
        ? current
        : { form: incoming, saved: incoming },
    );
  }, [consultation, editor]);

  function advice(value: string) {
    if (!editable || lock.current) return;
    setDraft(current => ({
      ...current,
      form: { ...current.form, plan: value },
    }));
    setError(null);
    setSavedSuccessfully(false);
  }
  function followUpDate(value: string | null) {
    if (!editable || lock.current) return;
    setDraft(current => ({
      ...current,
      form: { ...current.form, followUpDate: value },
    }));
    setError(null);
    setSavedSuccessfully(false);
  }
  function edit(index: number | null) {
    if (!editable || lock.current) return;
    if (index === null && draft.form.planItems.length >= 20) {
      setError('A treatment plan can contain up to 20 procedures.');
      return;
    }
    const form = procedureForm(
      index === null ? undefined : draft.form.planItems[index],
    );
    setEditor({ index, form, initial: form });
    setError(null);
  }
  function change(fields: Partial<ProcedureForm>) {
    if (!editable || lock.current) return;
    setEditor(current =>
      current ? { ...current, form: { ...current.form, ...fields } } : current,
    );
    setError(null);
  }
  function commit() {
    if (!editable || lock.current || !editor) return;
    try {
      const item = validateProcedure(editor.form);
      setDraft(current => ({
        ...current,
        form: {
          ...current.form,
          planItems:
            editor.index === null
              ? [...current.form.planItems, item]
              : current.form.planItems.map((value, index) =>
                  index === editor.index ? item : value,
                ),
        },
      }));
      setEditor(null);
      setError(null);
      setSavedSuccessfully(false);
    } catch (failure) {
      setError(errorMessage(failure));
    }
  }
  function remove(index: number) {
    if (!editable || lock.current || editor) return;
    setDraft(current => ({
      ...current,
      form: {
        ...current.form,
        planItems: current.form.planItems.filter(
          (_item, position) => position !== index,
        ),
      },
    }));
    setError(null);
    setSavedSuccessfully(false);
  }
  async function save() {
    if (!editable || lock.current || editor) return false;
    if (!formDirty) return true;
    lock.current = true;
    setError(null);
    setSavedSuccessfully(false);
    try {
      const result = await savePlan({
        appointmentId: appointment.id,
        changes,
      }).unwrap();
      if (mounted.current) {
        const form = treatmentPlanForm(result);
        seen.current = JSON.stringify(form);
        setDraft({ form, saved: form });
        setSavedSuccessfully(true);
      }
      return true;
    } catch (failure) {
      if (mounted.current) setError(errorMessage(failure));
      return false;
    } finally {
      lock.current = false;
      mutation.reset();
    }
  }
  return {
    form: draft.form,
    editor,
    editable,
    advice,
    followUpDate,
    edit,
    change,
    commit,
    remove,
    save,
    cancel: () => {
      if (!lock.current) {
        setEditor(null);
        setError(null);
      }
    },
    dirty: formDirty || editorDirty,
    saving: mutation.isLoading,
    savedSuccessfully,
    error,
    canSave: formDirty && !editor,
  };
}
