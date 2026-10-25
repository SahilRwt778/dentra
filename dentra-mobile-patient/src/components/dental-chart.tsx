import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Tooth } from './tooth-icon';
import type { ChartEntry } from '@/api/types';
import { colors, ui } from '@/theme';

const statuses: Record<
  string,
  { label: string; color: string; background: string }
> = {
  healthy: {
    label: 'Healthy',
    color: colors.green,
    background: colors.greenSoft,
  },
  caries: { label: 'Caries', color: colors.red, background: colors.redSoft },
  filled: { label: 'Filled', color: colors.blue, background: colors.blueSoft },
  crown: { label: 'Crown', color: '#6B4FA3', background: '#EEE8F7' },
  rct: {
    label: 'Root canal',
    color: colors.amber,
    background: colors.amberSoft,
  },
  missing: { label: 'Missing', color: colors.muted, background: colors.soft },
  extract: {
    label: 'Extraction advised',
    color: colors.red,
    background: colors.redSoft,
  },
};
const upper = [
  '18',
  '17',
  '16',
  '15',
  '14',
  '13',
  '12',
  '11',
  '21',
  '22',
  '23',
  '24',
  '25',
  '26',
  '27',
  '28',
];
const lower = [
  '48',
  '47',
  '46',
  '45',
  '44',
  '43',
  '42',
  '41',
  '31',
  '32',
  '33',
  '34',
  '35',
  '36',
  '37',
  '38',
];
export function DentalChart({ entries }: { entries: ChartEntry[] }) {
  const map = new Map(entries.map(e => [e.toothNumber, e.status]));
  return (
    <View style={ui.stack}>
      <Text style={ui.muted}>
        Your dentist updates this chart after a visit. Swipe across to see all
        teeth.
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator>
        <View style={s.chart}>
          {[upper, lower].map((row, index) => (
            <View key={index} style={ui.stack}>
              <Text style={ui.small}>
                {index === 0 ? 'Upper teeth' : 'Lower teeth'} · patient’s right
                → left
              </Text>
              <View style={s.row}>
                {row.map(tooth => {
                  const state = statuses[map.get(tooth) ?? ''];
                  return (
                    <View
                      key={tooth}
                      accessible
                      accessibilityLabel={`Tooth ${tooth}: ${
                        state?.label ?? 'Not recorded'
                      }`}
                      style={[
                        s.tooth,
                        {
                          backgroundColor: state?.background ?? colors.surface,
                        },
                      ]}
                    >
                      <Tooth size={22} color={state?.color ?? colors.line} />
                      <Text style={ui.small}>{tooth}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
      <View style={ui.wrap}>
        {Object.entries(statuses).map(([key, state]) => (
          <View key={key} style={ui.row}>
            <View style={[s.dot, { backgroundColor: state.color }]} />
            <Text style={ui.small}>{state.label}</Text>
          </View>
        ))}
      </View>
      {entries.length ? (
        entries.map(entry => (
          <Text key={entry.toothNumber} style={ui.muted}>
            Tooth {entry.toothNumber}:{' '}
            {statuses[entry.status ?? '']?.label ?? 'Not recorded'}
          </Text>
        ))
      ) : (
        <Text style={ui.muted}>
          No chart entries recorded yet. Unmarked teeth have no recorded
          assessment.
        </Text>
      )}
    </View>
  );
}
const s = StyleSheet.create({
  chart: { gap: 20, paddingVertical: 8 },
  row: { flexDirection: 'row', gap: 4 },
  tooth: {
    width: 34,
    paddingVertical: 9,
    alignItems: 'center',
    gap: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
