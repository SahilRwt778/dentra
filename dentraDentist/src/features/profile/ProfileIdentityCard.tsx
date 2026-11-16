import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { CheckCircle2, ChevronRight, Pencil } from 'lucide-react-native';
import type { Dentist } from '../../common/types/api';
import { API_BASE_URL } from '../../common/config/api';
import { colors } from '../../common/theme/theme';
import { Card } from '../../components/ui/Card';

export function ProfileIdentityCard({
  dentist,
  onEdit,
}: {
  dentist: Dentist;
  onEdit: () => void;
}) {
  const [failedPhoto, setFailedPhoto] = useState<string>();
  const photo = dentist.profilePhotoUrl;
  const initials =
    dentist.fullName
      .replace(/^dr\.?\s+/i, '')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part[0])
      .join('')
      .toUpperCase() || 'D';

  return (
    <Card style={styles.card}>
      <View style={styles.identity}>
        <Pressable
          style={styles.avatar}
          accessibilityRole="button"
          accessibilityLabel="Edit profile photo"
          onPress={onEdit}
        >
          {photo && failedPhoto !== photo ? (
            <Image
              source={{ uri: `${API_BASE_URL}${photo}` }}
              style={styles.photo}
              resizeMode="cover"
              accessibilityLabel="Your profile photo"
              onError={() => setFailedPhoto(photo)}
            />
          ) : (
            <Text style={styles.initials}>{initials}</Text>
          )}
        </Pressable>
        <View style={styles.details}>
          <Text style={styles.name}>{dentist.fullName}</Text>
          {!!dentist.specialization && (
            <Text style={styles.specialization}>{dentist.specialization}</Text>
          )}
          {dentist.status === 'verified' && (
            <View style={styles.verified}>
              <CheckCircle2 size={13} color={colors.primary} />
              <Text style={styles.verifiedText}>Verified dentist</Text>
            </View>
          )}
        </View>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Edit Profile"
        onPress={onEdit}
        style={({ pressed }) => [styles.edit, pressed && styles.pressed]}
      >
        <Pencil size={16} color={colors.primary} />
        <Text style={styles.editText}>Edit profile</Text>
        <ChevronRight size={18} color={colors.primary} />
      </Pressable>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { padding: 0, gap: 0, borderRadius: 16, overflow: 'hidden' },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
  },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  photo: { width: '100%', height: '100%' },
  initials: { color: colors.primary, fontWeight: '700', fontSize: 26 },
  details: { flex: 1, gap: 5 },
  name: { color: colors.ink, fontSize: 19, lineHeight: 25, fontWeight: '700' },
  specialization: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  verified: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: colors.primarySoft,
  },
  verifiedText: {
    flexShrink: 1,
    color: colors.primary,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
  edit: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderColor: colors.line,
  },
  editText: { flex: 1, color: colors.primary, fontSize: 14, fontWeight: '600' },
  pressed: { backgroundColor: colors.primarySoft },
});
