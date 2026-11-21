import React, { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { AppImage } from './AppImage';
import { ProfilePhotoPreview } from './ProfilePhotoPreview';

export function ProfileAvatar({
  name,
  photoUrl,
  apiBaseUrl,
}: {
  name: string;
  photoUrl?: string | null;
  apiBaseUrl: string;
}) {
  const [failedUrl, setFailedUrl] = useState<string>();
  const uri = photoUrl
    ? `${apiBaseUrl.replace(/\/$/, '')}${photoUrl}`
    : undefined;
  const initials =
    name
      .replace(/^dr\.?\s+/i, '')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part[0])
      .join('')
      .toUpperCase() || 'U';

  return (
    <ProfilePhotoPreview
      style={styles.avatar}
      uri={failedUrl !== uri ? uri : undefined}
      name={name}
    >
      {uri && failedUrl !== uri ? (
        <AppImage
          source={{ uri }}
          style={styles.photo}
          objectFit="cover"
          accessible={false}
          onError={() => setFailedUrl(uri)}
        />
      ) : (
        <Text style={styles.initials}>{initials}</Text>
      )}
    </ProfilePhotoPreview>
  );
}

const styles = StyleSheet.create({
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    overflow: 'hidden',
    backgroundColor: '#DEF1ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photo: { width: '100%', height: '100%' },
  initials: { color: '#0D7870', fontSize: 14, fontWeight: '600' },
});
