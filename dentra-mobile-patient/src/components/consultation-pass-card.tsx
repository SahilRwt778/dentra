import { StyleSheet, Text, View } from 'react-native';
import { consultationDeadline } from '@dentra/call-core';
import type { ConsultationCaseBrief } from '@/api/types';
import { Button, Card } from './ui';
import { colors, ui } from '@/theme';

export function ConsultationPassCard({
  item,
  onMessage,
  onBook,
  embedded = false,
}: {
  item?: ConsultationCaseBrief | null;
  onMessage(): void;
  onBook(): void;
  embedded?: boolean;
}) {
  if (!item?.activatedAt) return null;
  const active = item.status === 'active';
  const content = (
    <>
      <Text style={ui.heading}>
        {active ? 'Your 3-day follow-up pass' : 'Consultation history'}
      </Text>
      <Text style={ui.muted}>
        {active
          ? `Message your dentist and book free follow-ups for the same concern until ${consultationDeadline(
              item.expiresAt!,
            )}. Each visit needs an available slot.`
          : item.status === 'revoked'
          ? 'This pass is no longer available. Your messages are still readable.'
          : 'Your 72-hour window has ended. Your messages are still readable.'}
      </Text>
      <Button
        title={active ? 'Message dentist' : 'View messages'}
        variant="secondary"
        onPress={onMessage}
      />
      {active && <Button title="Book free follow-up" onPress={onBook} />}
    </>
  );
  return embedded ? (
    <View style={styles.embedded}>{content}</View>
  ) : (
    <Card>{content}</Card>
  );
}
const styles = StyleSheet.create({
  embedded: {
    gap: 14,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: 16,
    marginTop: 2,
  },
});
