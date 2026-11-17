import { useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { useUpdatePatientMutation } from '@/api/patients';
import { errorMessage } from '@/api/errors';
import { API_BASE_URL } from '@/config';
import { ui } from '@/theme';
import { Button, ErrorState, TextLink } from './ui';
import { ProfilePhotoField, type ProfilePhoto } from './profile-photo-field';

export function ProfilePhotoEditor({ photoUrl }: { photoUrl?: string | null }) {
  const [editing, setEditing] = useState(false);
  const [photo, setPhoto] = useState<ProfilePhoto | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [update, { isLoading: saving }] = useUpdatePatientMutation();
  const lock = useRef(false);

  function resetSelection() {
    setPhoto(null);
    setRemovePhoto(false);
    setError(undefined);
  }

  async function save() {
    if (lock.current || (!photo && !removePhoto)) return;
    lock.current = true;
    setError(undefined);
    try {
      await update(removePhoto ? { removeProfilePhoto: true } : {}, photo);
      setEditing(false);
      resetSelection();
      setNotice(
        removePhoto ? 'Profile photo removed.' : 'Profile photo saved.',
      );
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      lock.current = false;
    }
  }

  if (!editing) {
    return (
      <View style={ui.stack}>
        <TextLink
          title={photoUrl ? 'Change profile photo' : 'Add profile photo'}
          onPress={() => {
            resetSelection();
            setNotice(undefined);
            setEditing(true);
          }}
        />
        {notice && (
          <Text accessibilityRole="alert" style={ui.small}>
            {notice}
          </Text>
        )}
      </View>
    );
  }

  return (
    <View style={ui.stack}>
      <ProfilePhotoField
        value={photo}
        disabled={saving}
        existingUrl={
          !removePhoto && photoUrl ? `${API_BASE_URL}${photoUrl}` : null
        }
        onChange={selection => {
          setPhoto(selection);
          if (selection) setRemovePhoto(false);
        }}
        onRemoveExisting={() => setRemovePhoto(!!photoUrl)}
      />
      {removePhoto && (
        <Text style={ui.small}>Your photo will be removed when you save.</Text>
      )}
      {(photo || removePhoto) && (
        <Button
          title="Undo photo change"
          variant="secondary"
          onPress={resetSelection}
          disabled={saving}
        />
      )}
      {error && <ErrorState message={error} />}
      <Button
        title="Save photo"
        loading={saving}
        disabled={!photo && !removePhoto}
        onPress={() => void save()}
      />
      <Button
        title="Cancel"
        variant="secondary"
        disabled={saving}
        onPress={() => {
          resetSelection();
          setEditing(false);
        }}
      />
    </View>
  );
}
