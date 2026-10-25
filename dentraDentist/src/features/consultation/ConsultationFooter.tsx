import React from 'react';
import { Text } from 'react-native';
import { Button } from '../../components/ui/Button';
import type { ConsultationSection } from './ConsultationSections';
import { consultationStyles as styles } from './consultation.styles';

type DraftStatus = {
  saving: boolean;
  dirty: boolean;
  savedSuccessfully: boolean;
  save: () => void;
};
const LABELS = {
  note: { save: 'Save draft', saved: 'Draft saved' },
  chart: { save: 'Save chart', saved: 'Chart saved' },
  rx: { save: 'Save prescription', saved: 'Prescription saved' },
  plan: { save: 'Save treatment plan', saved: 'Treatment plan saved' },
};
function statusMessage(draft: DraftStatus, section: ConsultationSection) {
  if (draft.saving) return 'Saving draft…';
  if (draft.dirty) return 'Unsaved changes';
  if (draft.savedSuccessfully) return LABELS[section].saved;
  return `Changes are saved when you tap ${LABELS[section].save}.`;
}

export function ConsultationFooter({
  section,
  draft,
  otherDirty,
  disabled,
}: {
  section: ConsultationSection;
  draft: DraftStatus;
  otherDirty: boolean;
  disabled: boolean;
}) {
  return (
    <>
      <Text accessibilityLiveRegion="polite" style={styles.message}>
        {statusMessage(draft, section)}
      </Text>
      {otherDirty && (
        <Text style={styles.body}>
          Other sections also have unsaved changes.
        </Text>
      )}
      <Button
        title={LABELS[section].save}
        variant="secondary"
        loading={draft.saving}
        disabled={!draft.dirty || disabled}
        onPress={draft.save}
      />
    </>
  );
}
