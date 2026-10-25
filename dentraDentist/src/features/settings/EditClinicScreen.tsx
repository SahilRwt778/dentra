import React, { useRef, useState } from 'react';
import { Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { StackParamList } from '../../navigation/types';
import type { Clinic } from '../../common/types/api';
import {
  useAddClinicMutation,
  useGetClinicsQuery,
  useUpdateClinicMutation,
} from '../../store/dentraApi';
import { useScreenActive } from '../../common/hooks/useScreenActive';
import { errorMessage } from '../../common/utils/api-error';
import { Card } from '../../components/ui/Card';
import { Field } from '../../components/forms/Field';
import { TimeField } from '../../components/forms/TimeField';
import { Button } from '../../components/ui/Button';
import { Empty, ErrorMessage, Loading } from '../../components/ui/Feedback';
import { clinicForm, clinicSubmission } from './settings-validation';
import { WorkingDaysField } from './availability/WorkingDaysField';
import { SettingsLayout, settingsStyles } from './settings-ui';

export function EditClinicScreen({
  navigation,
  route,
}: NativeStackScreenProps<StackParamList, 'EditClinic'>) {
  const id = route.params?.clinicId;
  const {
    currentData: clinics,
    error,
    refetch,
  } = useGetClinicsQuery(undefined, { skip: !id });
  if (id && error)
    return (
      <SettingsLayout>
        <Empty
          title="Could not load this clinic"
          text={errorMessage(error)}
          retry={refetch}
        />
      </SettingsLayout>
    );
  if (id && !clinics)
    return (
      <SettingsLayout>
        <Loading text="Loading clinic…" />
      </SettingsLayout>
    );
  const clinic = clinics?.find(item => item.id === id);
  if (id && !clinic)
    return (
      <SettingsLayout>
        <Empty
          title="Clinic not found"
          text="This location may have been removed."
        />
      </SettingsLayout>
    );
  return (
    <ClinicEditor
      key={id || 'new'}
      clinic={clinic}
      onDone={() => navigation.goBack()}
    />
  );
}
function ClinicEditor({
  clinic,
  onDone,
}: {
  clinic?: Clinic;
  onDone: () => void;
}) {
  const [form, setForm] = useState(() => clinicForm(clinic));
  const [error, setError] = useState<string | null>(null);
  const [addClinic, adding] = useAddClinicMutation();
  const [updateClinic, updating] = useUpdateClinicMutation();
  const busy = adding.isLoading || updating.isLoading;
  const active = useScreenActive();
  const lock = useRef(false);
  async function save() {
    if (lock.current) return;
    lock.current = true;
    setError(null);
    try {
      const details = clinicSubmission(form);
      if (clinic) await updateClinic({ id: clinic.id, details }).unwrap();
      else await addClinic(details).unwrap();
      if (active.current) onDone();
    } catch (failure) {
      if (active.current) setError(errorMessage(failure));
    } finally {
      lock.current = false;
      adding.reset();
      updating.reset();
    }
  }
  return (
    <SettingsLayout
      footer={<Button title="Save clinic" loading={busy} onPress={save} />}
    >
      <Text style={settingsStyles.description}>
        Patients see this location when booking an in-clinic visit.
      </Text>
      <Card style={settingsStyles.card}>
        <Field
          label="Clinic name"
          value={form.name}
          editable={!busy}
          onChangeText={name => setForm(current => ({ ...current, name }))}
        />
        <Field
          label="Address"
          value={form.addressLine}
          multiline
          editable={!busy}
          onChangeText={addressLine =>
            setForm(current => ({ ...current, addressLine }))
          }
        />
        <Field
          label="PIN code (optional)"
          value={form.pincode}
          keyboardType="number-pad"
          editable={!busy}
          onChangeText={pincode =>
            setForm(current => ({ ...current, pincode }))
          }
        />
        <Field
          label="Clinic phone (optional)"
          value={form.phone}
          keyboardType="phone-pad"
          editable={!busy}
          onChangeText={phone => setForm(current => ({ ...current, phone }))}
        />
        <WorkingDaysField
          value={form.workingDays ?? []}
          disabled={busy}
          onChange={workingDays =>
            setForm(current => ({ ...current, workingDays }))
          }
        />
        <View style={settingsStyles.row}>
          <View style={settingsStyles.grow}>
            <TimeField
              label="Opens at"
              value={form.hoursFrom}
              disabled={busy}
              onChange={hoursFrom =>
                setForm(current => ({ ...current, hoursFrom }))
              }
            />
          </View>
          <View style={settingsStyles.grow}>
            <TimeField
              label="Closes at"
              value={form.hoursTo}
              disabled={busy}
              onChange={hoursTo =>
                setForm(current => ({ ...current, hoursTo }))
              }
            />
          </View>
        </View>
      </Card>
      <ErrorMessage message={error} />
    </SettingsLayout>
  );
}
