import { useState } from 'react';
import { Share, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { FileText, FolderHeart } from 'lucide-react-native';
import { useConsultationQuery, useAppointmentQuery } from '@/api/appointments';
import { useDentalChartQuery } from '@/api/patients';
import { AppointmentCard } from '@/components/appointment-card';
import { DentalChart } from '@/components/dental-chart';
import {
  Avatar,
  Badge,
  Button,
  Card,
  Detail,
  Empty,
  ErrorState,
  Loading,
  Screen,
  Segments,
} from '@/components/ui';
import { useAppointments } from '@/hooks/use-appointments';
import { useVisitSummaries } from '@/hooks/use-visit-summaries';
import { appointmentOrder, formatDate, rupees } from '@/lib/patient';
import type { PatientNavigation, PatientScreenProps } from '@/navigation/types';
import { ui } from '@/theme';
import { AppointmentFiles, PatientFiles } from '@/components/patient-files';
import { CareDocumentDownloads } from '@/components/care-document-downloads';
import { TreatmentProcedures } from '@/components/treatment-procedures';

export function RecordsScreen({
  prescriptions = false,
}: {
  prescriptions?: boolean;
}) {
  const nav = useNavigation<PatientNavigation>();
  const [segment, setSegment] = useState<
    'Visits' | 'Prescriptions' | 'Chart' | 'Files'
  >(prescriptions ? 'Prescriptions' : 'Visits');
  const { items, isLoading, isFetching, error, refetch } = useAppointments();
  const {
    data: chart,
    isLoading: chartLoading,
    error: chartError,
    refetch: refreshChart,
  } = useDentalChartQuery({
    refetchOnMountOrArgChange: true,
  });
  const {
    summaries,
    loading: summariesLoading,
    error: summariesError,
  } = useVisitSummaries(items);
  const visits = items
    .filter(a => a.status === 'completed')
    .sort((a, b) => appointmentOrder(b, a));
  const prescribed = visits.filter(
    a => !!summaries[a.id!]?.prescription?.items?.length,
  );
  return (
    <Screen
      title="My records"
      tabbed
      refreshing={isFetching}
      onRefresh={() => {
        void refetch();
        void refreshChart();
      }}
    >
      <Segments
        options={['Visits', 'Prescriptions', 'Chart', 'Files'] as const}
        value={segment}
        onChange={setSegment}
      />
      {segment === 'Files' ? (
        <PatientFiles />
      ) : segment === 'Chart' ? (
        chartError ? (
          <ErrorState retry={refreshChart} />
        ) : chartLoading ? (
          <Loading />
        ) : (
          <Card>
            <DentalChart entries={chart ?? []} />
          </Card>
        )
      ) : error ? (
        <ErrorState retry={refetch} />
      ) : isLoading ? (
        <Loading />
      ) : segment === 'Visits' ? (
        visits.length ? (
          visits.map(a => (
            <AppointmentCard
              key={a.id}
              appointment={a}
              onPress={() => nav.navigate('Visit', { appointmentId: a.id! })}
            />
          ))
        ) : (
          <Empty
            icon={FolderHeart}
            title="Your care, all together"
            message="Visit summaries will appear here after your first consultation."
          />
        )
      ) : segment === 'Prescriptions' ? (
        summariesError ? (
          <ErrorState
            message="We couldn’t load all prescriptions. Please refresh your records."
            retry={refetch}
          />
        ) : summariesLoading ? (
          <Loading />
        ) : prescribed.length ? (
          prescribed.map(a => (
            <Card
              key={a.id}
              onPress={() => nav.navigate('Visit', { appointmentId: a.id! })}
            >
              <View style={ui.row}>
                <Avatar name={a.dentistName} />
                <View style={ui.grow}>
                  <Text style={ui.heading}>{a.dentistName}</Text>
                  <Text style={ui.muted}>{formatDate(a.date)}</Text>
                </View>
              </View>
              <Text style={ui.body}>
                {summaries[a.id!].prescription?.items
                  ?.map(i => i.medicineName)
                  .join(', ')}
              </Text>
              <Badge
                title={
                  summaries[a.id!].prescription?.signedAt
                    ? 'Signed prescription'
                    : 'Unsigned draft'
                }
                tone={
                  summaries[a.id!].prescription?.signedAt ? 'green' : 'amber'
                }
              />
            </Card>
          ))
        ) : (
          <Empty
            icon={FileText}
            title="No prescriptions yet"
            message="Prescriptions from completed visits appear here."
          />
        )
      ) : null}
    </Screen>
  );
}

export function VisitScreen({
  route,
  navigation,
}: PatientScreenProps<'Visit'>) {
  const { appointmentId } = route.params;
  const appointment = useAppointmentQuery(appointmentId, {
    refetchOnMountOrArgChange: true,
  });
  const consult = useConsultationQuery(appointmentId, {
    skip: appointment.data?.status !== 'completed',
    refetchOnMountOrArgChange: true,
  });
  const a = appointment.data,
    c = consult.data;
  const [shareError, setShareError] = useState(false);
  async function share() {
    if (!a || !c) return;
    const text = [
      `Dentra — visit summary`,
      `${a.patientName ?? ''} · ${formatDate(a.date)}`,
      `Dentist: ${a.dentistName}`,
      `Diagnosis: ${c.diagnosis ?? '—'}`,
      `Treatment: ${c.treatmentDone ?? '—'}`,
      `Plan: ${c.plan ?? '—'}`,
      ...(c.planItems ?? []).map((item, index) => [
        `${index + 1}. ${item.procedure}`,
        item.teeth.length ? `Teeth: ${item.teeth.join(', ')}` : 'General treatment',
        item.estimatedCostPaise == null ? 'Cost not estimated' : `Estimated cost: ${rupees(item.estimatedCostPaise)}`,
      ].join('\n')),
      c.followUpDate ? `Follow-up: ${formatDate(c.followUpDate)}` : '',
      c.prescription?.signedAt
        ? `Prescription (${formatDate(
            c.prescription.signedAt,
          )}):\n${c.prescription.items
            ?.map(
              i =>
                `${i.medicineName} ${i.strength ?? ''} — ${i.dose}, ${
                  i.frequency
                }, ${i.duration}. ${i.instructions ?? ''}`,
            )
            .join('\n')}`
        : '',
    ]
      .filter(Boolean)
      .join('\n\n');
    try {
      await Share.share({ message: text, title: 'Dentra visit summary' });
    } catch {
      setShareError(true);
    }
  }
  return (
    <Screen
      title="Visit summary"
      onBack={navigation.goBack}
      footer={
        c ? (
          <Button title="Share visit summary" onPress={() => void share()} />
        ) : undefined
      }
    >
      {appointment.error || consult.error ? (
        <ErrorState
          retry={() => {
            void appointment.refetch();
            if (a?.status === 'completed') void consult.refetch();
          }}
        />
      ) : appointment.isLoading ? (
        <Loading />
      ) : a?.status !== 'completed' ? (
        <Empty
          title="This visit is not completed yet"
          message="Your dentist’s summary will appear after the consultation."
        />
      ) : consult.isLoading || !a || !c ? (
        <Loading />
      ) : (
        <>
          <Card>
            <View style={ui.row}>
              <Avatar name={a.dentistName} />
              <View style={ui.grow}>
                <Text style={ui.heading}>{a.dentistName}</Text>
                <Text style={ui.muted}>
                  {formatDate(a.date)} ·{' '}
                  {a.type === 'video' ? 'Video consult' : 'In-clinic visit'}
                </Text>
              </View>
            </View>
            {c.isEdited ? <Badge title="Updated by your dentist" /> : null}
          </Card>
          <AppointmentFiles appointmentId={appointmentId} />
          <CareDocumentDownloads
            appointmentId={appointmentId}
            hasPrescription={!!c.prescription?.signedAt && !!c.prescription.items?.length}
          />
          <Card>
            <Text style={ui.heading}>What your dentist found</Text>
            <Detail label="Reason" value={c.chiefComplaint || a.concern} />
            <Detail label="Findings" value={c.findings} />
            <Detail label="Diagnosis" value={c.diagnosis} />
            <Detail label="Treatment" value={c.treatmentDone} />
          </Card>
          <Card>
            <Text style={ui.heading}>Your treatment plan</Text>
            <Text style={ui.body}>
              {c.plan || 'No additional advice recorded.'}
            </Text>
            <TreatmentProcedures items={c.planItems} />
            {c.followUpDate ? (
              <>
                <Detail label="Follow-up" value={formatDate(c.followUpDate)} />
                <Button
                  title="Book a follow-up"
                  variant="secondary"
                  onPress={() =>
                    navigation.navigate('Booking', { dentistId: a.dentistId })
                  }
                />
              </>
            ) : null}
          </Card>
          {c.prescription?.items?.length ? (
            <Card>
              <Text style={ui.heading}>Prescription</Text>
              <Badge
                title={
                  c.prescription.signedAt
                    ? 'Signed by your dentist'
                    : 'Unsigned — check with your dentist'
                }
                tone={c.prescription.signedAt ? 'green' : 'amber'}
              />
              {c.prescription.items.map((item, index) => (
                <View key={index} style={ui.stack}>
                  <View style={ui.divider} />
                  <Text style={[ui.body, { fontWeight: '600' }]}>
                    {index + 1}. {item.medicineName} {item.strength}
                  </Text>
                  <Detail label="Dose" value={item.dose} />
                  <Detail label="Frequency" value={item.frequency} />
                  <Detail label="Duration" value={item.duration} />
                  {item.instructions ? (
                    <Text style={ui.muted}>{item.instructions}</Text>
                  ) : null}
                </View>
              ))}
              {c.prescription.signedAt ? (
                <Text style={ui.small}>
                  Signed {formatDate(c.prescription.signedAt)}
                </Text>
              ) : null}
            </Card>
          ) : null}
        </>
      )}
      {shareError ? (
        <ErrorState message="Couldn’t open the share sheet. Please try again." />
      ) : null}
    </Screen>
  );
}
