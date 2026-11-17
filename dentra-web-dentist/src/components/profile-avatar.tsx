import { useState } from 'react';
import { initials } from '@/lib/date';
import { profilePhotoUrl } from '@/lib/profile-photo';

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
    <span className="avatar profile-avatar" aria-hidden="true">
      {uri && failedUrl !== uri ? (
        <img src={uri} alt="" onError={() => setFailedUrl(uri)} />
      ) : (
        initials(name) || 'U'
      )}
    </span>
  );
}
