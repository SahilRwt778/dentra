import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, layout } from '../../common/theme/theme';
export function Screen({
  title,
  subtitle,
  children,
  action,
  compactHeader = false,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  compactHeader?: boolean;
}) {
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={layout.fill}>
      <View style={[styles.header, compactHeader && styles.compactHeader]}>
        <View style={styles.titles}>
          <Text style={[styles.title, compactHeader && styles.compactTitle]}>
            {title}
          </Text>
          {subtitle && <Text style={layout.muted}>{subtitle}</Text>}
        </View>
        {action}
      </View>
      {children}
    </SafeAreaView>
  );
}
export function FormScreen({ children }: { children: React.ReactNode }) {
  return (
    <SafeAreaView style={layout.fill}>
      <KeyboardAvoidingView
        style={layout.fill}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={layout.content}
          automaticallyAdjustKeyboardInsets
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  titles: { flex: 1, gap: 5 },
  title: { color: colors.ink, fontSize: 24, fontWeight: '700' },
  compactHeader: {
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 10,
    borderBottomWidth: 0,
    backgroundColor: colors.background,
  },
  compactTitle: { fontSize: 20, fontWeight: '600' },
});
