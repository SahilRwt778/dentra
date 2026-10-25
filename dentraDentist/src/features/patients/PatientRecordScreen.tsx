import React, { useLayoutEffect } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { StackParamList } from '../../navigation/types';
import { useGetPatientRecordQuery } from '../../store/dentraApi';
import { useForegroundRefresh } from '../../common/hooks/useForegroundRefresh';
import { errorMessage } from '../../common/utils/api-error';
import { colors } from '../../common/theme/theme';
import { Empty, Loading } from '../../components/ui/Feedback';
import { useBookingUpdates } from '../notifications/NotificationsProvider';
import { PatientDetails } from './PatientDetails';
import { PatientDentalChart } from './PatientDentalChart';
import { PatientVisitCard } from './PatientVisitCard';
import { patientStyles } from './patient-styles';

export function PatientRecordScreen({
  route,
  navigation,
}: NativeStackScreenProps<StackParamList, 'PatientRecord'>) {
  const focused = useIsFocused();
  const query = useGetPatientRecordQuery(route.params.patientId, {
    skip: !focused,
  });
  useForegroundRefresh(query.refetch, focused);
  useBookingUpdates(query.refetch, focused);
  const patient = query.currentData;
  const title = !query.error && patient ? patient.fullName : 'Patient record';
  useLayoutEffect(() => {
    navigation.setOptions({ title });
  }, [navigation, title]);
  if (query.error)
    return (
      <Empty
        title="Could not load patient"
        text={errorMessage(query.error)}
        retry={query.refetch}
      />
    );
  if (!patient) return <Loading text="Loading patient record…" />;
  return (
    <FlatList
      data={patient.appointments}
      keyExtractor={visit => visit.id}
      contentContainerStyle={styles.content}
      refreshing={query.isFetching}
      onRefresh={query.refetch}
      ListHeaderComponent={
        <View style={styles.header}>
          <PatientDetails patient={patient} />
          <PatientDentalChart teeth={patient.chart} />
          <Text accessibilityRole="header" style={patientStyles.heading}>
            Appointments with you
          </Text>
          <Text style={patientStyles.muted}>
            Open a completed visit to review notes, prescriptions and treatment
            plans. Shared photos and reports are available from its appointment
            details.
          </Text>
        </View>
      }
      renderItem={({ item }) => (
        <PatientVisitCard
          visit={item}
          onPress={() =>
            navigation.navigate(
              item.status === 'completed' ? 'Consultation' : 'Appointment',
              { appointmentId: item.id },
            )
          }
        />
      )}
      ItemSeparatorComponent={Separator}
      ListEmptyComponent={
        <View style={styles.empty}>
          <Empty title="No appointments yet" />
        </View>
      }
    />
  );
}

function Separator() {
  return <View style={styles.separator} />;
}
const styles = StyleSheet.create({
  content: { paddingHorizontal: 18, paddingTop: 4, paddingBottom: 22 },
  header: { gap: 12, paddingBottom: 12 },
  separator: { height: 12 },
  empty: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 12,
  },
});
