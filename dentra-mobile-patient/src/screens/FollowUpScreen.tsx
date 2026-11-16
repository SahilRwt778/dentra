import uuid from 'react-native-uuid';
import { useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { consultationDeadline } from '@dentra/call-core';
import {
  useConsultationCaseQuery,
  useBookFollowUpMutation,
} from '@/api/consultation-cases';
import { useDentistQuery } from '@/api/dentists';
import { errorMessage } from '@/api/errors';
import {
  Button,
  Card,
  Choice,
  ErrorState,
  Field,
  Loading,
  Screen,
} from '@/components/ui';
import { SlotPicker } from '@/components/slot-picker';
import { addDays } from '@/lib/patient';
import type { PatientScreenProps } from '@/navigation/types';
import { ui } from '@/theme';

export function FollowUpScreen({
  route,
  navigation,
}: PatientScreenProps<'FollowUp'>) {
  const pass = useConsultationCaseQuery(
    { caseId: route.params.caseId },
    { pollingInterval: 15000, refetchOnMountOrArgChange: true },
  );
  const dentist = useDentistQuery(pass.currentData?.dentistId);
  const [book, booking] = useBookFollowUpMutation();
  const [type, setType] = useState<'video' | 'clinic'>('video');
  const [clinicId, setClinicId] = useState('');
  const [date, setDate] = useState(addDays(0));
  const [time, setTime] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string>();
  const attempt = useRef<{ payload: string; key: string } | null>(null);
  const lock = useRef(false);
  const item = pass.currentData;
  const selectedClinic = clinicId || dentist.data?.clinics?.[0]?.id;
  async function confirm() {
    if (!item?.canBookFollowUp || !time || lock.current) return;
    lock.current = true;
    setError(undefined);
    const details = {
      type,
      date,
      time,
      clinicId: type === 'clinic' ? selectedClinic : undefined,
      note: note.trim() || undefined,
    };
    const payload = JSON.stringify(details);
    if (attempt.current?.payload !== payload)
      attempt.current = {
        payload,
        key: String(uuid.v4()),
      };
    try {
      const appointment = await book({
        caseId: item.id,
        followUpBooking: { ...details, idempotencyKey: attempt.current!.key },
      }).unwrap();
      navigation.replace('Appointment', {
        appointmentId: appointment.id!,
        justBooked: true,
      });
    } catch (failure) {
      setError(errorMessage(failure));
      pass.refetch();
    } finally {
      lock.current = false;
    }
  }
  const unavailable =
    type === 'video' ? !dentist.data?.offersVideo : !selectedClinic;
  return (
    <Screen
      title="Free follow-up"
      onBack={navigation.goBack}
      footer={
        item?.canBookFollowUp ? (
          <Button
            title="Confirm free follow-up"
            loading={booking.isLoading}
            disabled={!time || unavailable}
            onPress={() => void confirm()}
          />
        ) : undefined
      }
    >
      {!item ? (
        pass.error ? (
          <ErrorState retry={pass.refetch} />
        ) : (
          <Loading />
        )
      ) : (
        <>
          <Card>
            <Text style={ui.heading}>{item.dentistName}</Text>
            <Text style={ui.label}>{item.concern}</Text>
            <Text style={ui.muted}>
              {item.canBookFollowUp
                ? `No payment required. The appointment must start before ${consultationDeadline(
                    item.expiresAt!,
                  )}. This booking does not extend your pass.`
                : 'This pass is closed. Book a new paid appointment for further consultations.'}
            </Text>
          </Card>
          {item.canBookFollowUp && (
            <>
              {dentist.error && <ErrorState retry={dentist.refetch} />}
              <View style={ui.row}>
                {(['video', 'clinic'] as const).map(mode => (
                  <Choice
                    key={mode}
                    title={mode === 'video' ? 'Video' : 'In clinic'}
                    selected={type === mode}
                    onPress={() => {
                      setType(mode);
                      setTime('');
                    }}
                  />
                ))}
              </View>
              {type === 'clinic' &&
                dentist.data?.clinics?.map(clinic => (
                  <Choice
                    key={clinic.id}
                    title={clinic.name ?? 'Clinic'}
                    selected={selectedClinic === clinic.id}
                    onPress={() => {
                      setClinicId(clinic.id!);
                      setTime('');
                    }}
                  />
                ))}
              {unavailable ? (
                <Text style={ui.muted}>
                  This visit type is currently unavailable. Choose another type.
                </Text>
              ) : (
                <SlotPicker
                  dentistId={item.dentistId}
                  type={type}
                  clinicId={type === 'clinic' ? selectedClinic : undefined}
                  date={date}
                  time={time}
                  onDate={setDate}
                  onTime={setTime}
                  expiresAt={item.expiresAt!}
                />
              )}
              <Field
                label="Follow-up note (optional)"
                value={note}
                onChangeText={setNote}
                multiline
                maxLength={4000}
              />
            </>
          )}
          {error && <ErrorState message={error} />}
        </>
      )}
    </Screen>
  );
}
