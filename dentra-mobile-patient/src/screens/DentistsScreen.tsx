import { Text, View } from 'react-native';
import { useDentistQuery } from '@/api/dentists';
import { DentistPicker } from '@/components/dentist-picker';
import {
  Avatar,
  Badge,
  Button,
  Card,
  Detail,
  ErrorState,
  Loading,
  Screen,
  Section,
} from '@/components/ui';
import { formatTime, rupees } from '@/lib/patient';
import type { PatientScreenProps } from '@/navigation/types';
import { ui } from '@/theme';

export function DentistsScreen({ navigation }: PatientScreenProps<'Dentists'>) {
  return (
    <Screen title="Find a dentist" onBack={navigation.goBack}>
      <Text style={ui.muted}>Verified dentists, care that fits your day.</Text>
      <DentistPicker
        onSelect={d => navigation.navigate('Dentist', { dentistId: d.id! })}
      />
    </Screen>
  );
}

export function DentistScreen({
  route,
  navigation,
}: PatientScreenProps<'Dentist'>) {
  const {
    data: d,
    isLoading,
    error,
    refetch,
  } = useDentistQuery(route.params.dentistId);
  return (
    <Screen
      title="Dentist"
      onBack={navigation.goBack}
      footer={
        d ? (
          <Button
            title={`Book with ${d.fullName}`}
            onPress={() => navigation.navigate('Booking', { dentistId: d.id })}
          />
        ) : undefined
      }
    >
      {error ? (
        <ErrorState retry={refetch} />
      ) : isLoading || !d ? (
        <Loading />
      ) : (
        <>
          <Card style={{ alignItems: 'center' }}>
            <Avatar name={d.fullName} large />
            <Text style={ui.title}>{d.fullName}</Text>
            <Text style={ui.muted}>{d.qualification}</Text>
            <View style={ui.wrap}>
              <Badge title="Verified" tone="green" />
              <Badge title={d.specialization ?? 'Dentist'} />
            </View>
          </Card>
          <Card>
            <Detail
              label="Experience"
              value={`${d.yearsExperience ?? 0} years`}
            />
            <Detail label="Languages" value={d.languages?.join(', ')} />
            <Detail label="Registration" value={d.councilRegNo} />
          </Card>
          <Section title="Locations">
            {d.clinics?.map(clinic => (
              <Card key={clinic.id}>
                <Text style={ui.heading}>{clinic.name}</Text>
                {clinic.addressLine ? (
                  <Text style={ui.muted}>
                    {clinic.addressLine}
                    {clinic.pincode ? `, ${clinic.pincode}` : ''}
                  </Text>
                ) : null}
                <Text style={ui.muted}>
                  {formatTime(clinic.hoursFrom)} – {formatTime(clinic.hoursTo)}
                </Text>
              </Card>
            ))}
          </Section>
          <Card>
            <Text style={ui.heading}>Consultation fees</Text>
            {d.clinics?.length ? (
              <Detail label="In-clinic" value={rupees(d.feeClinicPaise)} />
            ) : null}
            {d.offersVideo ? (
              <>
                <Detail label="Video" value={rupees(d.feeVideoPaise)} />
                <Detail
                  label="Video hours"
                  value={`${formatTime(
                    d.videoHoursFrom ?? undefined,
                  )} – ${formatTime(d.videoHoursTo ?? undefined)}`}
                />
              </>
            ) : (
              <Text style={ui.muted}>
                This dentist offers in-clinic visits.
              </Text>
            )}
          </Card>
        </>
      )}
    </Screen>
  );
}
