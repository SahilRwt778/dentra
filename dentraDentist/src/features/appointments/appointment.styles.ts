import { StyleSheet } from 'react-native';
import { colors } from '../../common/theme/theme';

export const appointmentStyles = StyleSheet.create({
  card: { borderRadius: 12, padding: 16, gap: 10 },
  heading: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
  },
  body: { color: colors.ink, fontSize: 14, lineHeight: 21 },
  muted: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  label: { color: colors.ink, fontSize: 13, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  between: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  grow: { flex: 1, gap: 3 },
  stack: { gap: 10 },
  detail: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  detailLabel: {
    width: '28%',
    color: colors.muted,
    fontSize: 13,
    lineHeight: 21,
  },
  detailValue: { flex: 1, color: colors.ink, fontSize: 14, lineHeight: 21 },
});
