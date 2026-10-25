import React, { useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useBookingUpdates } from '../notifications/NotificationsProvider';
import { useGetDayAppointmentsQuery } from '../../store/dentraApi';
import { errorMessage } from '../../common/utils/api-error';
import { useForegroundRefresh } from '../../common/hooks/useForegroundRefresh';
import { colors, layout } from '../../common/theme/theme';
import { Button } from '../../components/ui/Button';
import { Empty, ErrorMessage, Loading } from '../../components/ui/Feedback';
import { AppointmentCard } from '../../components/cards/AppointmentCard';
import type { StackParamList } from '../../navigation/types';

export function DayAppointments({
  date,
  today = false,
}: {
  date: string;
  today?: boolean;
}) {
  const [page, setPage] = useState(1);
  const focused = useIsFocused();
  const navigation = useNavigation<NativeStackNavigationProp<StackParamList>>();
  const {
    currentData: data,
    error: requestError,
    isFetching: loading,
    refetch: reload,
  } = useGetDayAppointmentsQuery({ date, page }, { skip: !focused });
  const error = requestError ? errorMessage(requestError) : null;
  useForegroundRefresh(reload, focused);
  useBookingUpdates(reload, focused);
  const items = (data?.items ?? []).filter(
    item => !today || item.status !== 'cancelled',
  );
  const counts = [
    [items.length, 'Appointments'],
    [items.filter(item => item.status === 'waiting').length, 'Waiting'],
    [items.filter(item => item.status === 'completed').length, 'Completed'],
  ];
  return (
    <FlatList
      data={error ? [] : items}
      keyExtractor={item => item.id}
      contentContainerStyle={layout.content}
      refreshing={loading && !!data}
      onRefresh={reload}
      ListHeaderComponent={
        <View style={layout.stack}>
          {today && data && !error && (
            <>
              <View style={styles.stats}>
                {counts.map(([count, label]) => (
                  <View key={label} style={styles.stat}>
                    <Text style={styles.count}>{count}</Text>
                    <Text style={styles.statLabel}>{label}</Text>
                  </View>
                ))}
              </View>
              {(page > 1 || data.nextPage) && (
                <Text style={layout.muted}>Counts shown for this page.</Text>
              )}
            </>
          )}
          <View style={layout.between}>
            <Text style={layout.heading}>
              {today ? 'Today’s queue' : 'Appointments'}
            </Text>
            <Text style={layout.muted}>Latest times first</Text>
          </View>
          <ErrorMessage message={error} />
          {error && (
            <Button
              title="Try again"
              variant="secondary"
              loading={loading}
              onPress={reload}
            />
          )}
        </View>
      }
      renderItem={({ item }) => (
        <AppointmentCard
          appointment={item}
          onPress={() =>
            navigation.navigate('Appointment', { appointmentId: item.id })
          }
        />
      )}
      ItemSeparatorComponent={Separator}
      ListEmptyComponent={
        !error ? (
          loading ? (
            <Loading text="Loading appointments…" />
          ) : (
            <Empty
              title={
                today ? 'No appointments today' : 'No appointments for this day'
              }
              text="New bookings will appear here."
            />
          )
        ) : undefined
      }
      ListFooterComponent={
        data && !error && (page > 1 || data.nextPage) ? (
          <View style={styles.pagination}>
            <Text style={layout.muted}>Page {page}</Text>
            <View style={layout.row}>
              <Button
                title="Previous"
                variant="secondary"
                disabled={loading || page === 1}
                onPress={() => setPage(page - 1)}
              />
              <Button
                title="Next"
                variant="secondary"
                disabled={loading || !data.nextPage}
                onPress={() => setPage(data.nextPage!)}
              />
            </View>
          </View>
        ) : undefined
      }
    />
  );
}
function Separator() {
  return <View style={styles.separator} />;
}
const styles = StyleSheet.create({
  stats: { flexDirection: 'row', gap: 10 },
  stat: {
    flex: 1,
    borderRadius: 16,
    padding: 14,
    backgroundColor: colors.primarySoft,
    gap: 5,
  },
  count: { fontSize: 24, fontWeight: '700', color: colors.primary },
  statLabel: { fontSize: 12, color: colors.primary },
  separator: { height: 14 },
  pagination: { marginTop: 20, gap: 12, alignItems: 'center' },
});
