import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../../common/theme/theme';
import { patientInitials } from './patient-format';

export function PatientAvatar({
  name,
  large = false,
}: {
  name: string;
  large?: boolean;
}) {
  return (
    <View style={[styles.avatar, large && styles.large]}>
      <Text style={[styles.initials, large && styles.largeInitials]}>
        {patientInitials(name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: { color: colors.primary, fontSize: 14, fontWeight: '600' },
  large: { width: 56, height: 56, borderRadius: 28 },
  largeInitials: { fontSize: 18 },
});
