import { useContext } from 'react';
import { Linking, Text } from 'react-native';
import { Button, Card } from '@/components/ui';
import { PUSH_ENABLED } from '@/config';
import { ui } from '@/theme';
import { PushContext } from './push-context';

export function PushPreferences() {
  const { state, enable } = useContext(PushContext);
  if (!PUSH_ENABLED || state === 'unavailable') return null;
  return (
    <Card>
      <Text style={ui.heading}>Phone notifications</Text>
      <Text style={ui.muted}>
        {state === 'enabled'
          ? 'Appointment updates and reminders can reach you when Dentra is closed.'
          : state === 'denied'
          ? 'Phone notifications are turned off. You can enable them in your device settings.'
          : state === 'error'
          ? 'We couldn’t connect phone notifications. Your updates are still available here.'
          : 'Get appointment updates and reminders when you’re away from the app.'}
      </Text>
      {state !== 'enabled' && (
        <Button
          title={
            state === 'denied'
              ? 'Open notification settings'
              : state === 'error'
              ? 'Try again'
              : 'Enable phone notifications'
          }
          small
          variant="secondary"
          loading={state === 'busy'}
          onPress={() => {
            if (state === 'denied')
              Linking.openSettings().catch(() => undefined);
            else enable();
          }}
        />
      )}
    </Card>
  );
}
