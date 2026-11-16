import React, { useRef, useState } from 'react';
import { Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { StackParamList } from '../../navigation/types';
import { useUpdateDentistMutation } from '../../store/dentraApi';
import { useScreenActive } from '../../common/hooks/useScreenActive';
import { errorMessage } from '../../common/utils/api-error';
import { useDentist } from '../auth/DentistGate';
import { Card } from '../../components/ui/Card';
import { Field } from '../../components/forms/Field';
import { ProfilePhotoField } from '../../components/forms/ProfilePhotoField';
import type { ProfilePhoto } from '../../common/types/profile-photo';
import { API_BASE_URL } from '../../common/config/api';
import { Button } from '../../components/ui/Button';
import { ErrorMessage } from '../../components/ui/Feedback';
import { profileForm, profileUpdate } from './settings-validation';
import { SettingsLayout, settingsStyles } from './settings-ui';

export function EditProfileScreen({
  navigation,
}: NativeStackScreenProps<StackParamList, 'EditProfile'>) {
  const dentist = useDentist();
  const [form, setForm] = useState(() => profileForm(dentist));
  const [photo, setPhoto] = useState<ProfilePhoto | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveProfile, saving] = useUpdateDentistMutation();
  const active = useScreenActive();
  const lock = useRef(false);
  async function save() {
    if (lock.current) return;
    lock.current = true;
    setError(null);
    try {
      await saveProfile({
        ...profileUpdate(form),
        ...(photo ? { profilePhoto: photo } : {}),
        ...(removePhoto ? { removeProfilePhoto: true } : {}),
      }).unwrap();
      if (active.current) navigation.goBack();
    } catch (failure) {
      if (active.current) setError(errorMessage(failure));
    } finally {
      lock.current = false;
      saving.reset();
    }
  }
  return (
    <SettingsLayout
      footer={
        <Button
          title="Save changes"
          loading={saving.isLoading}
          onPress={save}
        />
      }
    >
      <Text style={settingsStyles.description}>
        Keep your photo, qualifications and contact information up to date.
      </Text>
      <Card style={settingsStyles.card}>
        <ProfilePhotoField
          value={photo}
          disabled={saving.isLoading}
          existingUrl={
            !removePhoto && dentist.profilePhotoUrl
              ? `${API_BASE_URL}${dentist.profilePhotoUrl}`
              : null
          }
          onChange={selection => {
            setPhoto(selection);
            if (selection) setRemovePhoto(false);
          }}
          onRemoveExisting={() => setRemovePhoto(!!dentist.profilePhotoUrl)}
        />
        {removePhoto && (
          <Text style={settingsStyles.description}>
            Your photo will be removed when you save changes.
          </Text>
        )}
        {(photo || removePhoto) && (
          <Button
            title="Undo photo change"
            variant="secondary"
            disabled={saving.isLoading}
            onPress={() => {
              setPhoto(null);
              setRemovePhoto(false);
            }}
          />
        )}
      </Card>
      <Card style={settingsStyles.card}>
        <Field
          label="Qualification"
          value={form.qualification}
          editable={!saving.isLoading}
          onChangeText={qualification =>
            setForm(current => ({ ...current, qualification }))
          }
        />
        <Field
          label="Specialization"
          value={form.specialization}
          editable={!saving.isLoading}
          onChangeText={specialization =>
            setForm(current => ({ ...current, specialization }))
          }
        />
        <Field
          label="Dental Council registration"
          value={form.councilRegNo}
          autoCorrect={false}
          editable={!saving.isLoading}
          onChangeText={councilRegNo =>
            setForm(current => ({ ...current, councilRegNo }))
          }
        />
        <Field
          label="Languages"
          value={form.languages}
          placeholder="English, Hindi"
          editable={!saving.isLoading}
          onChangeText={languages =>
            setForm(current => ({ ...current, languages }))
          }
        />
        <Text style={settingsStyles.description}>
          Separate languages with commas.
        </Text>
        <Field
          label="Email"
          value={form.email}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          editable={!saving.isLoading}
          onChangeText={email => setForm(current => ({ ...current, email }))}
        />
      </Card>
      <ErrorMessage message={error} />
    </SettingsLayout>
  );
}
