import React from 'react';
import { Text } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { StackParamList } from '../../../navigation/types';
import type { Appointment } from '../../../common/types/api';
import type { Consultation } from '../../../common/types/consultation';
import type {
  PatientAllergies,
  Prescription,
} from '../../../common/types/prescription';
import { colors } from '../../../common/theme/theme';
import { useForegroundRefresh } from '../../../common/hooks/useForegroundRefresh';
import {
  useGetAppointmentQuery,
  useGetConsultationQuery,
  useGetPatientAllergiesQuery,
} from '../../../store/dentraApi';
import { errorMessage } from '../../../common/utils/api-error';
import { useDentist } from '../../auth/DentistGate';
import { FormScreen } from '../../../components/ui/FormScreen';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Empty, ErrorMessage, Loading } from '../../../components/ui/Feedback';
import { Field } from '../../../components/forms/Field';
import { Checkbox } from '../../../components/forms/Checkbox';
import { consultationStyles as styles } from '../consultation.styles';
import { PrescriptionSummary } from './PrescriptionSummary';
import { allergyConflict } from './prescription-form';
import { usePrescriptionSigning } from './usePrescriptionSigning';

export function PrescriptionPreviewScreen({
  route,
  navigation,
}: NativeStackScreenProps<StackParamList, 'PrescriptionPreview'>) {
  const id = route.params.appointmentId;
  const focused = useIsFocused();
  const appointmentQuery = useGetAppointmentQuery(id);
  const consultationQuery = useGetConsultationQuery(id, {
    skip: !appointmentQuery.currentData,
  });
  const appointment = appointmentQuery.currentData;
  const consultation = consultationQuery.currentData;
  const allergiesQuery = useGetPatientAllergiesQuery(
    appointment?.patientId ?? '',
    { skip: !appointment },
  );
  useForegroundRefresh(appointmentQuery.refetch, focused, 15000);
  useForegroundRefresh(
    consultationQuery.refetch,
    focused && !!appointment,
    15000,
  );
  function retry() {
    appointmentQuery.refetch();
    if (appointment) {
      consultationQuery.refetch();
      allergiesQuery.refetch();
    }
  }
  const error =
    appointmentQuery.error || consultationQuery.error || allergiesQuery.error;
  if ((!appointment || !consultation) && error)
    return (
      <FormScreen>
        <Empty
          title="Could not load prescription"
          text={errorMessage(error)}
          retry={retry}
        />
      </FormScreen>
    );
  if (!appointment || !consultation)
    return (
      <FormScreen>
        <Loading text="Loading prescription…" />
      </FormScreen>
    );
  const prescription = consultation.prescription;
  if (!prescription?.items.length)
    return (
      <FormScreen>
        <Empty
          title="No saved prescription"
          text="Return to the consultation to add medicines."
        />
      </FormScreen>
    );
  return (
    <PrescriptionPreview
      appointment={appointment}
      prescription={prescription}
      allergies={allergiesQuery.currentData}
      reloadPrescription={() => consultationQuery.refetch().unwrap()}
      reloadAllergies={() => allergiesQuery.refetch().unwrap()}
      loadError={error ? errorMessage(error) : null}
      retry={retry}
      close={() => navigation.goBack()}
    />
  );
}

function PrescriptionPreview({
  appointment,
  prescription,
  allergies,
  reloadPrescription,
  reloadAllergies,
  loadError,
  retry,
  close,
}: {
  appointment: Appointment;
  prescription: Prescription;
  allergies: PatientAllergies | undefined;
  reloadPrescription: () => Promise<Consultation>;
  reloadAllergies: () => Promise<PatientAllergies>;
  loadError: string | null;
  retry: () => void;
  close: () => void;
}) {
  const dentist = useDentist();
  const signing = usePrescriptionSigning({
    appointment,
    prescription,
    allergies,
    dentistName: dentist.fullName,
    reloadPrescription,
    reloadAllergies,
  });
  const displayed = signing.signedPrescription ?? prescription;
  const signed = !!displayed.signedAt;
  const available = !!allergies && !loadError;
  return (
    <FormScreen
      footer={
        <>
          {signing.editable && (
            <Button
              title="Sign prescription"
              loading={signing.busy}
              disabled={!available || !signing.canSign}
              onPress={signing.sign}
            />
          )}
          <Button
            title="Close preview"
            variant="secondary"
            disabled={signing.busy}
            onPress={close}
          />
        </>
      }
    >
      <PrescriptionSummary
        appointment={appointment}
        prescription={displayed}
        dentist={dentist}
      />
      <Text style={styles.body}>
        {appointment.status === 'completed' && signed
          ? 'This signed prescription is available in the patient app.'
          : 'Patient access is available after the consultation is completed.'}
      </Text>
      {!!loadError && (
        <>
          <ErrorMessage message={loadError} />
          <Button
            title="Reload prescription"
            variant="secondary"
            onPress={retry}
            disabled={signing.busy}
          />
        </>
      )}
      {signing.editable && (
        <>
          <Card style={[styles.card, { backgroundColor: colors.amberSoft }]}>
            <Text style={styles.heading}>Recorded allergies</Text>
            {!allergies ? (
              <Loading text="Loading recorded allergies…" />
            ) : (
              <Text style={styles.body}>
                {allergies.allergies || 'No allergies recorded.'}
              </Text>
            )}
            {prescription.items.map((item, index) => {
              const conflict = allergyConflict(
                allergies?.allergies,
                item.medicineName,
              );
              return conflict ? (
                <ErrorMessage
                  key={index}
                  message={`${item.medicineName}: allergy conflict (${conflict}).`}
                />
              ) : null;
            })}
            <ErrorMessage message={signing.serverAllergyWarning} />
            {signing.needsAck && (
              <Checkbox
                label="I have reviewed the allergy conflict and want to issue this prescription."
                checked={signing.ack}
                disabled={signing.busy}
                onChange={signing.setAck}
              />
            )}
          </Card>
          <Card style={styles.card}>
            <Text style={styles.heading}>Confirm and sign</Text>
            <Text style={styles.body}>
              Review the medicines, type your full name, and confirm with the
              four-digit code.
            </Text>
            <Field
              label="Type your full name"
              placeholder={dentist.fullName}
              value={signing.name}
              autoCorrect={false}
              autoComplete="off"
              editable={!signing.busy}
              onChangeText={signing.setName}
            />
            <Button
              title={
                signing.resendIn > 0
                  ? `Resend code in ${signing.resendIn}s`
                  : signing.hasCode
                  ? 'Resend signing code'
                  : 'Request signing code'
              }
              variant="secondary"
              disabled={!available || signing.busy || signing.resendIn > 0}
              onPress={signing.sendCode}
            />
            {signing.hasCode && (
              <>
                <Field
                  label="4-digit signing code"
                  value={signing.code}
                  keyboardType="number-pad"
                  textContentType="oneTimeCode"
                  maxLength={4}
                  editable={!signing.busy}
                  onChangeText={signing.setCode}
                />
                <Text accessibilityLiveRegion="polite" style={styles.body}>
                  {signing.expiresIn > 0
                    ? `Code expires in ${signing.expiresIn}s.`
                    : 'Code expired. Request a new signing code.'}
                </Text>
              </>
            )}
          </Card>
        </>
      )}
      <ErrorMessage message={signing.error} />
      {!signed && !signing.editable && (
        <Text style={styles.body}>
          This visit is read-only. A prescription can only be signed during an
          active consultation.
        </Text>
      )}
    </FormScreen>
  );
}
