import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, layout } from '../../../common/theme/theme';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { ErrorMessage, Loading } from '../../../components/ui/Feedback';
import { consultationStyles as styles } from '../consultation.styles';
import { MedicineEditor } from './MedicineEditor';
import { allergyConflict } from './prescription-form';
import type { usePrescription } from './usePrescription';

export function PrescriptionSection({
  rx,
  disabled,
  onPreview,
}: {
  rx: ReturnType<typeof usePrescription>;
  disabled: boolean;
  onPreview: () => void;
}) {
  return (
    <>
      <Card style={[styles.card, local.allergies]}>
        <Text style={styles.heading}>Patient allergies</Text>
        {rx.allergyError ? (
          <>
            <ErrorMessage message={rx.allergyError} />
            <Button
              title="Reload allergies"
              variant="secondary"
              onPress={rx.retryAllergies}
            />
          </>
        ) : !rx.allergies ? (
          <Loading text="Loading recorded allergies…" />
        ) : (
          <Text style={styles.body}>
            {rx.allergies.allergies || 'No allergies recorded.'}
          </Text>
        )}
      </Card>
      <Card style={styles.card}>
        <View style={layout.between}>
          <Text style={styles.heading}>Prescription</Text>
          {!!rx.signedAt && <Text style={styles.tag}>Signed</Text>}
        </View>
        {!rx.items.length && (
          <Text style={styles.body}>
            No medicines added. A prescription is optional.
          </Text>
        )}
        {rx.items.map((item, index) => {
          const conflict = allergyConflict(
            rx.allergies?.allergies,
            item.medicineName,
          );
          return (
            <View key={index} style={local.medicine}>
              <Text style={local.name}>
                {item.medicineName} {item.strength}
              </Text>
              <Text style={styles.body}>
                {item.dose} · {item.frequency} · {item.duration}
              </Text>
              {!!item.instructions && (
                <Text style={styles.body}>{item.instructions}</Text>
              )}
              {!!conflict && (
                <Text accessibilityRole="alert" style={local.conflict}>
                  Allergy conflict: {conflict}
                </Text>
              )}
              {rx.editable && !rx.editor && (
                <View style={styles.row}>
                  <View style={styles.grow}>
                    <Button
                      title={`Edit medicine ${index + 1}`}
                      variant="secondary"
                      disabled={disabled}
                      onPress={() => rx.edit(index)}
                    />
                  </View>
                  <View style={styles.grow}>
                    <Button
                      title={`Remove medicine ${index + 1}`}
                      variant="danger"
                      disabled={disabled}
                      onPress={() => rx.remove(index)}
                    />
                  </View>
                </View>
              )}
            </View>
          );
        })}
        {rx.editable &&
          (rx.editor ? (
            <MedicineEditor rx={rx} disabled={disabled} />
          ) : (
            <Button
              title="Add medicine"
              variant="secondary"
              disabled={disabled}
              onPress={() => rx.edit(null)}
            />
          ))}
        {rx.items.length > 0 && !rx.editor && (
          <Button
            title={
              rx.signedAt ? 'View signed prescription' : 'Preview and sign'
            }
            disabled={
              disabled ||
              (!rx.signedAt && (!rx.allergies || !!rx.allergyError)) ||
              (!rx.editable && !rx.signedAt)
            }
            onPress={onPreview}
          />
        )}
        {rx.editable && (
          <Text style={styles.body}>
            Preview saves the clinical note and medicine list before signing.
            Patient access is available after the visit is completed.
          </Text>
        )}
        {!!rx.signedAt && (
          <Text style={styles.body}>
            Signed prescriptions cannot be edited.
          </Text>
        )}
        <ErrorMessage message={rx.error} />
      </Card>
    </>
  );
}
const local = StyleSheet.create({
  allergies: { backgroundColor: colors.amberSoft },
  medicine: {
    gap: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderColor: colors.line,
  },
  name: { color: colors.ink, fontWeight: '700', fontSize: 15 },
  conflict: { color: colors.danger, fontWeight: '600', lineHeight: 21 },
});
