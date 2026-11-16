import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Dentist } from '../../common/types/api';
import { colors } from '../../common/theme/theme';
import { Card } from '../../components/ui/Card';
import { settingsStyles } from '../settings/settings-ui';

export function ProfileDetailsCard({ dentist }: { dentist: Dentist }) {
  const details = [
    ['Qualification', dentist.qualification],
    ['Registration', dentist.councilRegNo],
    [
      'Experience',
      `${dentist.yearsExperience} ${
        dentist.yearsExperience === 1 ? 'year' : 'years'
      }`,
    ],
    ['Languages', dentist.languages.join(', ')],
    ['Email', dentist.email],
    ['Mobile', dentist.mobile],
  ];
  return (
    <Card style={settingsStyles.card}>
      <Text accessibilityRole="header" style={settingsStyles.heading}>
        Professional details
      </Text>
      {details.map(([label, value]) => (
        <View key={label} style={styles.row}>
          <Text style={styles.label}>{label}</Text>
          <Text style={styles.value}>{value || 'Not added'}</Text>
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  label: {
    width: 90,
    flexShrink: 0,
    color: colors.muted,
    fontSize: 13,
    lineHeight: 21,
  },
  value: { flex: 1, color: colors.ink, fontSize: 14, lineHeight: 21 },
});
