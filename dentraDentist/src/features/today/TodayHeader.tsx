import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Wallet } from 'lucide-react-native';
import { colors, layout } from '../../common/theme/theme';
import { ToothIcon } from '../../components/icons/ToothIcon';
import type { StackParamList } from '../../navigation/types';
import { NotificationBell } from '../notifications/NotificationBell';

export function TodayHeader() {
  const navigation = useNavigation<NativeStackNavigationProp<StackParamList>>();
  return (
    <View style={styles.header}>
      <View style={styles.brand}>
        <ToothIcon />
        <Text accessibilityRole="header" style={styles.name}>
          Dentra
        </Text>
      </View>
      <View style={layout.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open Wallet"
          onPress={() => navigation.navigate('Wallet')}
          style={styles.walletButton}
        >
          <Wallet size={23} color={colors.primary} />
        </Pressable>
        <NotificationBell />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 10,
    gap: 12,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontSize: 20, fontWeight: '700', color: colors.ink },
  walletButton: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
});
