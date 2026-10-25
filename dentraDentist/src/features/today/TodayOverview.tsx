import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Appointment } from '../../common/types/api';
import { colors } from '../../common/theme/theme';
import { formatTime } from '../../common/utils/date';
import { ToothIcon } from '../../components/icons/ToothIcon';

type Props = {
  total: number;
  waiting: number;
  completed: number;
  next?: Appointment;
  onOpen: (appointment: Appointment) => void;
  onSchedule: () => void;
};

function heroContent(next: Appointment | undefined, total: number) {
  if (!next) {
    return {
      title: total ? 'All done for today' : 'No patients today',
      description: total
        ? 'Every appointment today is complete.'
        : 'Your schedule for the week is in the Schedule tab.',
      action: 'View schedule',
    };
  }
  let title = `Next up: ${next.patientName}`;
  if (next.status === 'in_consult') title = 'Consultation in progress';
  else if (next.status === 'waiting') title = `${next.patientName} is waiting`;
  const visitType = next.type === 'video' ? 'Video consult' : 'In-clinic visit';
  return {
    title,
    description: `${formatTime(next.time)}, ${visitType}. ${
      next.concern || 'Consultation'
    }`,
    action:
      next.status === 'in_consult'
        ? 'Continue consultation'
        : 'Open appointment',
  };
}

export function TodayOverview({
  total,
  waiting,
  completed,
  next,
  onOpen,
  onSchedule,
}: Props) {
  const { title, description, action } = heroContent(next, total);
  return (
    <View style={styles.stack}>
      <View style={styles.stats}>
        {(
          [
            [total, 'Today'],
            [waiting, 'Waiting'],
            [completed, 'Completed'],
          ] as const
        ).map(([count, label]) => (
          <View key={label} style={styles.stat}>
            <Text style={styles.count}>{count}</Text>
            <Text style={styles.label}>{label}</Text>
          </View>
        ))}
      </View>
      <View style={styles.hero}>
        <View pointerEvents="none" style={styles.watermark}>
          <ToothIcon size={130} color="#FFFFFF29" />
        </View>
        <Text accessibilityRole="header" style={styles.title}>
          {title}
        </Text>
        <Text style={styles.description}>{description}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={action}
          onPress={() => (next ? onOpen(next) : onSchedule())}
          style={({ pressed }) => [styles.action, pressed && styles.pressed]}
        >
          <Text style={styles.actionText}>{action}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 12 },
  stats: { flexDirection: 'row', gap: 8 },
  stat: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    gap: 3,
  },
  count: { fontSize: 22, fontWeight: '600', color: colors.ink },
  label: { fontSize: 12, color: colors.muted },
  hero: {
    backgroundColor: colors.primary,
    borderRadius: 18,
    padding: 20,
    overflow: 'hidden',
    alignItems: 'flex-start',
  },
  watermark: { position: 'absolute', right: -22, bottom: -26 },
  title: {
    color: colors.surface,
    fontSize: 21,
    fontWeight: '600',
    lineHeight: 27,
    maxWidth: '85%',
  },
  description: {
    color: '#FFFFFFE0',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 6,
    maxWidth: '85%',
  },
  action: {
    marginTop: 16,
    backgroundColor: colors.surface,
    borderRadius: 8,
    minHeight: 44,
    paddingVertical: 10,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  actionText: { color: '#0A5F59', fontWeight: '600', fontSize: 14 },
  pressed: { opacity: 0.8 },
});
