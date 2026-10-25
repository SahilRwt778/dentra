import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { ToothFinding } from '../../common/types/dental-chart';
import { colors } from '../../common/theme/theme';
import { Card } from '../../components/ui/Card';
import { ToothIcon } from '../../components/icons/ToothIcon';
import { patientStyles } from './patient-styles';
import { DentalChart } from '../consultation/dental-chart/DentalChart';
import { dentalChartForm } from '../consultation/dental-chart/dental-chart-form';
import {
  TOOTH_OPTIONS,
  toothOption,
} from '../consultation/dental-chart/tooth-options';

export function PatientDentalChart({ teeth }: { teeth: ToothFinding[] }) {
  const findings = teeth
    .filter(tooth => tooth.status !== 'healthy')
    .sort((a, b) => a.toothNumber.localeCompare(b.toothNumber));
  return (
    <Card style={patientStyles.card}>
      <Text style={patientStyles.heading}>Dental chart</Text>
      <Text style={patientStyles.muted}>
        Current patient chart across visits. Swipe sideways to see all teeth.
      </Text>
      <DentalChart
        form={dentalChartForm(teeth)}
        changedTeeth={[]}
        editable={false}
        onTooth={() => {}}
      />
      <View style={styles.legend}>
        {TOOTH_OPTIONS.map(option => (
          <View key={option.value} style={styles.legendItem}>
            <ToothIcon
              size={16}
              color={option.color}
              fill={option.value === 'missing' ? 'none' : option.background}
              dashed={option.value === 'missing'}
            />
            <Text style={patientStyles.muted}>{option.label}</Text>
          </View>
        ))}
      </View>
      {findings.length ? (
        findings.map(tooth => (
          <Text key={tooth.toothNumber} style={patientStyles.body}>
            Tooth {tooth.toothNumber} · {toothOption(tooth.status).label}
          </Text>
        ))
      ) : (
        <Text style={patientStyles.muted}>No findings recorded.</Text>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    borderBottomWidth: 1,
    borderColor: colors.line,
    paddingBottom: 14,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
