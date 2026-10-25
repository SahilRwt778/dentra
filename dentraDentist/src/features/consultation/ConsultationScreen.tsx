import React, { useState } from 'react';
import { Text } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { StackParamList } from '../../navigation/types';
import type { Appointment } from '../../common/types/api';
import type { Consultation } from '../../common/types/consultation';
import {
  useGetAppointmentQuery,
  useGetConsultationQuery,
} from '../../store/dentraApi';
import { useForegroundRefresh } from '../../common/hooks/useForegroundRefresh';
import { errorMessage } from '../../common/utils/api-error';
import { FormScreen } from '../../components/ui/FormScreen';
import { Button } from '../../components/ui/Button';
import { Empty, ErrorMessage, Loading } from '../../components/ui/Feedback';
import {
  ConsultationPatient,
  ConsultationVideo,
  ReportedConcern,
} from './ConsultationContext';
import { useClinicalNote } from './useClinicalNote';
import { ClinicalNoteFields } from './ClinicalNoteFields';
import { useDentalChart } from './dental-chart/useDentalChart';
import { DentalChartSection } from './dental-chart/DentalChartSection';
import {
  ConsultationSections,
  type ConsultationSection,
} from './ConsultationSections';
import { useDraftExitGuard } from './useDraftExitGuard';
import { ConsultationFooter } from './ConsultationFooter';
import { usePrescription } from './prescription/usePrescription';
import { PrescriptionSection } from './prescription/PrescriptionSection';
import { consultationStyles as styles } from './consultation.styles';
import { useTreatmentPlan } from './treatment-plan/useTreatmentPlan';
import { TreatmentPlanSection } from './treatment-plan/TreatmentPlanSection';
import { useConsultationCompletion } from './useConsultationCompletion';
import { Card } from '../../components/ui/Card';

export function ConsultationScreen({
  route,
  navigation,
}: NativeStackScreenProps<StackParamList, 'Consultation'>) {
  const id = route.params.appointmentId;
  const focused = useIsFocused();
  const appointmentQuery = useGetAppointmentQuery(id);
  const consultationQuery = useGetConsultationQuery(id, {
    skip: !appointmentQuery.currentData,
  });
  // Check whether another device has completed/cancelled the visit without replacing the form.
  useForegroundRefresh(appointmentQuery.refetch, focused, 15000);
  const appointment = appointmentQuery.currentData;
  const consultation = consultationQuery.currentData;
  function retry() {
    appointmentQuery.refetch();
    if (appointment) consultationQuery.refetch();
  }
  const error = appointmentQuery.error || consultationQuery.error;
  if ((!appointment || !consultation) && error)
    return (
      <FormScreen>
        <Empty
          title="Could not load consultation"
          text={errorMessage(error)}
          retry={retry}
        />
      </FormScreen>
    );
  if (!appointment || !consultation)
    return (
      <FormScreen>
        <Loading text="Loading consultation…" />
      </FormScreen>
    );
  return (
    <ConsultationEditor
      key={id}
      appointment={appointment}
      consultation={consultation}
      loadError={error ? errorMessage(error) : null}
      retry={retry}
      openAppointment={() =>
        navigation.navigate('Appointment', { appointmentId: id })
      }
    />
  );
}

