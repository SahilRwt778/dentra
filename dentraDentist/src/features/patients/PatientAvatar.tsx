import React, { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { AppImage } from '@dentra/video/src/AppImage';
import { ProfilePhotoPreview } from '@dentra/video/src/ProfilePhotoPreview';
import { API_BASE_URL } from '../../common/config/api';
import { colors } from '../../common/theme/theme';
import { patientInitials } from './patient-format';

export function PatientAvatar({
  name,
  photoUrl,
  large = false,
}: {
  name: string;
  photoUrl?: string | null;
  large?: boolean;
}) {
  const [failedUrl, setFailedUrl] = useState<string>();
  const uri = photoUrl ? `${API_BASE_URL}${photoUrl}` : undefined;
  return (
    <ProfilePhotoPreview
      style={[styles.avatar, large && styles.large]}
      uri={failedUrl !== uri ? uri : undefined}
      name={name}
    >
      {uri && failedUrl !== uri ? (
        <AppImage
          source={{ uri }}
          style={styles.photo}
          objectFit="cover"
          accessibilityLabel={`${name} profile photo`}
          onError={() => setFailedUrl(uri)}
        />
      ) : (
        <Text style={[styles.initials, large && styles.largeInitials]}>
          {patientInitials(name)}
        </Text>
      )}
    </ProfilePhotoPreview>
  );
}

const styles = StyleSheet.create({
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photo: { width: '100%', height: '100%' },
  initials: { color: colors.primary, fontSize: 14, fontWeight: '600' },
  large: { width: 56, height: 56, borderRadius: 28 },
  largeInitials: { fontSize: 18 },
});
