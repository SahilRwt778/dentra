import React, { useId } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from 'react-native';
import { colors, layout } from '../../common/theme/theme';
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  const id = useId();
  return (
    <View style={styles.field}>
      <Text nativeID={id} style={layout.label}>
        {label}
      </Text>
      <TextInput
        accessibilityLabel={label}
        accessibilityLabelledBy={id}
        placeholderTextColor={colors.muted}
        {...props}
        style={[
          styles.input,
          !props.editable && props.editable !== undefined && styles.disabled,
          props.style,
        ]}
      />
    </View>
  );
}
const styles = StyleSheet.create({
  field: { gap: 8 },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 13,
    minHeight: 52,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.ink,
  },
  disabled: { opacity: 0.65 },
});
