import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { StackParamList } from '../../navigation/types';
import { colors } from '../../common/theme/theme';

export function PatientProfileLink({
  patientId,
  compact = false,
}: {
  patientId: string;
  compact?: boolean;
}) {
  const navigation = useNavigation<NativeStackNavigationProp<StackParamList>>();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="View patient profile"
      onPress={() => navigation.navigate('PatientRecord', { patientId })}
      style={[styles.link, compact && styles.compact]}
    >
      <Text style={styles.text}>
        {compact ? 'Profile' : 'View patient profile'}
      </Text>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  link: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
  compact: {
    alignSelf: 'center',
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
  },
  text: { color: colors.primary, fontSize: 14, fontWeight: '600' },
});
