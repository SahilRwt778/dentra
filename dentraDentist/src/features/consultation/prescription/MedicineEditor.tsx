import React from 'react';
import { Text } from 'react-native';
import type { usePrescription } from './usePrescription';
import { Field } from '../../../components/forms/Field';
import { Button } from '../../../components/ui/Button';
import { consultationStyles as styles } from '../consultation.styles';

export function MedicineEditor({
  rx,
  disabled,
}: {
  rx: ReturnType<typeof usePrescription>;
  disabled: boolean;
}) {
  if (!rx.editor) return null;
  const form = rx.editor.form;
  return (
    <>
      <Text style={styles.heading}>
        {rx.editor.index === null ? 'Add medicine' : 'Edit medicine'}
      </Text>
      <Field
        label="Medicine (generic name)"
        value={form.medicineName}
        editable={!disabled}
        onChangeText={value => rx.change('medicineName', value)}
      />
      <Field
        label="Strength / form (optional)"
        value={form.strength}
        editable={!disabled}
        onChangeText={value => rx.change('strength', value)}
      />
      <Field
        label="Dose"
        value={form.dose}
        editable={!disabled}
        onChangeText={value => rx.change('dose', value)}
      />
      <Field
        label="How often"
        value={form.frequency}
        editable={!disabled}
        onChangeText={value => rx.change('frequency', value)}
      />
      <Field
        label="For how long"
        value={form.duration}
        editable={!disabled}
        onChangeText={value => rx.change('duration', value)}
      />
      <Field
        label="Instructions (optional)"
        value={form.instructions}
        multiline
        editable={!disabled}
        onChangeText={value => rx.change('instructions', value)}
      />
      <Button
        title={
          rx.editor.index === null ? 'Add to prescription' : 'Update medicine'
        }
        disabled={disabled}
        onPress={rx.commit}
      />
      <Button
        title="Cancel medicine edit"
        variant="secondary"
        disabled={disabled}
        onPress={rx.cancel}
      />
    </>
  );
}
