import React from 'react';
import { Text } from 'react-native';
import { Card } from '../../components/ui/Card';
import { Field } from '../../components/forms/Field';
import type { useClinicalNote } from './useClinicalNote';
import { consultationStyles as styles } from './consultation.styles';

export function ClinicalNoteFields({
  note,
  disabled = false,
}: {
  note: ReturnType<typeof useClinicalNote>;
  disabled?: boolean;
}) {
  const editable = note.editable && !note.saving && !disabled;
  return (
    <Card style={styles.card}>
      <Text style={styles.heading}>Clinical note</Text>
      <Field
        label="Chief complaint"
        value={note.form.chiefComplaint}
        editable={editable}
        onChangeText={value => note.change('chiefComplaint', value)}
      />
      <Field
        label="Examination findings"
        value={note.form.findings}
        multiline
        style={styles.multiline}
        placeholder="What you saw or what the patient showed on camera"
        editable={editable}
        onChangeText={value => note.change('findings', value)}
      />
      <Field
        label="Diagnosis"
        value={note.form.diagnosis}
        multiline
        placeholder="Required when completing the consultation"
        editable={editable}
        onChangeText={value => note.change('diagnosis', value)}
      />
      <Field
        label="Treatment done today"
        value={note.form.treatmentDone}
        multiline
        placeholder="For example: advice given"
        editable={editable}
        onChangeText={value => note.change('treatmentDone', value)}
      />
    </Card>
  );
}
