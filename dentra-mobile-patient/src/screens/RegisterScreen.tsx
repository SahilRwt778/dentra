import { useState } from 'react';
import { Text, View } from 'react-native';
import { useRegisterPatientMutation } from '@/api/patients';
import type { PatientRegistration } from '@/api/types';
import { useAuth } from '@/auth/auth-context';
import { DateField } from '@/components/date-field';
import {
  Button,
  Card,
  Checkbox,
  Choice,
  ErrorState,
  Field,
  Screen,
  TextLink,
} from '@/components/ui';
import {
  ageFromDob,
  LANGUAGES,
  normalizeMobile,
  registrationError,
} from '@/lib/patient';
import { errorMessage } from '@/api/errors';
import { ui } from '@/theme';

export function RegisterScreen() {
  const [register, { isLoading }] = useRegisterPatientMutation();
  const { logout } = useAuth();
  const [form, setForm] = useState<PatientRegistration>({
    fullName: '',
    dateOfBirth: '',
    preferredLanguage: 'English',
    termsConsent: false,
    telemedicineConsent: false,
  });
  const [error, setError] = useState<string>();
  const today = new Date();
  const maximumDob = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
    23,
    59,
    59,
    999,
  );
  // Include every birthday whose completed age is at most 125.
  const minimumDob = new Date(today.getFullYear() - 126, today.getMonth(), 1);
  const lastDay = new Date(
    minimumDob.getFullYear(),
    today.getMonth() + 1,
    0,
  ).getDate();
  minimumDob.setDate(Math.min(today.getDate(), lastDay) + 1);
  const age = ageFromDob(form.dateOfBirth);
  const minor = age !== null && age < 18;
  function set<K extends keyof PatientRegistration>(
    key: K,
    value: PatientRegistration[K],
  ) {
    setForm(f => ({ ...f, [key]: value }));
  }
  async function submit() {
    const payload = {
      ...form,
      fullName: form.fullName.trim(),
      email: form.email?.trim() || undefined,
      guardianMobile: form.guardianMobile
        ? normalizeMobile(form.guardianMobile)
        : undefined,
    };
    const issue = registrationError(payload);
    if (issue) {
      setError(issue);
      return;
    }
    setError(undefined);
    try {
      await register(payload);
    } catch (err) {
      setError(
        errorMessage(err, 'We couldn’t create your account. Please try again.'),
      );
    }
  }
  return (
    <Screen
      title="Your account"
      footer={
        <Button
          title="Create my account"
          onPress={submit}
          loading={isLoading}
        />
      }
    >
      <Text style={ui.title}>Let’s set up your account</Text>
      <Text style={ui.muted}>A few details before your first booking.</Text>
      <Card>
        <Field
          label="Full name"
          value={form.fullName}
          onChangeText={v => set('fullName', v)}
          textContentType="name"
        />
        <DateField
          label="Date of birth"
          value={form.dateOfBirth}
          onChange={v => set('dateOfBirth', v)}
          placeholder="Select your date of birth"
          minimumDate={minimumDob}
          maximumDate={maximumDob}
          initialDate={
            new Date(
              today.getFullYear() - 25,
              today.getMonth(),
              today.getDate(),
              12,
            )
          }
        />
        <Text style={ui.label}>Gender</Text>
        <View style={ui.wrap}>
          {['Male', 'Female', 'Other', 'Prefer not to say'].map(v => (
            <Choice
              compact
              key={v}
              title={v}
              selected={form.gender === v}
              onPress={() => set('gender', v)}
            />
          ))}
        </View>
        <Field
          label="Email (optional)"
          value={form.email}
          onChangeText={v => set('email', v)}
          keyboardType="email-address"
          autoCapitalize="none"
          textContentType="emailAddress"
        />
        <Field
          label="City"
          value={form.city}
          onChangeText={v => set('city', v)}
          textContentType="addressCity"
        />
        <Text style={ui.label}>Preferred language</Text>
        <View style={ui.wrap}>
          {LANGUAGES.map(v => (
            <Choice
              compact
              key={v}
              title={v}
              selected={form.preferredLanguage === v}
              onPress={() => set('preferredLanguage', v)}
            />
          ))}
        </View>
      </Card>
      {minor ? (
        <Card>
          <Text style={ui.heading}>Guardian details</Text>
          <Text style={ui.muted}>
            A patient under 18 needs a guardian’s details and consent.
          </Text>
          <Field
            label="Guardian’s full name"
            value={form.guardianName}
            onChangeText={v => set('guardianName', v)}
          />
          <Field
            label="Relationship to patient"
            value={form.guardianRelationship}
            onChangeText={v => set('guardianRelationship', v)}
            placeholder="e.g. Mother or legal guardian"
          />
          <Field
            label="Guardian’s mobile number"
            value={form.guardianMobile}
            onChangeText={v => set('guardianMobile', v)}
            keyboardType="phone-pad"
          />
          <Checkbox
            title="I am the patient’s guardian and consent to this account and bookings on their behalf."
            value={!!form.guardianConsent}
            onChange={v => set('guardianConsent', v)}
          />
        </Card>
      ) : null}
      <Checkbox
        title="I agree to the terms of use and privacy notice."
        value={form.termsConsent}
        onChange={v => set('termsConsent', v)}
      />
      <Checkbox
        title="I consent to telemedicine consultations."
        value={form.telemedicineConsent}
        onChange={v => set('telemedicineConsent', v)}
      />
      {error ? <ErrorState message={error} /> : null}
      <TextLink title="Use a different account" onPress={() => void logout()} />
    </Screen>
  );
}
