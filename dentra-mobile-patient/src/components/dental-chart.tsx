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
  // Match the dentist chart so the same finding keeps its colour and name.
  caries: { label: 'Cavity', color: '#8B641D', background: '#FFF4DA' },
  filled: { label: 'Filled', color: '#3979A8', background: '#E8F2FC' },
  crown: { label: 'Crown', color: '#0C7D76', background: '#DEF1ED' },
  rct: {
    label: 'Root canal treated',
    color: '#7758AE',
    background: '#F0EBFA',
  },
  missing: { label: 'Missing', color: colors.muted, background: colors.soft },
  extract: {
    label: 'To be extracted',
    color: '#C63430',
    background: '#FCECEA',
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
                  const status = map.get(tooth);
                  const state = statuses[status ?? ''];
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
                          borderColor: state?.color ?? colors.line,
                        },
                      ]}
                    >
                      <Tooth size={22} color={state?.color ?? colors.line} />
                      <Text
                        style={[
                          ui.small,
                          state && [s.recorded, { color: state.color }],
                        ]}
                      >
                        {tooth}
                      </Text>
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
            <Text
              style={[
                s.recorded,
                {
                  color: statuses[entry.status ?? '']?.color ?? colors.muted,
                },
              ]}
            >
              {statuses[entry.status ?? '']?.label ?? 'Not recorded'}
            </Text>
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
  recorded: { fontWeight: '600' },
});
