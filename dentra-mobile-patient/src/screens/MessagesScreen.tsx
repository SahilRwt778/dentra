import { useAppActive } from '@dentra/video/src/useAppActive';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { ConsultationInbox } from '@dentra/video/src/ConsultationInbox';
import { useConsultationCasesQuery } from '@/api/consultation-cases';
import { errorMessage } from '@/api/errors';
import type { PatientNavigation } from '@/navigation/types';
import { colors, ui } from '@/theme';
import { API_BASE_URL } from '@/config';
import type { ConversationFilter } from '@dentra/call-core';

export function MessagesScreen() {
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<ConversationFilter>('all');
  const focused = useIsFocused();
  const active = useAppActive();
  const navigation = useNavigation<PatientNavigation>();
  const query = useConsultationCasesQuery(
    { page, filter },
    {
      skip: !focused || !active,
      pollingInterval: focused && active ? 10000 : 0,
      refetchOnMountOrArgChange: true,
    },
  );
  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <View style={styles.header}>
        <Text style={ui.heading}>Messages</Text>
      </View>
      <ConsultationInbox
        filter={filter}
        onFilter={value => {
          setFilter(value);
          setPage(1);
        }}
        items={query.currentData?.items ?? []}
        role="patient"
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { padding: 18 },
});
