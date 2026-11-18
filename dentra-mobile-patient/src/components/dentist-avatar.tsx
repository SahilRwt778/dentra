import { useDentistQuery } from '@/api/dentists';
import { Avatar } from './ui';

/** Older appointment responses omit the photo; share the cached dentist profile in that case. */
export function DentistAvatar({
  dentistId,
  name,
  photoUrl,
  large,
}: {
  dentistId?: string;
  name?: string;
  photoUrl?: string | null;
  large?: boolean;
}) {
  const { currentData: dentist } = useDentistQuery(dentistId, {
    skip: photoUrl !== undefined,
    // Refresh stale profile metadata on mount, without polling for photos.
    refetchOnMountOrArgChange: 300,
  });

  return (
    <Avatar
      name={name}
      large={large}
      // Null means the photo was removed; only an omitted field needs a lookup.
      photoUrl={photoUrl === undefined ? dentist?.profilePhotoUrl : photoUrl}
    />
  );
}
