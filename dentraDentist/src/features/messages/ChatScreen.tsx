import React from 'react';
import { useIsFocused } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CallChat } from '@dentra/video/src/CallChat';
import { consultationDeadline } from '@dentra/call-core';
import { useGetConsultationCaseQuery } from '../../store/dentraApi';
import { callChat } from '../../api/call-chat.api';
import type { StackParamList } from '../../navigation/types';
import { Screen } from '../../components/ui/Screen';
import { Button } from '../../components/ui/Button';
import { Empty, Loading } from '../../components/ui/Feedback';

const ignoreUnread = () => undefined;
export function ChatScreen({
  route,
  navigation,
}: NativeStackScreenProps<StackParamList, 'Chat'>) {
  const focused = useIsFocused();
  const query = useGetConsultationCaseQuery(route.params.caseId);
  const item = query.currentData;
  if (!item)
    return (
      <Screen title="Messages">
        <Button title="Back" variant="secondary" onPress={navigation.goBack} />
        {query.error ? (
          <Empty title="Could not load conversation" retry={query.refetch} />
        ) : (
          <Loading />
        )}
      </Screen>
    );
  return (
    <CallChat
      key={item.id}
      appointmentId={item.originalAppointmentId}
      client={callChat}
      visible={focused}
      title={item.patientName}
      subtitle={
        item.expiresAt
          ? `Open until ${consultationDeadline(item.expiresAt)}`
          : 'Consultation messages'
      }
      onClose={navigation.goBack}
      onUnread={ignoreUnread}
    />
  );
}
