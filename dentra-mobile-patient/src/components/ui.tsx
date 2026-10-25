import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
  type TextInputProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Check,
  ChevronRight,
  CircleAlert,
  type LucideIcon,
} from 'lucide-react-native';
import { colors, ui } from '@/theme';

export function Screen({
  title,
  onBack,
  action,
  children,
  footer,
  tabbed,
  refreshing,
  onRefresh,
}: {
  title?: string;
  onBack?: () => void;
  action?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  tabbed?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  return (
    <SafeAreaView edges={tabbed ? ['top'] : ['top', 'bottom']} style={s.screen}>
      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {title ? (
          <View style={s.header}>
            {onBack ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Back"
                onPress={onBack}
                style={s.back}
              >
                <ArrowLeft size={20} color={colors.ink} />
              </Pressable>
            ) : null}
            <Text
              accessibilityRole="header"
              style={[ui.heading, ui.grow, s.screenTitle]}
            >
              {title}
            </Text>
            {action}
          </View>
        ) : null}
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={s.content}
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={!!refreshing}
                onRefresh={onRefresh}
                tintColor={colors.accent}
              />
            ) : undefined
          }
        >
          {children}
        </ScrollView>
        {footer ? <View style={s.footer}>{footer}</View> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function Card({
  children,
  style,
  onPress,
  label,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  label?: string;
}) {
  if (onPress)
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onPress}
        style={({ pressed }) => [s.card, pressed && s.pressed, style]}
      >
        {children}
      </Pressable>
    );
  return <View style={[s.card, style]}>{children}</View>;
}

export function Button({
  title,
  onPress,
  loading,
  disabled,
  variant = 'primary',
  icon: Icon,
  small,
}: {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger' | 'white';
  icon?: LucideIcon;
  small?: boolean;
}) {
  const foreground =
    variant === 'primary'
      ? colors.surface
      : variant === 'danger'
      ? colors.red
      : colors.accentDeep;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{
        disabled: !!disabled || !!loading,
        busy: !!loading,
      }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        variant === 'primary' && s.primary,
        variant === 'danger' && s.danger,
        small && s.smallButton,
        (disabled || loading) && s.disabled,
        pressed && s.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={foreground} />
      ) : (
        <>
          {Icon ? <Icon size={18} color={foreground} /> : null}
          <Text style={[s.buttonText, { color: foreground }]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

export function Field({
  label,
  hint,
  ...props
}: TextInputProps & { label: string; hint?: string }) {
  return (
    <View>
      <Text style={ui.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.muted}
        {...props}
        style={[s.input, props.multiline && s.multiline, props.style]}
      />
      {hint ? <Text style={ui.small}>{hint}</Text> : null}
    </View>
  );
}

export function Choice({
  title,
  selected,
  onPress,
  description,
  icon: Icon,
  compact,
}: {
  title: string;
  selected?: boolean;
  onPress: () => void;
  description?: string;
  icon?: LucideIcon;
  compact?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      style={({ pressed }) => [
        s.choice,
        compact && s.compact,
        selected && s.selected,
        pressed && s.pressed,
      ]}
    >
      {Icon ? <Icon size={23} color={colors.accent} /> : null}
      <View style={compact ? undefined : ui.grow}>
        <Text style={[ui.body, selected && s.selectedText]}>{title}</Text>
        {description ? <Text style={ui.muted}>{description}</Text> : null}
      </View>
      {!compact ? (
        <View style={[s.check, selected && s.checked]}>
          {selected ? <Check color="white" size={14} /> : null}
        </View>
      ) : null}
    </Pressable>
  );
}

export function Checkbox({
  title,
  value,
  onChange,
}: {
  title: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: value }}
      onPress={() => onChange(!value)}
      style={s.checkbox}
    >
      <View style={[s.check, value && s.checked]}>
        {value ? <Check color="white" size={14} /> : null}
      </View>
      <Text style={[ui.body, ui.grow]}>{title}</Text>
    </Pressable>
  );
}

export function Badge({
  title,
  tone = 'accent',
}: {
  title: string;
  tone?: 'accent' | 'green' | 'amber' | 'red' | 'muted';
}) {
  const toneColors = {
    accent: [colors.accentSoft, colors.accentDeep],
    green: [colors.greenSoft, colors.green],
    amber: [colors.amberSoft, colors.amber],
    red: [colors.redSoft, colors.red],
    muted: [colors.soft, colors.muted],
  };
  const [backgroundColor, color] = toneColors[tone];
  return (
    <View style={[s.badge, { backgroundColor }]}>
      <Text style={[s.badgeText, { color }]}>{title}</Text>
    </View>
  );
}

