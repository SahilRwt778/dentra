import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { Building2, Video } from 'lucide-react-native';
import { useDentistQuery } from '@/api/dentists';
import { usePatientQuery } from '@/api/patients';
import type { BookAppointment, DentistPublic } from '@/api/types';
import { DentistPicker } from '@/components/dentist-picker';
import { SlotPicker } from '@/components/slot-picker';
import {
  Button,
  Card,
  Checkbox,
  Choice,
  Detail,
  ErrorState,
  Loading,
  Screen,
} from '@/components/ui';
import { addDays, CONCERNS, rupees } from '@/lib/patient';
import { errorMessage } from '@/api/errors';
import { Field } from '@/components/ui';
import { useBookAppointment } from '@/hooks/use-book-appointment';
import { useBookingAttachments } from '@/hooks/use-booking-attachments';
import { BookingAttachments } from '@/components/booking-attachments';
import type { PatientScreenProps } from '@/navigation/types';
import { colors, ui } from '@/theme';

export function BookingScreen({
  route,
  navigation,
}: PatientScreenProps<'Booking'>) {
  const [step, setStep] = useState(1);
  const [concerns, setConcerns] = useState<string[]>([]);
  const [other, setOther] = useState('');
  const [area, setArea] = useState('');
  const [since, setSince] = useState('');
  const [pain, setPain] = useState<number>();
  const [swelling, setSwelling] = useState(false);
  const [note, setNote] = useState('');
  const [type, setType] = useState<'video' | 'clinic'>(
    route.params?.type ?? 'clinic',
  );
  const [dentist, setDentist] = useState<DentistPublic>();
  const [clinicId, setClinicId] = useState('');
  const [date, setDate] = useState(addDays(0));
  const [time, setTime] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<
    BookAppointment['paymentMethod']
  >(route.params?.type === 'video' ? 'upi' : 'pay_at_clinic');
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string>();
  const { submit: book, isBooking: busy } = useBookAppointment();
  const attachments = useBookingAttachments();
  const { data: picked, isLoading: loadingPicked } = useDentistQuery(
    route.params?.dentistId,
  );
  const { data: me } = usePatientQuery();
  const selected = dentist ?? picked;
  const selectedClinic = clinicId || selected?.clinics?.[0]?.id;
  const fee =
    type === 'video' ? selected?.feeVideoPaise : selected?.feeClinicPaise;
  const titles = [
    'What’s the problem?',
    'A few details',
    'How would you like to visit?',
    'Choose a dentist',
    'Pick a time',
  ];
  const canContinue =
    step === 1
      ? concerns.length > 0 && (!concerns.includes('Other') || !!other.trim())
      : step === 2
      ? !!area && !!since
      : step === 3
      ? true
      : step === 4
      ? !!selected?.id &&
        (type !== 'video' || !!selected.offersVideo) &&
        (type !== 'clinic' || !!selected.clinics?.length)
      : !!time && consent && (type !== 'clinic' || !!selectedClinic);

  function leave() {
    if (busy) return;
    if (step > 1) {
      setStep(v => v - 1);
      setError(undefined);
    } else
      Alert.alert(
        'Leave this booking?',
        'Your booking has not been submitted.',
        [
          { text: 'Keep booking', style: 'cancel' },
          { text: 'Leave', onPress: navigation.goBack },
        ],
      );
  }
  async function confirm() {
    if (!selected?.id || !canContinue || !attachments.isReady) return;
    setError(undefined);
    const descriptions = concerns.map(c =>
      c === 'Other' ? `Other: ${other.trim()}` : c,
    );
    const payload = {
      dentistId: selected.id,
      clinicId: type === 'clinic' ? selectedClinic : undefined,
      type,
      date,
      time,
      concern: descriptions.join(', '),
      concerns: descriptions,
      symptomArea: area,
      symptomSince: since,
      painScore: pain,
      swelling,
      note: note.trim() || undefined,
      paymentMethod,
      attachmentIds: attachments.attachmentIds,
    };
    try {
      const result = await book(payload, me);
      if (!result) return;
      const { appointment, paymentCancelled } = result;
      if (paymentCancelled) {
        Alert.alert(
          'Payment not confirmed',
          'Your appointment is saved. You can retry payment from its details.',
        );
      }
      navigation.replace('Appointment', {
        appointmentId: appointment.id,
        justBooked: true,
      });
    } catch (err) {
      setError(
        errorMessage(
          err,
          'We couldn’t confirm the booking. Retry to check the same booking attempt.',
        ),
      );
    }
  }
  return (
    <Screen
      title="Book a visit"
      onBack={leave}
      footer={
        <Button
          title={
            step < 5
              ? 'Continue'
              : paymentMethod === 'pay_at_clinic'
              ? 'Confirm booking'
              : `Pay ${rupees(fee)} and confirm`
          }
          disabled={!canContinue || (step >= 2 && !attachments.isReady)}
          loading={busy}
          onPress={() => {
            if (step < 5) {
              setStep(v => v + 1);
              setError(undefined);
            } else void confirm();
          }}
        />
      }
    >
      <View style={s.steps}>
        {titles.map((_, n) => (
          <View key={n} style={[s.step, n < step && s.stepOn]} />
        ))}
      </View>
      <Text style={ui.small}>Step {step} of 5</Text>
      <Text style={ui.title}>{titles[step - 1]}</Text>
      {step === 1 ? (
        <>
          <Text style={ui.muted}>Select all that apply.</Text>
          {CONCERNS.map(c => (
            <Choice
              key={c}
              title={c}
              selected={concerns.includes(c)}
              onPress={() =>
                setConcerns(current =>
                  current.includes(c)
                    ? current.filter(v => v !== c)
                    : [...current, c],
                )
              }
            />
          ))}
          {concerns.includes('Other') ? (
            <Field
              label="Tell us about the other problem"
              value={other}
              onChangeText={setOther}
              multiline
            />
          ) : null}
        </>
      ) : null}
      {step === 2 ? (
        <>
          <Text style={ui.label}>Where is it?</Text>
          <View style={ui.wrap}>
            {[
              'Upper right',
              'Upper left',
              'Lower right',
              'Lower left',
              'Front teeth',
              'Whole mouth or not sure',
            ].map(v => (
              <Choice
                compact
                key={v}
                title={v}
                selected={area === v}
                onPress={() => setArea(v)}
              />
            ))}
          </View>
          <Text style={ui.label}>Since when?</Text>
          <View style={ui.wrap}>
            {['Today', '2–3 days', '1 week', 'Longer than a week'].map(v => (
              <Choice
                compact
                key={v}
                title={v}
                selected={since === v}
                onPress={() => setSince(v)}
              />
            ))}
          </View>
          <Text style={ui.label}>Pain level (optional)</Text>
          <Text style={ui.small}>0 is no pain; 10 is the most intense.</Text>
          <View style={ui.wrap}>
            {Array.from({ length: 11 }, (_, n) => (
              <Choice
                compact
                key={n}
                title={String(n)}
                selected={pain === n}
                onPress={() => setPain(n)}
              />
            ))}
          </View>
          <Text style={ui.label}>Any swelling in your face or gums?</Text>
          <View style={ui.wrap}>
            {[false, true].map(v => (
              <Choice
                compact
                key={String(v)}
                title={v ? 'Yes' : 'No'}
                selected={swelling === v}
                onPress={() => setSwelling(v)}
              />
            ))}
          </View>
          <Field
            label="Anything else your dentist should know?"
            placeholder="For example: pain gets worse with cold drinks"
            value={note}
            onChangeText={setNote}
            multiline
          />
          <BookingAttachments attachments={attachments} />
        </>
      ) : null}
      {step === 3 ? (
        <>
          {(
            [
              {
                value: 'video',
                title: 'Video consult',
                description:
                  'Talk to a dentist from home for advice and a first opinion. Join from your appointment details.',
                icon: Video,
              },
              {
                value: 'clinic',
                title: 'In-clinic visit',
                description:
                  'Visit the clinic for treatment, cleaning, X-rays or a full check-up.',
                icon: Building2,
              },
            ] as const
          ).map(v => (
            <Choice
              key={v.value}
              title={v.title}
              description={v.description}
              icon={v.icon}
              selected={type === v.value}
              onPress={() => {
                setType(v.value);
                setTime('');
                setConsent(false);
                setPaymentMethod(
                  v.value === 'clinic' ? 'pay_at_clinic' : 'upi',
                );
              }}
            />
          ))}
        </>
      ) : null}
      {step === 4 ? (
        <>
          {loadingPicked ? <Loading /> : null}
          <DentistPicker
            type={type}
            selectedId={selected?.id}
            onSelect={d => {
              setDentist(d);
              setClinicId(d.clinics?.[0]?.id ?? '');
              setTime('');
              setConsent(false);
            }}
          />
        </>
      ) : null}
      {step === 5 && selected?.id ? (
        <>
          {type === 'clinic' ? (
            <>
              <Text style={ui.label}>Choose a location</Text>
              {selected.clinics?.map(c => (
                <Choice
                  key={c.id}
                  title={c.name ?? 'Clinic'}
                  description={c.addressLine}
                  selected={selectedClinic === c.id}
                  onPress={() => {
                    setClinicId(c.id ?? '');
                    setTime('');
                  }}
                />
              ))}
            </>
          ) : null}
          <SlotPicker
            dentistId={selected.id}
            type={type}
            clinicId={type === 'clinic' ? selectedClinic : undefined}
            date={date}
            time={time}
            onDate={setDate}
            onTime={setTime}
          />
          <Card>
            <Detail label="Dentist" value={selected.fullName} />
            <Detail
              label="Visit"
              value={
                type === 'video'
                  ? 'Video consult'
                  : selected.clinics?.find(c => c.id === selectedClinic)?.name
              }
            />
            <Detail label="Reason" value={concerns.join(', ')} />
            <Detail label="Fee" value={rupees(fee)} />
            {attachments.items.length ? (
              <Detail
                label="Attachments"
                value={`${attachments.items.length} photos / reports`}
              />
            ) : null}
          </Card>
          <Text style={ui.label}>Pay with</Text>
          <View style={ui.wrap}>
            {(
              [
                { key: 'upi', label: 'UPI' },
                { key: 'card', label: 'Card' },
                { key: 'netbanking', label: 'Net banking' },
                ...(type === 'clinic'
                  ? [{ key: 'pay_at_clinic', label: 'Pay at clinic' }]
                  : []),
              ] as { key: BookAppointment['paymentMethod']; label: string }[]
            ).map(method => (
              <Choice
                compact
                key={method.key}
                title={method.label}
                selected={method.key === paymentMethod}
                onPress={() => setPaymentMethod(method.key)}
              />
            ))}
          </View>
          <Text style={ui.small}>
            {paymentMethod === 'pay_at_clinic'
              ? `Pay ${rupees(fee)} at the clinic when you arrive.`
              : 'Complete payment securely with Razorpay. Your booking updates after payment is verified.'}
          </Text>
          <Checkbox
            title={`I agree to share these details with ${selected.fullName}${
              type === 'video' ? ' and consent to a video consultation' : ''
            }.`}
            value={consent}
            onChange={setConsent}
          />
        </>
      ) : null}
      {error ? <ErrorState message={error} /> : null}
    </Screen>
  );
}
const s = StyleSheet.create({
  steps: { flexDirection: 'row', gap: 5 },
  step: { flex: 1, height: 4, borderRadius: 4, backgroundColor: colors.line },
  stepOn: { backgroundColor: colors.accent },
});
