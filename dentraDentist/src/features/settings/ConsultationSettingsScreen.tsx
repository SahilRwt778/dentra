import React, { useRef, useState } from 'react';
import { Switch, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { StackParamList } from '../../navigation/types';
import { useUpdateDentistMutation } from '../../store/dentraApi';
import { useScreenActive } from '../../common/hooks/useScreenActive';
import { colors, layout } from '../../common/theme/theme';
import { errorMessage } from '../../common/utils/api-error';
import { useDentist } from '../auth/DentistGate';
import { Card } from '../../components/ui/Card';
import { Field } from '../../components/forms/Field';
import { TimeField } from '../../components/forms/TimeField';
import { Button } from '../../components/ui/Button';
import { ErrorMessage } from '../../components/ui/Feedback';
import { feesForm, feesUpdate } from './settings-validation';
import { WorkingDaysField } from './availability/WorkingDaysField';
import { SettingsLayout, settingsStyles } from './settings-ui';

export function ConsultationSettingsScreen({
  navigation,
}: NativeStackScreenProps<StackParamList, 'ConsultationSettings'>) {
  const dentist = useDentist();
  const [form, setForm] = useState(() => feesForm(dentist));
  const [error, setError] = useState<string | null>(null);
  const [update, updating] = useUpdateDentistMutation();
  const active = useScreenActive();
  const lock = useRef(false);
  async function save() {
    if (lock.current) return;
    lock.current = true;
    setError(null);
    try {
      await update(feesUpdate(form)).unwrap();
      if (active.current) navigation.goBack();
    } catch (failure) {
      if (active.current) setError(errorMessage(failure));
    } finally {
      lock.current = false;
      updating.reset();
    }
  }
  return (
    <SettingsLayout
      footer={
        <Button
          title="Save changes"
          loading={updating.isLoading}
          onPress={save}
        />
      }
    >
      <Text style={settingsStyles.description}>
        Set your consultation fees and video availability.
      </Text>
      <Card style={settingsStyles.card}>
        <Text style={settingsStyles.heading}>Consultation fees</Text>
        <Field
          label="In-clinic fee (₹)"
          value={form.clinicFee}
          keyboardType="decimal-pad"
          editable={!updating.isLoading}
          onChangeText={clinicFee =>
            setForm(current => ({ ...current, clinicFee }))
          }
        />
        <Field
          label="Video consultation fee (₹)"
          value={form.videoFee}
          keyboardType="decimal-pad"
          editable={!updating.isLoading}
          onChangeText={videoFee =>
            setForm(current => ({ ...current, videoFee }))
          }
        />
      </Card>
      <Card style={settingsStyles.card}>
        <View style={layout.between}>
          <Text style={settingsStyles.heading}>Offer video consults</Text>
          <Switch
            accessibilityLabel="Offer video consults"
            value={form.offersVideo}
            disabled={updating.isLoading}
            trackColor={{ false: colors.line, true: colors.primary }}
            onValueChange={offersVideo =>
              setForm(current => ({ ...current, offersVideo }))
            }
          />
        </View>
        <Text style={settingsStyles.description}>
          When off, patients can only book in-clinic visits with you.
        </Text>
        {form.offersVideo && (
          <>
            <WorkingDaysField
              value={form.workingDays ?? []}
              disabled={updating.isLoading}
              onChange={workingDays =>
                setForm(current => ({ ...current, workingDays }))
              }
            />
            <Text style={layout.label}>Video consultation hours (IST)</Text>
            <View style={settingsStyles.row}>
              <View style={settingsStyles.grow}>
                <TimeField
                  label="From"
                  value={form.from}
                  disabled={updating.isLoading}
                  onChange={from => setForm(current => ({ ...current, from }))}
                />
              </View>
              <View style={settingsStyles.grow}>
                <TimeField
                  label="To"
                  value={form.to}
                  disabled={updating.isLoading}
                  onChange={to => setForm(current => ({ ...current, to }))}
                />
              </View>
            </View>
          </>
        )}
      </Card>
      <ErrorMessage message={error} />
    </SettingsLayout>
  );
}
