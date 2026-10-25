import { StyleSheet } from 'react-native';

// Colours and spacing from the patient prototype in ../index.html.
export const colors = {
  bg: '#F3F7F7',
  surface: '#FFFFFF',
  soft: '#EAF2F2',
  ink: '#10283A',
  muted: '#566977',
  line: '#D6E1E4',
  accent: '#0D7870',
  accentDeep: '#0A5F59',
  accentSoft: '#DCF0EC',
  red: '#BF3028',
  redSoft: '#FBE9E7',
  amber: '#B87305',
  amberSoft: '#FCF1DC',
  green: '#37804C',
  greenSoft: '#E3F2E7',
  blue: '#2C65A8',
  blueSoft: '#E3EDF8',
};

export const ui = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  between: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  grow: { flex: 1, minWidth: 0 },
  stack: { gap: 14 },
  title: {
    color: colors.ink,
    fontSize: 25,
    fontWeight: '600',
    letterSpacing: -0.6,
  },
  heading: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  body: { color: colors.ink, fontSize: 15, lineHeight: 22 },
  muted: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  small: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  label: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  divider: { height: 1, backgroundColor: colors.line, marginVertical: 4 },
});
