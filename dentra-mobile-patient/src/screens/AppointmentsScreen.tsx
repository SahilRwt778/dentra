import { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { CalendarDays } from 'lucide-react-native';
import { AppointmentCard } from '@/components/appointment-card';
import {
  Button,
  Empty,
  ErrorState,
  Loading,
  Screen,
  Segments,
} from '@/components/ui';
import { useAppointments } from '@/hooks/use-appointments';
import { activeAppointment, appointmentOrder } from '@/lib/patient';
import type { PatientNavigation } from '@/navigation/types';

export function AppointmentsScreen() {
  const [segment, setSegment] = useState<'Upcoming' | 'Past'>('Upcoming');
  const nav = useNavigation<PatientNavigation>();
  const { items, isLoading, isFetching, error, refetch } = useAppointments();
  const list = items
    .filter(a =>
      segment === 'Upcoming' ? activeAppointment(a) : !activeAppointment(a),
    )
    .sort((a, b) =>
      segment === 'Upcoming' ? appointmentOrder(a, b) : appointmentOrder(b, a),
    );
  return (
    <Screen
      title="Appointments"
      tabbed
      refreshing={isFetching}
      onRefresh={refetch}
    >
      <Segments
        options={['Upcoming', 'Past'] as const}
        value={segment}
        onChange={setSegment}
      />
      {error ? (
        <ErrorState retry={refetch} />
      ) : isLoading ? (
        <Loading />
      ) : list.length ? (
        list.map(a => (
          <AppointmentCard
            key={a.id}
            appointment={a}
            onPress={() =>
              nav.navigate(a.status === 'completed' ? 'Visit' : 'Appointment', {
                appointmentId: a.id!,
              })
            }
          />
        ))
      ) : (
        <Empty
          icon={CalendarDays}
          title={
            segment === 'Upcoming'
              ? 'No upcoming appointments'
              : 'Your visits will appear here'
          }
          message={
            segment === 'Upcoming'
              ? 'Find a dentist and a time that works for you.'
              : 'Completed and cancelled appointments stay here for reference.'
          }
          action={
            segment === 'Upcoming' ? (
              <Button
                title="Book a visit"
                onPress={() => nav.navigate('Booking')}
              />
            ) : undefined
          }
        />
      )}
    </Screen>
  );
}
