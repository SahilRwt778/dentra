import { StyleSheet } from 'react-native';
import { colors } from '../../common/theme/theme';

export const consultationStyles = StyleSheet.create({
  card: { borderRadius: 14, padding: 16, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  grow: { flex: 1, gap: 4 },
  heading: { fontSize: 16, fontWeight: '700', color: colors.ink },
  body: { fontSize: 14, lineHeight: 21, color: colors.muted },
  avatar: {
    height: 46,
    width: 46,
    borderRadius: 23,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: { color: colors.primary, fontSize: 17, fontWeight: '700' },
  tag: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primarySoft,
    color: colors.primary,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 12,
    fontSize: 13,
    fontWeight: '600',
    overflow: 'hidden',
  },
  multiline: { minHeight: 110, textAlignVertical: 'top' },
  message: { color: colors.primary, fontSize: 13, lineHeight: 20 },
});
