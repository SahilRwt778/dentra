import { useState } from 'react';
import { ProfilePhotoPreview } from './profile-photo-preview';

export function ProfileAvatar({
  name,
  photoUrl,
}: {
  name?: string;
  photoUrl?: string | null;
}) {
  const [failedUrl, setFailedUrl] = useState<string>();
  const uri = photoUrl
    ? `${(import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000').replace(
        /\/$/,
        '',
      )}${photoUrl}`
    : undefined;
  return (
    <ProfilePhotoPreview
      className="avatar"
      style={{ overflow: 'hidden' }}
      uri={failedUrl !== uri ? uri : undefined}
      name={name}
    >
      {uri && uri !== failedUrl ? (
        <img
          src={uri}
          alt={`${name || 'Dentist'} profile`}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          onError={() => setFailedUrl(uri)}
        />
      ) : (
        name
          ?.trim()
          .split(/\s+/)
          .slice(0, 2)
          .map((part) => part[0])
          .join('')
          .toUpperCase() || 'D'
      )}
    </ProfilePhotoPreview>
  );
}
