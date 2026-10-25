import { StyleSheet } from 'react-native';
export const colors = {
  background: '#F3F8F7',
  surface: '#FFFFFF',
  ink: '#143040',
  muted: '#617684',
  primary: '#0C7D76',
  primarySoft: '#DEF1ED',
  line: '#D7E4E7',
  danger: '#C63430',
  dangerSoft: '#FCECEA',
  amber: '#8B641D',
  amberSoft: '#FFF4DA',
};
export const layout = StyleSheet.create({
  grow: { flex: 1 },
  fill: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, gap: 20, paddingBottom: 32 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  between: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  stack: { gap: 14 },
  title: { fontSize: 28, fontWeight: '700', color: colors.ink, lineHeight: 36 },
  heading: { fontSize: 19, fontWeight: '700', color: colors.ink },
  body: { fontSize: 16, color: colors.ink, lineHeight: 24 },
  muted: { fontSize: 14, color: colors.muted, lineHeight: 21 },
  label: { fontSize: 14, fontWeight: '600', color: colors.ink },
});
