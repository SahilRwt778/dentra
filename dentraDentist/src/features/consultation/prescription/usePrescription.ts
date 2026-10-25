import { useEffect, useRef, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { StackParamList } from '../../../navigation/types';
import type { Appointment } from '../../../common/types/api';
import type { Consultation } from '../../../common/types/consultation';
import type {
  MedicineForm,
  Prescription,
} from '../../../common/types/prescription';
import { useMounted } from '../../../common/hooks/useMounted';
import { useScreenActive } from '../../../common/hooks/useScreenActive';
import { errorMessage } from '../../../common/utils/api-error';
import { consultationsApi } from '../../../api/consultations.api';
import {
  useGetPatientAllergiesQuery,
  useSavePrescriptionMutation,
} from '../../../store/dentraApi';
import {
  medicineForm,
  prescriptionFingerprint,
  sameMedicines,
  validateMedicine,
} from './prescription-form';

type MedicineEditor = {
  index: number | null;
  form: MedicineForm;
  initial: MedicineForm;
};
function draftFrom(prescription: Prescription | null) {
  const items = (prescription?.items ?? []).map(medicineForm);
  return { items, saved: items, signedAt: prescription?.signedAt ?? null };
}

export function usePrescription(
  appointment: Appointment,
  consultation: Consultation,
  opened: boolean,
) {
  const [draft, setDraft] = useState(() =>
    draftFrom(consultation.prescription),
  );
  const [editor, setEditor] = useState<MedicineEditor | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedSuccessfully, setSavedSuccessfully] = useState(false);
  const [savePrescription, mutation] = useSavePrescriptionMutation();
  const allergies = useGetPatientAllergiesQuery(appointment.patientId, {
    skip: !opened,
  });
  const seen = useRef(prescriptionFingerprint(consultation.prescription));
  const lock = useRef(false);
  const mounted = useMounted();
  const active = useScreenActive();
  const navigation = useNavigation<NativeStackNavigationProp<StackParamList>>();
  const editable = appointment.status === 'in_consult' && !draft.signedAt;
  const itemsDirty = !sameMedicines(draft.items, draft.saved);
  const editorDirty =
    !!editor && JSON.stringify(editor.form) !== JSON.stringify(editor.initial);

  useEffect(() => {
    const incoming = consultation.prescription;
    const fingerprint = prescriptionFingerprint(incoming);
    if (fingerprint === seen.current) return;
    seen.current = fingerprint;
    if (incoming?.signedAt) {
      setDraft(draftFrom(incoming));
      setEditor(null);
      setError('This prescription is signed. Its medicine list is read-only.');
    } else {
      if (editor) return;
      setDraft(current =>
        sameMedicines(current.items, current.saved)
          ? draftFrom(incoming)
          : current,
      );
    }
  }, [consultation.prescription, editor]);

  function edit(index: number | null) {
    if (!editable || lock.current) return;
    const form = medicineForm(index === null ? undefined : draft.items[index]);
    setEditor({ index, form, initial: form });
    setError(null);
  }
  function change(field: keyof MedicineForm, value: string) {
    if (!editable || lock.current) return;
    setEditor(current =>
      current
        ? { ...current, form: { ...current.form, [field]: value } }
        : current,
    );
    setError(null);
  }
  function commit() {
    if (!editable || lock.current || !editor) return;
    try {
      const item = validateMedicine(editor.form);
      setDraft(current => ({
        ...current,
        items:
          editor.index === null
            ? [...current.items, item]
            : current.items.map((value, index) =>
                index === editor.index ? item : value,
              ),
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
      items: current.items.filter((_item, position) => position !== index),
    }));
    setError(null);
    setSavedSuccessfully(false);
  }
  function adopt(prescription: Prescription | null) {
    seen.current = prescriptionFingerprint(prescription);
    setDraft(draftFrom(prescription));
    setEditor(null);
  }
  async function persist(preview: boolean) {
    if (lock.current || editor || (!editable && !draft.signedAt)) return false;
    if (!preview && !itemsDirty) return true;
    lock.current = true;
    setSaving(true);
    setError(null);
    setSavedSuccessfully(false);
    try {
      const result = itemsDirty
        ? await savePrescription({
            appointmentId: appointment.id,
            items: draft.items.map(validateMedicine),
          }).unwrap()
        : await consultationsApi.get(appointment.id);
      if (!mounted.current) return false;
      adopt(result.prescription);
      setSavedSuccessfully(true);
      if (preview && active.current)
        navigation.navigate('PrescriptionPreview', {
          appointmentId: appointment.id,
        });
      return true;
    } catch (failure) {
      if (mounted.current) setError(errorMessage(failure));
      return false;
    } finally {
      lock.current = false;
      if (mounted.current) setSaving(false);
      mutation.reset();
    }
  }
  return {
    items: draft.items,
    signedAt: draft.signedAt,
    editor,
    edit,
    change,
    commit,
    remove,
    cancel: () => {
      if (!lock.current) {
        setEditor(null);
        setError(null);
      }
    },
    save: () => persist(false),
    preview: () => persist(true),
    dirty: editable && (itemsDirty || editorDirty),
    canSave: itemsDirty && !editor,
    editable,
    saving,
    savedSuccessfully,
    error,
    allergies: allergies.currentData,
    allergyError: allergies.error ? errorMessage(allergies.error) : null,
    retryAllergies: allergies.refetch,
  };
}
