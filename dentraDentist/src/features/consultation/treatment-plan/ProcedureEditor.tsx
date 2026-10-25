import React from 'react';
import { Text } from 'react-native';
import type { useTreatmentPlan } from './useTreatmentPlan';
import { Field } from '../../../components/forms/Field';
import { Button } from '../../../components/ui/Button';
import { TreatmentTeethPicker } from './TreatmentTeethPicker';
import { consultationStyles as styles } from '../consultation.styles';

export function ProcedureEditor({
  plan,
  disabled,
}: {
  plan: ReturnType<typeof useTreatmentPlan>;
  disabled: boolean;
}) {
  if (!plan.editor) return null;
  const form = plan.editor.form;
  return (
    <>
      <Text style={styles.heading}>
        {plan.editor.index === null ? 'Add procedure' : 'Edit procedure'}
      </Text>
      <Field
        label="Procedure"
        value={form.procedure}
        maxLength={200}
        editable={!disabled}
        onChangeText={procedure => plan.change({ procedure })}
      />
      <Text style={styles.heading}>Teeth (optional)</Text>
      <Text style={styles.body}>
        Tap the teeth for this procedure. Leave empty for general treatment.
      </Text>
      <TreatmentTeethPicker
        selected={form.teeth}
        disabled={disabled}
        onChange={teeth => plan.change({ teeth })}
      />
      <Field
        label="Estimated cost (₹, optional)"
        keyboardType="decimal-pad"
        value={form.estimatedCost}
        maxLength={12}
        editable={!disabled}
        onChangeText={estimatedCost => plan.change({ estimatedCost })}
      />
      <Text style={styles.body}>
        Total estimate for this procedure, including the selected teeth.
      </Text>
      <Button
        title={
          plan.editor.index === null
            ? 'Add to treatment plan'
            : 'Update procedure'
        }
        disabled={disabled}
        onPress={plan.commit}
      />
      <Button
        title="Cancel procedure edit"
        variant="secondary"
        disabled={disabled}
        onPress={plan.cancel}
      />
    </>
  );
}
