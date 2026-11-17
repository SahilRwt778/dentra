import React, { useState } from 'react';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ConsultationInbox } from '@dentra/video/src/ConsultationInbox';
import { useGetConsultationCasesQuery } from '../../store/dentraApi';
import { errorMessage } from '../../common/utils/api-error';
import { useForegroundRefresh } from '../../common/hooks/useForegroundRefresh';
import type { StackParamList } from '../../navigation/types';
import { Screen } from '../../components/ui/Screen';
import { NotificationBell } from '../notifications/NotificationBell';
import { API_BASE_URL } from '../../common/config/api';

export function MessagesScreen() {
  const [page, setPage] = useState(1);
  const focused = useIsFocused();
  const navigation = useNavigation<NativeStackNavigationProp<StackParamList>>();
  const query = useGetConsultationCasesQuery(page, { skip: !focused });
  useForegroundRefresh(query.refetch, focused, 10000);
  return (
    <Screen title="Messages" compactHeader action={<NotificationBell />}>
      <ConsultationInbox
        items={query.currentData?.items ?? []}
        role="dentist"
        apiBaseUrl={API_BASE_URL}
        loading={query.isFetching}
        refreshing={query.isFetching && !!query.currentData}
        error={query.error ? errorMessage(query.error) : undefined}
        onRefresh={query.refetch}
        onOpen={item => navigation.navigate('Chat', { caseId: item.id })}
        onPrevious={page > 1 ? () => setPage(page - 1) : undefined}
        onNext={
          query.currentData?.nextPage
            ? () => setPage(query.currentData!.nextPage!)
            : undefined
        }
      />
    </Screen>
  );
}