function ConsultationEditor({
  appointment: initialAppointment,
  consultation,
  loadError,
  retry,
  openAppointment,
}: {
  appointment: Appointment;
  consultation: Consultation;
  loadError: string | null;
  retry: () => void;
  openAppointment: () => void;
}) {
  const [completedAppointment, setCompletedAppointment] =
    useState<Appointment | null>(null);
  const appointment = completedAppointment ?? initialAppointment;
  const note = useClinicalNote(appointment, consultation);
  const [section, setSection] = useState<ConsultationSection>('note');
  const [chartOpened, setChartOpened] = useState(false);
  const [rxOpened, setRxOpened] = useState(false);
  const chart = useDentalChart(appointment, chartOpened);
  const rx = usePrescription(appointment, consultation, rxOpened);
  const plan = useTreatmentPlan(appointment, consultation);
  const drafts = { note, chart, rx, plan };
  const saving = note.saving || chart.saving || rx.saving || plan.saving;
  const completion = useConsultationCompletion({
    appointment,
    note,
    chart,
    rx,
    plan,
    disabled: saving || !!loadError,
    selectSection: openSection,
    onCompleted: setCompletedAppointment,
  });
  const busy = saving || completion.busy;
  const draft = drafts[section];
  const otherDirty = Object.entries(drafts).some(
    ([key, value]) => key !== section && value.dirty,
  );
  const dirty = note.dirty || chart.dirty || rx.dirty || plan.dirty;
  useDraftExitGuard(dirty, busy);
  function openSection(next: ConsultationSection) {
    if (next === 'chart') setChartOpened(true);
    if (next === 'rx') setRxOpened(true);
    setSection(next);
  }
  function selectSection(next: ConsultationSection) {
    if (!busy) openSection(next);
  }
  async function previewPrescription() {
    if (busy) return;
    if (note.dirty && rx.editable && !(await note.save())) {
      setSection('note');
      return;
    }
    await rx.preview();
  }
  return (
    <FormScreen
      footer={
        appointment.status === 'in_consult' ? (
          <>
            {draft.editable && (section !== 'chart' || chart.form) && (
              <ConsultationFooter
                section={section}
                draft={draft}
                otherDirty={otherDirty}
                disabled={
                  !!loadError ||
                  completion.busy ||
                  (section === 'rx' && !rx.canSave) ||
                  (section === 'plan' && !plan.canSave)
                }
              />
            )}
            <ErrorMessage message={completion.error} />
            <Button
              title="Complete consultation"
              loading={completion.busy}
              disabled={saving || !!loadError}
              onPress={completion.request}
            />
          </>
        ) : undefined
      }
    >
      <ConsultationPatient appointment={appointment} />
      <ConsultationVideo appointment={appointment} />
      {appointment.status === 'completed' && !dirty && (
        <Card style={styles.card}>
          <Text accessibilityRole="header" style={styles.heading}>
            Consultation completed
          </Text>
          <Text style={styles.body}>
            The patient can view their visit summary. Review the saved records
            in the sections below.
          </Text>
          <Button
            title="View appointment and shared files"
            variant="secondary"
            onPress={openAppointment}
          />
        </Card>
      )}
      <ConsultationSections
        selected={section}
        onSelect={selectSection}
        noteDirty={note.dirty}
        chartDirty={chart.dirty}
        rxDirty={rx.dirty}
        planDirty={plan.dirty}
        medicineCount={rx.items.length}
        disabled={busy}
      />
      {loadError && (
        <>
          <ErrorMessage message={loadError} />
          <Button title="Refresh visit" variant="secondary" onPress={retry} />
        </>
      )}
      {!note.editable && (
        <Text style={styles.body}>
          This visit is {appointment.status.replace(/_/g, ' ')}. Clinical
          records are read-only.
          {dirty
            ? ' Your unsaved changes are shown below and have not been saved.'
            : ''}
        </Text>
      )}
      {section === 'note' ? (
        <>
          <ClinicalNoteFields note={note} disabled={busy || !!loadError} />
          <ReportedConcern appointment={appointment} />
          <ErrorMessage message={note.error} />
        </>
      ) : section === 'chart' ? (
        <DentalChartSection chart={chart} disabled={busy || !!loadError} />
      ) : section === 'plan' ? (
        <TreatmentPlanSection plan={plan} disabled={busy || !!loadError} />
      ) : (
        <PrescriptionSection
          rx={rx}
          disabled={busy || !!loadError}
          onPreview={previewPrescription}
        />
      )}
    </FormScreen>
  );
}
