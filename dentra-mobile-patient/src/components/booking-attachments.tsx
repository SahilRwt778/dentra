import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Camera, FileText, Images, X } from 'lucide-react-native';
import { Button, Card, ErrorState } from './ui';
import type { useBookingAttachments } from '@/hooks/use-booking-attachments';
import { colors, ui } from '@/theme';

export function BookingAttachments({
  attachments,
}: {
  attachments: ReturnType<typeof useBookingAttachments>;
}) {
  return (
    <Card>
      <Text style={ui.heading}>Photos and reports (optional)</Text>
      <Text style={ui.small}>
        Share a clear photo or an existing report with your dentist. Up to 8
        files, 10 MB each. JPEG, PNG or PDF.
      </Text>
      {attachments.items.map(item => (
        <View key={item.key} style={ui.stack}>
          <View style={s.preview}>
            {item.local.type.startsWith('image/') ? (
              <Image
                source={{ uri: item.local.uri }}
                style={s.image}
                resizeMode="contain"
                accessibilityLabel={`Preview of ${item.local.name}`}
              />
            ) : (
              <View style={s.report}>
                <FileText size={36} color={colors.accent} />
                <Text style={ui.body}>PDF report</Text>
              </View>
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remove ${item.local.name}`}
              accessibilityHint="Remove this attachment from your booking"
              accessibilityState={{ disabled: attachments.isBusy }}
              disabled={attachments.isBusy}
              hitSlop={8}
              onPress={() => {
                attachments.remove(item.key);
              }}
              style={({ pressed }) => [
                s.remove,
                (pressed || attachments.isBusy) && s.dimmed,
              ]}
            >
              <X size={18} color={colors.surface} />
            </Pressable>
          </View>
          <Text style={ui.body} numberOfLines={2}>
            {item.local.name}
          </Text>
          <Text style={ui.small}>
            {item.uploaded
              ? 'Uploaded · ready to share with this booking'
              : item.error || 'Uploading…'}
          </Text>
          {item.error && !item.uploaded ? (
            <Button
              title="Retry upload"
              small
              variant="secondary"
              disabled={attachments.isBusy}
              onPress={() => {
                attachments.retry(item.key);
              }}
            />
          ) : null}
        </View>
      ))}
      {(
        [
          ['camera', 'Take photo', Camera],
          ['photos', 'Choose photos', Images],
          ['report', 'Add PDF report', FileText],
        ] as const
      ).map(([source, title, icon]) => (
        <Button
          key={source}
          title={title}
          icon={icon}
          variant="secondary"
          disabled={attachments.isBusy || attachments.items.length >= 8}
          onPress={() => {
            attachments.choose(source);
          }}
        />
      ))}
      {attachments.error ? <ErrorState message={attachments.error} /> : null}
      <Text style={ui.small}>
        Files are shared with the assigned dentist when you confirm. Unused
        uploads expire after 24 hours.
      </Text>
    </Card>
  );
}

const s = StyleSheet.create({
  preview: {
    width: 144,
    maxWidth: '100%',
    aspectRatio: 4 / 3,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: colors.soft,
    borderWidth: 1,
    borderColor: colors.line,
  },
  image: { width: '100%', height: '100%' },
  report: {
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  remove: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.red,
    borderWidth: 1,
    borderColor: colors.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dimmed: { opacity: 0.5 },
});
