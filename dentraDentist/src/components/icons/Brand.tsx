import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Toothbrush } from 'lucide-react-native';
import { colors } from '../../common/theme/theme';
export function Brand() {
  return (
    <View style={styles.row}>
      <View style={styles.icon}>
        <Toothbrush size={25} color={colors.primary} />
      </View>
      <Text style={styles.name}>
        Dentra<Text style={styles.role}> DENTIST</Text>
      </Text>
    </View>
  );
}
const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    marginVertical: 16,
  },
  icon: { padding: 10, borderRadius: 14, backgroundColor: colors.primarySoft },
  name: { fontSize: 25, fontWeight: '700', color: colors.ink },
  role: { fontSize: 11, letterSpacing: 1.6, color: colors.primary },
});