export function Avatar({ name, large }: { name?: string; large?: boolean }) {
  const initials =
    name
      ?.replace(/^dr\.?\s*/i, '')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map(p => p[0])
      .join('')
      .toUpperCase() || 'D';
  return (
    <View style={[s.avatar, large && s.largeAvatar]}>
      <Text style={[s.initials, large && { fontSize: 25 }]}>{initials}</Text>
    </View>
  );
}

export function Detail({
  label,
  value,
}: {
  label: string;
  value?: string | number | null;
}) {
  return (
    <View style={s.detail}>
      <Text style={[ui.muted, s.detailLabel]}>{label}</Text>
      <Text style={[ui.body, ui.grow]}>{value ?? '—'}</Text>
    </View>
  );
}

export function Empty({
  title,
  message,
  icon: Icon,
  action,
}: {
  title: string;
  message?: string;
  icon?: LucideIcon;
  action?: ReactNode;
}) {
  return (
    <Card style={s.empty}>
      {Icon ? <Icon size={30} color={colors.accent} /> : null}
      <Text style={ui.heading}>{title}</Text>
      {message ? <Text style={[ui.muted, s.center]}>{message}</Text> : null}
      {action}
    </Card>
  );
}

export function ErrorState({
  message = 'We couldn’t load this. Check your connection and try again.',
  retry,
}: {
  message?: string;
  retry?: () => void;
}) {
  return (
    <View accessibilityRole="alert" style={s.error}>
      <CircleAlert color={colors.red} size={20} />
      <Text style={[ui.body, ui.grow, { color: colors.red }]}>{message}</Text>
      {retry ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Try again"
          onPress={retry}
        >
          <Text style={s.retry}>Retry</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function Loading() {
  return (
    <View style={s.loading}>
      <ActivityIndicator color={colors.accent} accessibilityLabel="Loading" />
    </View>
  );
}

export function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <View style={ui.stack}>
      <View style={ui.between}>
        <Text accessibilityRole="header" style={ui.heading}>
          {title}
        </Text>
        {action}
      </View>
      {children}
    </View>
  );
}

export function TextLink({
  title,
  onPress,
}: {
  title: string;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={s.link}>
      <Text style={s.linkText}>{title}</Text>
      <ChevronRight size={15} color={colors.accent} />
    </Pressable>
  );
}

export function Segments<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={s.segments}>
      {options.map(option => (
        <Pressable
          key={option}
          accessibilityRole="tab"
          accessibilityState={{ selected: option === value }}
          onPress={() => onChange(option)}
          style={[s.segment, option === value && s.segmentOn]}
        >
          <Text
            style={[
              s.segmentText,
              option === value && { color: colors.ink, fontWeight: '600' },
            ]}
          >
            {option}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  screenTitle: { fontSize: 22 },
  back: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 24,
    gap: 16,
    flexGrow: 1,
  },
  footer: {
    padding: 16,
    gap: 10,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderColor: colors.line,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    padding: 16,
    gap: 12,
  },
  button: {
    minHeight: 50,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  primary: { backgroundColor: colors.accent, borderColor: colors.accent },
  danger: { borderColor: '#EBC3BF' },
  smallButton: { minHeight: 42, paddingVertical: 8 },
  buttonText: { fontSize: 15, fontWeight: '600', textAlign: 'center' },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.75 },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 48,
    fontSize: 15,
    color: colors.ink,
  },
  multiline: { minHeight: 100, textAlignVertical: 'top' },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 15,
    backgroundColor: colors.surface,
    minHeight: 52,
  },
  compact: { paddingVertical: 10, paddingHorizontal: 13, minHeight: 44 },
  selected: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  selectedText: { color: colors.accentDeep, fontWeight: '600' },
  check: {
    width: 22,
    height: 22,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  checked: { backgroundColor: colors.accent, borderColor: colors.accent },
  checkbox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 6,
  },
  badge: {
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  badgeText: { fontSize: 11, fontWeight: '600' },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  largeAvatar: { width: 76, height: 76, borderRadius: 38 },
  initials: { fontSize: 16, fontWeight: '600', color: colors.accentDeep },
  detail: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  detailLabel: { width: 100 },
  empty: { paddingVertical: 30, alignItems: 'center', gap: 12 },
  center: { textAlign: 'center' },
  error: {
    borderRadius: 12,
    backgroundColor: colors.redSoft,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  retry: { color: colors.red, fontWeight: '600' },
  loading: { padding: 32 },
  link: { flexDirection: 'row', alignItems: 'center', gap: 3, minHeight: 40 },
  linkText: { color: colors.accent, fontSize: 13, fontWeight: '600' },
  segments: {
    flexDirection: 'row',
    borderRadius: 24,
    padding: 4,
    backgroundColor: colors.soft,
    gap: 3,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 22,
  },
  segmentOn: { backgroundColor: colors.surface },
  segmentText: { fontSize: 12, color: colors.muted },
});
