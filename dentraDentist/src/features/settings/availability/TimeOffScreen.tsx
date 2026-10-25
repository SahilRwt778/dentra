import React from 'react';
import { Text } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { StackParamList } from '../../../navigation/types';
import { useGetTimeOffQuery } from '../../../store/dentraApi';
import { errorMessage } from '../../../common/utils/api-error';
import { formatDate, formatTime } from '../../../common/utils/date';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Empty, ErrorMessage, Loading } from '../../../components/ui/Feedback';
import { SettingsLayout, settingsStyles } from '../settings-ui';
import { TimeOffFields } from './TimeOffFields';
import { TimeOffReview } from './TimeOffReview';
import { useTimeOff } from './useTimeOff';

export function TimeOffScreen({
  navigation,
}: NativeStackScreenProps<StackParamList, 'TimeOff'>) {
  const focused = useIsFocused();
  const periods = useGetTimeOffQuery(undefined, {
    skip: !focused,
    pollingInterval: focused ? 15000 : 0,
  });
  const editor = useTimeOff();
  return (
    <SettingsLayout
      refresh={periods.refetch}
      refreshing={periods.isFetching && !!periods.currentData}
      footer={
        <Button
          title={
            editor.preview?.total === 0
              ? 'Confirm time off'
              : 'Check affected appointments'
          }
          loading={editor.busy}
          onPress={editor.reviewOrSave}
        />
      }
    >
      <Text style={settingsStyles.description}>
        Take a day off or block a break. Time off applies to all clinics and
        video consultations.
      </Text>
      <ErrorMessage message={editor.error} />
      {!!editor.notice && (
        <Card>
          <Text style={settingsStyles.description} accessibilityRole="alert">
            {editor.notice}
          </Text>
        </Card>
      )}
      <TimeOffFields
        form={editor.form}
        change={editor.change}
        disabled={editor.busy}
      />
      {!!editor.preview && (
        <TimeOffReview
          preview={editor.preview}
          disabled={editor.busy}
          onOpen={id =>
            navigation.navigate('Appointment', { appointmentId: id })
          }
        />
      )}
      <Text style={settingsStyles.heading}>Upcoming time off</Text>
      {periods.error ? (
        <Empty
          title="Could not load time off"
          text={errorMessage(periods.error)}
          retry={periods.refetch}
        />
      ) : !periods.currentData ? (
        <Loading text="Loading time off…" />
      ) : !periods.currentData.length ? (
        <Text style={settingsStyles.description}>No time off scheduled.</Text>
      ) : (
        periods.currentData.map(period => (
          <Card key={period.id} style={settingsStyles.card}>
            <Text style={settingsStyles.heading}>
              {formatDate(period.startDate)}
              {period.endDate !== period.startDate
                ? ` – ${formatDate(period.endDate)}`
                : ''}
            </Text>
            <Text style={settingsStyles.description}>
              {period.allDay
                ? 'All day'
                : `${formatTime(period.fromTime!)}–${formatTime(
                    period.toTime!,
                  )} IST, each day`}
            </Text>
            {!!period.reason && (
              <Text style={settingsStyles.description}>{period.reason}</Text>
            )}
            <Button
              title="Remove time off"
              variant="danger"
              disabled={editor.busy}
              onPress={() => editor.confirmRemove(period)}
            />
          </Card>
        ))
      )}
    </SettingsLayout>
  );
}
