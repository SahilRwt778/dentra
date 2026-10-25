import React, { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { StackParamList } from '../../navigation/types';
import { useGetPatientsQuery } from '../../store/dentraApi';
import { useForegroundRefresh } from '../../common/hooks/useForegroundRefresh';
import { errorMessage } from '../../common/utils/api-error';
import { colors } from '../../common/theme/theme';
import { Screen } from '../../components/ui/Screen';
import { Empty, Loading } from '../../components/ui/Feedback';
import { NotificationBell } from '../notifications/NotificationBell';
import { useBookingUpdates } from '../notifications/NotificationsProvider';
import { PatientCard } from './PatientCard';
import { PatientSearch } from './PatientSearch';
import { matchesPatient } from './patient-format';

export function PatientsScreen() {
  const [search, setSearch] = useState('');
  const focused = useIsFocused();
  const navigation = useNavigation<NativeStackNavigationProp<StackParamList>>();
  const query = useGetPatientsQuery(undefined, { skip: !focused });
  useForegroundRefresh(query.refetch, focused);
  useBookingUpdates(query.refetch, focused);
  const patients = query.currentData;
  const error = query.error ? errorMessage(query.error) : null;
  const matches =
    patients?.filter(patient => matchesPatient(patient, search)) ?? [];
  return (
    <Screen title="Patients" compactHeader action={<NotificationBell />}>
      <PatientSearch value={search} onChange={setSearch} />
      <FlatList
        data={error ? [] : matches}
        keyExtractor={patient => patient.id}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={styles.content}
        refreshing={query.isFetching && !!patients}
        onRefresh={query.refetch}
        renderItem={({ item }) => (
          <PatientCard
            patient={item}
            onPress={() =>
              navigation.navigate('PatientRecord', { patientId: item.id })
            }
          />
        )}
        ItemSeparatorComponent={Separator}
        ListEmptyComponent={
          error ? (
            <Empty
              title="Could not load patients"
              text={error}
              retry={query.refetch}
            />
          ) : !patients ? (
            <Loading text="Loading patients…" />
          ) : (
            <View style={styles.empty}>
              <Empty
                title={search.trim() ? 'No patients match' : 'No patients yet'}
                text={
                  search.trim()
                    ? 'Try a different name or phone number.'
                    : 'Patients will appear here when they book with you.'
                }
              />
            </View>
          )
        }
      />
    </Screen>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}
const styles = StyleSheet.create({
  content: { paddingHorizontal: 18, paddingBottom: 22, paddingTop: 14 },
  separator: { height: 12 },
  empty: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 12,
  },
});
