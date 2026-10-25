import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ToothNumber } from '../../../common/types/dental-chart';
import { colors, layout } from '../../../common/theme/theme';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { ErrorMessage, Loading } from '../../../components/ui/Feedback';
import { consultationStyles as styles } from '../consultation.styles';
import type { useDentalChart } from './useDentalChart';
import { DentalChart } from './DentalChart';
import { ToothLegend } from './ToothLegend';
import { toothOption } from './tooth-options';

export function DentalChartSection({
  chart,
  disabled = false,
}: {
  chart: ReturnType<typeof useDentalChart>;
  disabled?: boolean;
}) {
  if (!chart.form)
    return (
      <Card style={styles.card}>
        {chart.loadError ? (
          <>
            <ErrorMessage message={chart.loadError} />
            <Button
              title="Reload dental chart"
              variant="secondary"
              loading={chart.refreshing}
              onPress={chart.retry}
            />
          </>
        ) : (
          <Loading text="Loading dental chart…" />
        )}
      </Card>
    );
  const form = chart.form;
  const summary = (Object.keys(form) as ToothNumber[])
    .filter(
      tooth => form[tooth] !== 'healthy' || chart.changedTeeth.includes(tooth),
    )
    .sort();
  return (
    <Card style={styles.card}>
      <View style={layout.between}>
        <Text style={styles.heading}>Dental chart</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Refresh dental chart"
          disabled={disabled || chart.saving || chart.refreshing}
          onPress={chart.retry}
          style={summaryStyles.refresh}
        >
          <Text style={summaryStyles.refreshText}>
            {chart.refreshing ? 'Loading…' : 'Refresh'}
          </Text>
        </Pressable>
      </View>
      <Text style={styles.body}>
        {chart.editable
          ? 'Pick a status, then tap teeth. Swipe sideways to see the whole mouth.'
          : 'Current patient chart, including changes from other visits. This visit is read-only.'}
      </Text>
      <ToothLegend
        selected={chart.selectedStatus}
        onSelect={chart.selectStatus}
        disabled={disabled || !chart.editable || chart.saving}
      />
      <DentalChart
        form={form}
        changedTeeth={chart.changedTeeth}
        editable={!disabled && chart.editable && !chart.saving}
        onTooth={chart.change}
      />
      <View style={summaryStyles.divider} />
      {!summary.length ? (
        <Text style={styles.body}>No findings marked.</Text>
      ) : (
        summary.map(tooth => (
          <Text key={tooth} style={summaryStyles.finding}>
            <Text style={summaryStyles.number}>{tooth}</Text> ·{' '}
            {toothOption(form[tooth] ?? 'healthy').label}
            {chart.changedTeeth.includes(tooth) ? ' · Unsaved' : ''}
          </Text>
        ))
      )}
      {chart.editable && (
        <Text style={styles.body}>
          Tap a marked tooth again or choose Healthy to clear a finding. Saved
          changes update the patient's current chart.
        </Text>
      )}
      <ErrorMessage message={chart.error || chart.loadError} />
    </Card>
  );
}
const summaryStyles = StyleSheet.create({
  refresh: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 6 },
  refreshText: { color: colors.primary, fontSize: 14, fontWeight: '600' },
  divider: { height: 1, backgroundColor: colors.line },
  finding: { fontSize: 13, color: colors.ink, lineHeight: 20 },
  number: { fontWeight: '700' },
});
