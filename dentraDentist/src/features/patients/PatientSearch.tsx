import React from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Search, X } from 'lucide-react-native';
import { colors } from '../../common/theme/theme';

export function PatientSearch({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <View style={styles.container}>
      <View style={styles.search}>
        <Search size={18} color={colors.muted} />
        <TextInput
          accessibilityLabel="Search patients"
          placeholder="Search by name or phone"
          placeholderTextColor={colors.muted}
          value={value}
          onChangeText={onChange}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          style={styles.input}
        />
        {!!value && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear patient search"
            onPress={() => onChange('')}
            style={styles.clear}
          >
            <X size={19} color={colors.muted} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 18, paddingTop: 4 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 14,
    paddingRight: 4,
    gap: 8,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 999,
    backgroundColor: colors.surface,
  },
  input: {
    flex: 1,
    minHeight: 44,
    fontSize: 14,
    color: colors.ink,
    paddingVertical: 9,
  },
  clear: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
