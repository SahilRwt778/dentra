import { StyleSheet } from 'react-native';
import { colors } from '../../common/theme/theme';

export const patientStyles = StyleSheet.create({
  card: { borderRadius: 12, padding: 16, gap: 10 },
  heading: { fontSize: 16, fontWeight: '600', color: colors.ink },
  body: { fontSize: 14, lineHeight: 21, color: colors.ink },
  muted: { fontSize: 13, lineHeight: 19, color: colors.muted },
});
