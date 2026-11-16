import { CallChat } from '@dentra/video/src/CallChat';
import { consultationDeadline } from '@dentra/call-core';
import { useIsFocused } from '@react-navigation/native';
import { useConsultationCaseQuery } from '@/api/consultation-cases';
import { callChat } from '@/api/call-chat';
import { ErrorState, Loading, Screen } from '@/components/ui';
import type { PatientScreenProps } from '@/navigation/types';

const ignoreUnread = () => undefined;
export function ChatScreen({ route, navigation }: PatientScreenProps<'Chat'>) {
  const focused = useIsFocused();
  const query = useConsultationCaseQuery(
    { caseId: route.params.caseId },
    { refetchOnMountOrArgChange: true },
  );
  const item = query.currentData;
  if (!item)
    return (
      <Screen title="Messages" onBack={navigation.goBack}>
        {query.error ? <ErrorState retry={query.refetch} /> : <Loading />}
      </Screen>
    );
  return (
    <CallChat
      key={item.id}
      appointmentId={item.originalAppointmentId}
      client={callChat}
      visible={focused}
      title={item.dentistName}
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
