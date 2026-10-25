import { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import {
  usePatientQuery,
  useUpdatePatientMutation,
  usePrivacyRequestMutation,
} from '@/api/patients';
import type { PatientUpdate } from '@/api/types';
import { useAuth } from '@/auth/auth-context';
import {
  Avatar,
  Button,
  Card,
  Choice,
  Detail,
  ErrorState,
  Field,
  Loading,
  Screen,
  TextLink,
} from '@/components/ui';
import { formatDate, LANGUAGES } from '@/lib/patient';
import { errorMessage } from '@/api/errors';
import { ui } from '@/theme';

export function ProfileScreen() {
  const { data: me, isLoading, error, refetch } = usePatientQuery();
  const { logout } = useAuth();
  const [update, { isLoading: saving }] = useUpdatePatientMutation();
  const [request, { isLoading: requesting }] = usePrivacyRequestMutation();
  const [section, setSection] = useState<
    'personal' | 'medical' | 'emergency'
  >();
  const [draft, setDraft] = useState<PatientUpdate>({});
  const [message, setMessage] = useState<string>();
  const [notice, setNotice] = useState<string>();
  function edit(value: 'personal' | 'medical' | 'emergency') {
    setMessage(undefined);
    setNotice(undefined);
    setSection(value);
    setDraft(
      value === 'personal'
        ? {
            fullName: me?.fullName,
            email: me?.email ?? '',
            city: me?.city ?? '',
            preferredLanguage: me?.preferredLanguage,
          }
        : value === 'medical'
        ? {
            allergies: me?.allergies ?? '',
            conditions: me?.conditions ?? '',
            medications: me?.medications ?? '',
          }
        : { emergencyContact: me?.emergencyContact ?? '' },
    );
  }
  async function save() {
    if (section === 'personal' && !draft.fullName?.trim()) {
      setMessage('Enter your full name.');
      return;
    }
    if (draft.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email)) {
      setMessage('Enter a valid email address.');
      return;
    }
    setMessage(undefined);
    try {
      await update(draft);
      setSection(undefined);
      setNotice('Your details have been saved.');
    } catch (err) {
      setMessage(errorMessage(err));
    }
  }
  function privacy(type: 'export' | 'erase') {
    Alert.alert(
      type === 'export'
        ? 'Request a copy of your data?'
        : 'Request account deletion?',
      type === 'export'
        ? 'Our team will process your export request.'
        : 'This sends a request to our team. Your account and records are not deleted immediately.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send request',
          onPress: () => {
            setMessage(undefined);
            void request(type)
              .then(result =>
                setNotice(
                  `Request received. Reference ${result.id}. Due ${formatDate(
                    result.slaDueAt,
                  )}.`,
                ),
              )
              .catch(err => setMessage(errorMessage(err)));
          },
        },
      ],
    );
  }
  const actions = (
    <View style={ui.stack}>
      <Button
        title="Save changes"
        onPress={() => void save()}
        loading={saving}
      />
      <Button
        title="Cancel"
        variant="secondary"
        disabled={saving}
        onPress={() => setSection(undefined)}
      />
    </View>
  );
  return (
    <Screen title="Profile" tabbed refreshing={false} onRefresh={refetch}>
      {error ? (
        <ErrorState retry={refetch} />
      ) : isLoading || !me ? (
        <Loading />
      ) : (
        <>
          <Card>
            <View style={ui.row}>
              <Avatar name={me.fullName} large />
              <View style={ui.grow}>
                <Text style={ui.heading}>{me.fullName}</Text>
                <Text style={ui.muted}>{me.mobile}</Text>
              </View>
            </View>
          </Card>
          {notice ? (
            <Card>
              <Text accessibilityRole="alert" style={ui.body}>
                {notice}
              </Text>
            </Card>
          ) : null}
          {message ? <ErrorState message={message} /> : null}
          <Card>
            <View style={ui.between}>
              <Text style={ui.heading}>Personal details</Text>
              <TextLink title="Edit" onPress={() => edit('personal')} />
            </View>
            {section === 'personal' ? (
              <>
                <Field
                  label="Full name"
                  value={draft.fullName}
                  onChangeText={v => setDraft(d => ({ ...d, fullName: v }))}
                />
                <Field
                  label="Email"
                  value={draft.email}
                  onChangeText={v => setDraft(d => ({ ...d, email: v }))}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
                <Field
                  label="City"
                  value={draft.city}
                  onChangeText={v => setDraft(d => ({ ...d, city: v }))}
                />
                <Text style={ui.label}>Preferred language</Text>
                <View style={ui.wrap}>
                  {LANGUAGES.map(v => (
                    <Choice
                      compact
                      key={v}
                      title={v}
                      selected={draft.preferredLanguage === v}
                      onPress={() =>
                        setDraft(d => ({ ...d, preferredLanguage: v }))
                      }
                    />
                  ))}
                </View>
                {actions}
              </>
            ) : (
              <>
                <Detail label="Name" value={me.fullName} />
                <Detail label="Mobile" value={me.mobile} />
                <Detail
                  label="Date of birth"
                  value={formatDate(me.dateOfBirth)}
                />
                <Detail label="Gender" value={me.gender} />
                <Detail label="Email" value={me.email} />
                <Detail label="City" value={me.city} />
                <Detail label="Language" value={me.preferredLanguage} />
              </>
            )}
          </Card>
          {me.guardian ? (
            <Card>
              <Text style={ui.heading}>Guardian</Text>
              <Detail label="Name" value={me.guardian.name} />
              <Detail label="Relationship" value={me.guardian.relationship} />
              <Detail label="Mobile" value={me.guardian.mobile} />
              <Detail
                label="Consent"
                value={formatDate(me.guardian.consentAt)}
              />
            </Card>
          ) : null}
          <Card>
            <View style={ui.between}>
              <Text style={ui.heading}>Medical history</Text>
              <TextLink title="Edit" onPress={() => edit('medical')} />
            </View>
            {section === 'medical' ? (
              <>
                {(['allergies', 'conditions', 'medications'] as const).map(
                  key => (
                    <Field
                      key={key}
                      label={
                        {
                          allergies: 'Allergies',
                          conditions: 'Medical conditions',
                          medications: 'Regular medicines',
                        }[key]
                      }
                      value={draft[key]}
                      onChangeText={v => setDraft(d => ({ ...d, [key]: v }))}
                      multiline
                    />
                  ),
                )}
                {actions}
              </>
            ) : (
              <>
                <Detail label="Allergies" value={me.allergies} />
                <Detail label="Conditions" value={me.conditions} />
                <Detail label="Medicines" value={me.medications} />
                <Text style={ui.small}>
                  Your treating dentist can see this before your consultation.
                </Text>
              </>
            )}
          </Card>
          <Card>
            <View style={ui.between}>
              <Text style={ui.heading}>Emergency contact</Text>
              <TextLink title="Edit" onPress={() => edit('emergency')} />
            </View>
            {section === 'emergency' ? (
              <>
                <Field
                  label="Name, relationship and phone"
                  value={draft.emergencyContact}
                  onChangeText={v =>
                    setDraft(d => ({ ...d, emergencyContact: v }))
                  }
                  multiline
                />
                {actions}
              </>
            ) : (
              <Text style={ui.body}>
                {me.emergencyContact || 'Not added yet.'}
              </Text>
            )}
          </Card>
          <Card>
            <Text style={ui.heading}>Privacy and your data</Text>
            <Text style={ui.muted}>
              Request a copy of your information or ask our team to delete your
              account.
            </Text>
            <Button
              title="Request my data"
              variant="secondary"
              disabled={requesting}
              onPress={() => privacy('export')}
            />
            <Button
              title="Request account deletion"
              variant="danger"
              disabled={requesting}
              onPress={() => privacy('erase')}
            />
          </Card>
          <Button
            title="Log out"
            variant="secondary"
            onPress={() => {
              void logout();
            }}
          />
        </>
      )}
    </Screen>
  );
}
