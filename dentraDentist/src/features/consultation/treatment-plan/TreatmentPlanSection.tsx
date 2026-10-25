import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Pencil, Trash2 } from 'lucide-react-native';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Field } from '../../../components/forms/Field';
import { DateField } from '../../../components/forms/DateField';
import { ErrorMessage } from '../../../components/ui/Feedback';
import { colors } from '../../../common/theme/theme';
import { consultationStyles as styles } from '../consultation.styles';
import { estimatedCost } from './treatment-plan-form';
import { ProcedureEditor } from './ProcedureEditor';
import type { useTreatmentPlan } from './useTreatmentPlan';

export function TreatmentPlanSection({
  plan,
  disabled,
}: {
  plan: ReturnType<typeof useTreatmentPlan>;
  disabled: boolean;
}) {
  const items = plan.form.planItems;
  const priced = items.filter(item => item.estimatedCostPaise != null);
  const total = priced.reduce((sum, item) => sum + item.estimatedCostPaise!, 0);
  return (
    <>
      <Card style={styles.card}>
        <Text style={styles.heading}>Treatment plan</Text>
        <Text style={styles.body}>
          Procedures and estimates to discuss with your patient.
        </Text>
        {items.length ? (
          items.map((item, index) => (
            <View key={index} style={local.procedure}>
              <View style={styles.row}>
                <Text style={[styles.heading, local.name]}>
                  {index + 1}. {item.procedure}
                </Text>
                {plan.editable && !plan.editor && (
                  <View style={local.actions}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Edit procedure ${index + 1}`}
                      accessibilityState={{ disabled }}
                      disabled={disabled}
                      onPress={() => plan.edit(index)}
                      style={local.action}
                    >
                      <Pencil size={19} color={colors.primary} />
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Remove procedure ${index + 1}`}
                      accessibilityState={{ disabled }}
                      disabled={disabled}
                      onPress={() => plan.remove(index)}
                      style={local.action}
                    >
                      <Trash2 size={19} color={colors.danger} />
                    </Pressable>
                  </View>
                )}
              </View>
              <Text style={styles.body}>
                {item.teeth.length
                  ? `Teeth: ${item.teeth.join(', ')}`
                  : 'General treatment'}
              </Text>
              <Text style={styles.tag}>
                {item.estimatedCostPaise == null
                  ? 'Cost not estimated'
                  : estimatedCost(item.estimatedCostPaise)}
              </Text>
            </View>
          ))
        ) : (
          <Text style={styles.body}>No procedures added.</Text>
        )}
        {!!priced.length && (
          <>
            <Text style={styles.heading}>
              Estimated total: {estimatedCost(total)}
            </Text>
            {priced.length < items.length && (
              <Text style={styles.body}>
                Some procedures do not have an estimate.
              </Text>
            )}
          </>
        )}
        {plan.editable &&
          (plan.editor ? (
            <ProcedureEditor plan={plan} disabled={disabled} />
          ) : (
            <Button
              title="Add procedure"
              variant="secondary"
              disabled={disabled || items.length >= 20}
              onPress={() => plan.edit(null)}
            />
          ))}
        <ErrorMessage message={plan.error} />
      </Card>
      <Card style={styles.card}>
        <Field
          label="Plan and advice for the patient"
          value={plan.form.plan}
          placeholder="Written in simple words. The patient sees this in their app."
          multiline
          style={styles.multiline}
          editable={plan.editable && !disabled}
          onChangeText={plan.advice}
        />
        <DateField
          label="Follow-up date"
          value={plan.form.followUpDate}
          onChange={plan.followUpDate}
          disabled={!plan.editable || disabled}
        />
      </Card>
    </>
  );
}
const local = StyleSheet.create({
  name: { flex: 1 },
  actions: { flexDirection: 'row', gap: 4 },
  action: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
  },
  procedure: {
    gap: 8,
    borderTopWidth: 1,
    borderColor: colors.line,
    paddingTop: 14,
  },
});
