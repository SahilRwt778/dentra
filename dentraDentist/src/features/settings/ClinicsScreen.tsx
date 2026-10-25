import React, { useRef, useState } from 'react';
import { Alert, Text } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { StackParamList } from '../../navigation/types';
import {
  useGetClinicsQuery,
  useRemoveClinicMutation,
} from '../../store/dentraApi';
import { useScreenActive } from '../../common/hooks/useScreenActive';
import { errorMessage } from '../../common/utils/api-error';
import { workingDaysLabel } from './availability/working-days';
import { formatTime } from '../../common/utils/date';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Empty, ErrorMessage, Loading } from '../../components/ui/Feedback';
import type { Clinic } from '../../common/types/api';
import {
  SettingsCardHeader,
  SettingsDetail,
  SettingsLayout,
  settingsStyles,
} from './settings-ui';

export function ClinicsScreen({
  navigation,
}: NativeStackScreenProps<StackParamList, 'Clinics'>) {
  const focused = useIsFocused();
  const {
    currentData: clinics,
    error,
    isFetching,
    refetch,
  } = useGetClinicsQuery(undefined, { skip: !focused });
  const [remove, removing] = useRemoveClinicMutation();
  const [actionError, setActionError] = useState<string | null>(null);
  const active = useScreenActive();
  const lock = useRef(false);
  function confirmRemove(clinic: Clinic) {
    Alert.alert(
      `Remove ${clinic.name}?`,
      'Future bookings here must be moved or cancelled first.',
      [
        { text: 'Keep clinic', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            if (lock.current || !active.current) return;
            lock.current = true;
            setActionError(null);
            try {
              await remove(clinic.id).unwrap();
            } catch (failure) {
              if (active.current) setActionError(errorMessage(failure));
            } finally {
              lock.current = false;
              removing.reset();
            }
          },
        },
      ],
    );
  }
  return (
    <SettingsLayout
      refresh={refetch}
      refreshing={isFetching && !!clinics}
      footer={
        <Button
          title="Add clinic"
          onPress={() => navigation.navigate('EditClinic')}
          disabled={removing.isLoading}
        />
      }
    >
      <Text style={settingsStyles.description}>
        Manage your clinic locations and opening hours.
      </Text>
      <ErrorMessage message={actionError} />
      {error ? (
        <Empty
          title="Could not load clinics"
          text={errorMessage(error)}
          retry={refetch}
        />
      ) : !clinics ? (
        <Loading text="Loading clinics…" />
      ) : !clinics.length ? (
        <Empty
          title="No clinics added"
          text="Add a location where patients can see you in person."
        />
      ) : (
        clinics.map(clinic => (
          <Card key={clinic.id} style={settingsStyles.card}>
            <SettingsCardHeader
              title={clinic.name}
              action="Edit"
              onPress={() =>
                navigation.navigate('EditClinic', { clinicId: clinic.id })
              }
            />
            {clinic.addressLine && (
              <Text style={settingsStyles.description}>
                {clinic.addressLine}
              </Text>
            )}
            <SettingsDetail
              label="Working days"
              value={workingDaysLabel(clinic.workingDays)}
            />
            <SettingsDetail
              label="Opening hours"
              value={`${formatTime(clinic.hoursFrom)}–${formatTime(
                clinic.hoursTo,
              )}`}
            />
            {clinic.phone && (
              <SettingsDetail label="Phone" value={clinic.phone} />
            )}
            {clinic.pincode && (
              <SettingsDetail label="PIN code" value={clinic.pincode} />
            )}
            <Button
              title="Remove clinic"
              variant="danger"
              disabled={removing.isLoading}
              onPress={() => confirmRemove(clinic)}
            />
          </Card>
        ))
      )}
    </SettingsLayout>
  );
}
