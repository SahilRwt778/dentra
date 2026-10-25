import { useState } from 'react';
import { Linking, Text } from 'react-native';
import { Button, Card, ErrorState, Field, Screen } from '@/components/ui';
import type { PatientScreenProps } from '@/navigation/types';
import { SUPPORT_EMAIL } from '@/config';
import { ui } from '@/theme';

const questions = [
  [
    'Can I cancel or reschedule?',
    'Open an appointment to cancel it. Booked appointments can be rescheduled to another available time at the same clinic.',
  ],
  [
    'Where are my prescriptions?',
    'Go to Records, then Prescriptions. Open a visit to view its medicines, instructions and treatment plan.',
  ],
  [
    'How do online payments work?',
    'Razorpay handles checkout. Your appointment shows Paid only after our server verifies the payment. If the status does not update after a debit, contact support with your appointment reference.',
  ],
  [
    'Are video calls available?',
    'For a paid video appointment, open its details and select Open video consultation. Joining opens 10 minutes before the appointment. Allow camera and microphone access and keep Dentra open during the call.',
  ],
  [
    'How can I request my data?',
    'Open Profile to request a copy of your data or account deletion. These requests are processed by our team.',
  ],
];
export function HelpScreen({ navigation }: PatientScreenProps<'Help'>) {
  const [open, setOpen] = useState<number>();
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);
  async function email() {
    try {
      await Linking.openURL(
        `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
          'Dentra patient support',
        )}&body=${encodeURIComponent(message)}`,
      );
    } catch {
      setError(true);
    }
  }
  return (
    <Screen title="Help and support" onBack={navigation.goBack}>
      <Text style={ui.title}>How can we help?</Text>
      <Text style={ui.muted}>
        Find an answer or get in touch with our team.
      </Text>
      {questions.map(([title, answer], i) => (
        <Card
          key={title}
          onPress={() => setOpen(value => (value === i ? undefined : i))}
        >
          <Text style={ui.heading}>{title}</Text>
          {open === i ? <Text style={ui.muted}>{answer}</Text> : null}
        </Card>
      ))}
      <Card>
        <Text style={ui.heading}>Contact support</Text>
        <Text selectable style={ui.body}>
          {SUPPORT_EMAIL}
        </Text>
        <Field
          label="How can we help?"
          value={message}
          onChangeText={setMessage}
          multiline
          placeholder="Include your appointment reference if you have one."
        />
        <Button title="Open email app" onPress={() => void email()} />
        <Text style={ui.small}>
          You can review your message before sending it from your email app.
        </Text>
      </Card>
      {error ? (
        <ErrorState
          message={`No email app is available. You can write to ${SUPPORT_EMAIL} from another device.`}
        />
      ) : null}
    </Screen>
  );
}
