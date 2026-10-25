import React, { useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Check, FileText, Upload } from 'lucide-react-native';
import { dentistsApi } from '../../api/dentists.api';
import type {
  Dentist,
  DocumentType,
  LocalDocument,
} from '../../common/types/api';
import { chooseDocument } from '../../common/services/document-picker';
import { errorMessage } from '../../common/utils/api-error';
import { colors, layout } from '../../common/theme/theme';
import { Brand } from '../../components/icons/Brand';
import { FormScreen } from '../../components/ui/Screen';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { ErrorMessage } from '../../components/ui/Feedback';
import { Field } from '../../components/forms/Field';
import { useAuth } from '../auth/AuthProvider';
import {
  initialForm,
  specialties,
  toApplication,
  type ApplicationForm,
} from './application-form';

const documents: { type: DocumentType; label: string; required: boolean }[] = [
  { type: 'degree', label: 'Degree certificate (BDS / MDS)', required: true },
  { type: 'council', label: 'Dental Council registration', required: true },
  { type: 'id_proof', label: 'Government photo ID', required: true },
  { type: 'selfie', label: 'Selfie photo', required: true },
  {
    type: 'clinic_proof',
    label: 'Clinic establishment proof',
    required: false,
  },
  {
    type: 'insurance',
    label: 'Professional indemnity insurance',
    required: false,
  },
];
export function OnboardingScreen({
  dentist,
  onSubmitted,
}: {
  dentist: Dentist | null;
  onSubmitted: () => void;
}) {
  const { signOut } = useAuth();
  const [form, setForm] = useState(() => initialForm(dentist));
  const [draft, setDraft] = useState(dentist);
  const [files, setFiles] = useState<
    Partial<Record<DocumentType, LocalDocument>>
  >({});
  const [uploaded, setUploaded] = useState(
    () => new Set(dentist?.documents.map(doc => doc.docType)),
  );
  const [progress, setProgress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);
  const busy = !!progress;
  function update<K extends keyof ApplicationForm>(
    key: K,
    value: ApplicationForm[K],
  ) {
    setForm(current => ({ ...current, [key]: value }));
  }
  async function selectFile(type: DocumentType) {
    if (lock.current) return;
    lock.current = true;
    setError(null);
    try {
      const file = await chooseDocument(type === 'selfie');
      if (file) setFiles(current => ({ ...current, [type]: file }));
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      lock.current = false;
    }
  }
  async function submit() {
    if (lock.current) return;
    lock.current = true;
    setError(null);
    try {
      const payload = toApplication(form);
      // Recover any draft/uploads after a lost creation response before sending another POST.
      setProgress('Checking your saved application…');
      const existing = await dentistsApi.getMe();
      if (existing && existing.status !== 'draft') {
        onSubmitted();
        return;
      }
      const have = new Set([
        ...(existing?.documents ?? []).map(doc => doc.docType),
        ...uploaded,
      ]);
      const missing = documents.filter(
        doc => doc.required && !have.has(doc.type) && !files[doc.type],
      );
      if (missing.length)
        throw new Error(
          `Add required documents: ${missing
            .map(doc => doc.label)
            .join(', ')}.`,
        );
      setProgress('Saving your details…');
      const saved = await dentistsApi.saveApplication(payload, !!existing);
      setDraft(saved);
      for (const doc of documents) {
        const file = files[doc.type];
        if (!file) continue;
        setProgress(`Uploading ${doc.label.toLowerCase()}…`);
        await dentistsApi.uploadDocument(saved.id, doc.type, file);
        setUploaded(current => new Set([...current, doc.type]));
        setFiles(current => {
          const next = { ...current };
          delete next[doc.type];
          return next;
        });
      }
      setProgress('Sending your request to the admin…');
      await dentistsApi.submitApplication();
      onSubmitted();
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      lock.current = false;
      setProgress('');
    }
  }
  return (
    <FormScreen>
      <Brand />
      <View style={layout.stack}>
        <Text style={layout.title}>Apply to join Dentra</Text>
        <Text style={layout.muted}>
          Your mobile number is verified
          {dentist?.mobile ? `: ${dentist.mobile}` : ''}. Add your details and
          documents for admin review.
        </Text>
      </View>
      <Card>
        <Text style={layout.heading}>Professional details</Text>
        <Field
          label="Full name"
          value={form.fullName}
          onChangeText={value => update('fullName', value)}
          autoComplete="name"
          editable={!busy}
        />
        <Field
          label="Email (optional)"
          value={form.email}
          onChangeText={value => update('email', value)}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          editable={!busy}
        />
        <Field
          label="Qualification"
          value={form.qualification}
          onChangeText={value => update('qualification', value)}
          placeholder="BDS, MDS"
          editable={!busy}
        />
        <Text style={layout.label}>Specialization</Text>
        <View style={styles.chips}>
          {specialties.map(value => (
            <Pressable
              key={value}
              accessibilityRole="button"
              accessibilityState={{
                selected: form.specialization === value,
                disabled: busy,
              }}
              disabled={busy}
              onPress={() => update('specialization', value)}
              style={[
                styles.chip,
                form.specialization === value && styles.selectedChip,
              ]}
            >
              <Text
                style={
                  form.specialization === value
                    ? styles.selectedText
                    : layout.muted
                }
              >
                {value}
              </Text>
            </Pressable>
          ))}
        </View>
        <Field
          label="Dental Council registration number"
          value={form.councilRegNo}
          onChangeText={value => update('councilRegNo', value)}
          autoCapitalize="characters"
          editable={!busy}
        />
        <Field
          label="Years of experience"
          value={form.yearsExperience}
          onChangeText={value => update('yearsExperience', value)}
          keyboardType="number-pad"
          maxLength={3}
          editable={!busy}
        />
        <Field
          label="Languages spoken (comma separated)"
          value={form.languages}
          onChangeText={value => update('languages', value)}
          placeholder="English, Hindi"
          editable={!busy}
        />
      </Card>
      <Card>
        <Text style={layout.heading}>Your practice</Text>
        <Field
          label="Primary clinic name and address"
          value={form.primaryClinicName}
          onChangeText={value => update('primaryClinicName', value)}
          editable={!busy}
        />
        <Field
          label="In-clinic consultation fee (₹)"
          value={form.feeClinic}
          onChangeText={value => update('feeClinic', value)}
          keyboardType="decimal-pad"
          editable={!busy}
        />
        <View style={layout.between}>
          <Text style={layout.body}>Offer video consultations</Text>
          <Switch
            accessibilityLabel="Offer video consultations"
            value={form.offersVideo}
            disabled={busy}
            onValueChange={value => update('offersVideo', value)}
            trackColor={{ true: colors.primary }}
          />
        </View>
        {form.offersVideo && (
          <Field
            label="Video consultation fee (₹)"
            value={form.feeVideo}
            onChangeText={value => update('feeVideo', value)}
            keyboardType="decimal-pad"
            editable={!busy}
          />
        )}
      </Card>
      <Card>
        <Text style={layout.heading}>Verification documents</Text>
        <Text style={layout.muted}>
          JPEG, PNG or PDF, up to 10 MB each. Your selfie must be a JPEG or PNG
          photo.
        </Text>
        {documents.map(doc => {
          const file = files[doc.type];
          const added = !!file || uploaded.has(doc.type);
          return (
            <View key={doc.type} style={styles.document}>
              <View style={layout.between}>
                <View style={styles.documentName}>
                  <Text style={layout.label}>{doc.label}</Text>
                  <Text style={layout.muted}>
                    {doc.required ? 'Required' : 'Optional'}
                  </Text>
                </View>
                {added ? (
                  <Check size={21} color={colors.primary} />
                ) : (
                  <Upload size={21} color={colors.muted} />
                )}
              </View>
              {file?.type.startsWith('image/') && (
                <Image
                  accessibilityLabel={`Selected ${doc.label}`}
                  source={{ uri: file.uri }}
                  style={styles.preview}
                  resizeMode="contain"
                />
              )}
              {file && (
                <View style={layout.row}>
                  <FileText size={16} color={colors.muted} />
                  <Text style={styles.filename} numberOfLines={2}>
                    {file.name}
                  </Text>
                </View>
              )}
              {!file && uploaded.has(doc.type) && (
                <Text style={styles.saved}>Uploaded securely</Text>
              )}
              <Button
                title={
                  added
                    ? `Replace ${doc.label.toLowerCase()}`
                    : `Add ${doc.label.toLowerCase()}`
                }
                variant="secondary"
                disabled={busy}
                onPress={() => {
                  selectFile(doc.type);
                }}
              />
            </View>
          );
        })}
      </Card>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: form.terms, disabled: busy }}
        disabled={busy}
        onPress={() => update('terms', !form.terms)}
        style={styles.consent}
      >
        <View style={[styles.checkbox, form.terms && styles.checked]}>
          {form.terms && <Check size={18} color={colors.surface} />}
        </View>
        <Text style={styles.consentText}>
          I agree to the platform terms of service and the Telemedicine Practice
          Guidelines (2020).
        </Text>
      </Pressable>
      <ErrorMessage message={error} />
      {draft && (
        <Text style={layout.muted}>
          Your details are saved as a draft. The admin receives your request
          after submission.
        </Text>
      )}
      <Button
        title={progress || 'Submit application to admin'}
        loading={busy}
        onPress={submit}
      />
      <Button
        title="Log out"
        variant="secondary"
        disabled={busy}
        onPress={() => {
          signOut().catch(failure => setError(errorMessage(failure)));
        }}
      />
    </FormScreen>
  );
}
const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    padding: 12,
  },
  selectedChip: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  selectedText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
    lineHeight: 21,
  },
  document: {
    borderTopWidth: 1,
    borderColor: colors.line,
    paddingTop: 16,
    gap: 12,
  },
  documentName: { flex: 1, gap: 4 },
  filename: { color: colors.muted, fontSize: 13, flex: 1 },
  preview: {
    width: 144,
    height: 108,
    borderRadius: 12,
    backgroundColor: colors.background,
  },
  saved: { color: colors.primary, fontSize: 13 },
  consent: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    paddingVertical: 6,
  },
  consentText: { flex: 1, color: colors.ink, fontSize: 14, lineHeight: 22 },
  checkbox: {
    width: 26,
    height: 26,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 7,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checked: { backgroundColor: colors.primary, borderColor: colors.primary },
});
