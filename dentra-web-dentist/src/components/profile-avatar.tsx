import { useState } from 'react';
import { initials } from '@/lib/date';
import { profilePhotoUrl } from '@/lib/profile-photo';
import { ProfilePhotoPreview } from './profile-photo-preview';

export function ProfileAvatar({
  name,
  photoUrl,
}: {
  name: string;
  photoUrl?: string | null;
}) {
  const [failedUrl, setFailedUrl] = useState<string>();
  const uri = profilePhotoUrl(photoUrl);
  return (
    <ProfilePhotoPreview
      className="avatar profile-avatar"
      uri={failedUrl !== uri ? uri : undefined}
      name={name}
    >
      {uri && failedUrl !== uri ? (
        <img src={uri} alt="" onError={() => setFailedUrl(uri)} />
      ) : (
        initials(name) || 'U'
      )}
    </ProfilePhotoPreview>
  );
}
