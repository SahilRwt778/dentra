import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, ui } from '@/theme';

type Props = {
  label?: string;
  value: string;
  onChangeText: (code: string) => void;
  editable?: boolean;
  autoFocus?: boolean;
  testID?: string;
};

export function OtpInput({
  label = 'Verification code',
  value,
  onChangeText,
  editable = true,
  autoFocus = false,
  testID,
}: Props) {
  const [focused, setFocused] = useState(false);
  const activeDigit = Math.min(value.length, 3);

  return (
    <View style={!editable && styles.disabled}>
      <Text accessible={false} style={ui.label}>
        {label}
      </Text>
      <View style={styles.row}>
        <View
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={styles.boxes}
        >
          {[0, 1, 2, 3].map(index => (
            <View
              key={index}
              style={[
                styles.box,
                focused && editable && index === activeDigit && styles.active,
              ]}
            >
              <Text style={styles.digit} maxFontSizeMultiplier={1.5}>
                {value[index] || ''}
              </Text>
            </View>
          ))}
        </View>
        {/* Hide the input layer itself; only the four digit labels are visible. */}
        <TextInput
          testID={testID}
          accessibilityLabel={label}
          accessibilityHint="Enter the 4-digit code."
          value={value}
          onChangeText={text =>
            onChangeText(text.replace(/\D/g, '').slice(0, 4))
          }
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="sms-otp"
          autoCorrect={false}
          spellCheck={false}
          editable={editable}
          autoFocus={autoFocus}
          caretHidden
          selection={{ start: value.length, end: value.length }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          selectionColor="transparent"
          underlineColorAndroid="transparent"
          style={styles.input}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { width: '100%' },
  boxes: { flexDirection: 'row', gap: 12 },
  box: {
    flex: 1,
    minWidth: 0,
    minHeight: 64,
    paddingVertical: 8,
    borderWidth: 2,
    borderColor: colors.line,
    borderRadius: 13,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  active: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  digit: {
    fontSize: 28,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    color: colors.ink,
    textAlign: 'center',
    includeFontPadding: false,
  },
  input: {
    ...StyleSheet.absoluteFill,
    opacity: 0,
    color: 'transparent',
    backgroundColor: 'transparent',
    fontSize: 28,
    padding: 0,
  },
  disabled: { opacity: 0.65 },
});
