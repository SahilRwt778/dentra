import { useRef, useState } from 'react';
import type { Appointment } from '../../common/types/api';
import type {
  ClinicalNote,
  Consultation,
} from '../../common/types/consultation';
import { useMounted } from '../../common/hooks/useMounted';
import { errorMessage } from '../../common/utils/api-error';
import { useSaveClinicalNoteMutation } from '../../store/dentraApi';
import { clinicalNoteChanges, clinicalNoteForm } from './clinical-note-form';

export function useClinicalNote(
  appointment: Appointment,
  consultation: Consultation,
) {
  // Seed once. A query refresh must never replace unsaved clinical work.
  const [form, setForm] = useState(() => clinicalNoteForm(consultation));
  const [saved, setSaved] = useState(form);
  const [error, setError] = useState<string | null>(null);
  const [savedSuccessfully, setSavedSuccessfully] = useState(false);
  const [saveNote, saving] = useSaveClinicalNoteMutation();
  const lock = useRef(false);
  const mounted = useMounted();
  const editable = appointment.status === 'in_consult';
  const changes = clinicalNoteChanges(form, saved);
  const dirty = Object.keys(changes).length > 0;

  function change(field: keyof ClinicalNote, value: string) {
    if (!editable || lock.current) return;
    setForm(current => ({ ...current, [field]: value }));
    setError(null);
    setSavedSuccessfully(false);
  }

  async function save() {
    if (lock.current || !editable) return false;
    if (!dirty) return true;
    lock.current = true;
    setError(null);
    setSavedSuccessfully(false);
    try {
      const result = await saveNote({
        appointmentId: appointment.id,
        changes,
      }).unwrap();
      if (mounted.current) {
        const next = clinicalNoteForm(result);
        setSaved(next);
        setForm(next);
        setSavedSuccessfully(true);
      }
      return true;
    } catch (failure) {
      if (mounted.current) setError(errorMessage(failure));
      return false;
    } finally {
      lock.current = false;
      saving.reset();
    }
  }

  return {
    form,
    change,
    save,
    dirty,
    error,
    editable,
    saving: saving.isLoading,
    savedSuccessfully,
  };
}
