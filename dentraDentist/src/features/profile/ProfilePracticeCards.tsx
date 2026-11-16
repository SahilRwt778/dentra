import React from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { CalendarDays, Clock3 } from 'lucide-react-native';
import type { Dentist } from '../../common/types/api';
import { colors } from '../../common/theme/theme';
import { formatTime, money } from '../../common/utils/date';
import { Card } from '../../components/ui/Card';
import { workingDaysLabel } from '../settings/availability/working-days';
import { SettingsCardHeader, settingsStyles } from '../settings/settings-ui';
import { ProfileLink } from './ProfileLink';

export function ProfilePracticeCards({
  dentist,
  updating,
  onClinics,
  onFees,
  onTimeOff,
  onToggleVideo,
}: {
  dentist: Dentist;
  updating: boolean;
  onClinics: () => void;
  onFees: () => void;
  onTimeOff: () => void;
  onToggleVideo: (enabled: boolean) => void;
}) {
  const hasVideoHours =
    dentist.offersVideo && dentist.videoHoursFrom && dentist.videoHoursTo;
  return (
    <>
      <Card style={settingsStyles.card}>
        <SettingsCardHeader
          title={`Locations${
            dentist.clinics.length > 1 ? ` (${dentist.clinics.length})` : ''
          }`}
          action="Manage"
          onPress={onClinics}
        />
        {dentist.clinics.length ? (
          dentist.clinics.map((clinic, index) => (
            <View
              key={clinic.id}
              style={[styles.clinic, index > 0 && styles.divider]}
            >
              <Text style={styles.clinicName}>{clinic.name}</Text>
              {!!clinic.addressLine && (
                <Text style={styles.description}>{clinic.addressLine}</Text>
              )}
              <View style={styles.schedule}>
                <View style={styles.scheduleRow}>
                  <CalendarDays size={14} color={colors.muted} />
                  <Text style={styles.scheduleText}>
                    {workingDaysLabel(clinic.workingDays)}
                  </Text>
                </View>
                <View style={styles.scheduleRow}>
                  <Clock3 size={14} color={colors.muted} />
                  <Text style={styles.scheduleText}>
                    {formatTime(clinic.hoursFrom)} –{' '}
                    {formatTime(clinic.hoursTo)}
                  </Text>
                </View>
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.description}>No clinics added.</Text>
        )}
      </Card>
      <Card style={settingsStyles.card}>
        <SettingsCardHeader
          title="Fees and hours"
          action="Edit"
          onPress={onFees}
        />
        <View style={styles.fees}>
          <View style={styles.fee}>
            <Text style={styles.description}>Video consult</Text>
            <Text style={styles.amount}>
              {dentist.offersVideo
                ? money(dentist.feeVideoPaise)
                : 'Not offered'}
            </Text>
          </View>
          <View style={styles.fee}>
            <Text style={styles.description}>In-clinic visit</Text>
            <Text style={styles.amount}>{money(dentist.feeClinicPaise)}</Text>
          </View>
        </View>
        <View style={styles.videoHours}>
          <Text style={styles.description}>Video consult hours</Text>
          {hasVideoHours ? (
            <>
              <Text style={styles.hoursText}>
                {workingDaysLabel(dentist.videoWorkingDays)}
              </Text>
              <Text style={styles.hoursText}>
                {formatTime(dentist.videoHoursFrom!)} –{' '}
                {formatTime(dentist.videoHoursTo!)}
              </Text>
            </>
          ) : (
            <Text style={styles.hoursText}>Not offered</Text>
          )}
        </View>
      </Card>
      <Card style={[settingsStyles.card, styles.videoToggle]}>
        <View style={styles.toggleDescription}>
          <Text style={styles.clinicName}>Offer video consults</Text>
          <Text style={styles.description}>
            When off, patients can only book in-clinic visits with you.
          </Text>
        </View>
        <Switch
          accessibilityLabel="Offer video consults"
          accessibilityState={{ busy: updating }}
          value={dentist.offersVideo}
          disabled={updating}
          trackColor={{ false: colors.line, true: colors.primary }}
          onValueChange={onToggleVideo}
        />
      </Card>
      <Card style={styles.linkCard}>
        <ProfileLink
          title="Time off"
          description="Manage leave and breaks"
          label="Manage Time off"
          icon={CalendarDays}
          onPress={onTimeOff}
        />
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  clinic: { gap: 5 },
  clinicName: {
    color: colors.ink,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '600',
  },
  description: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  schedule: { gap: 5, marginTop: 3 },
  scheduleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  scheduleText: { flex: 1, color: colors.muted, fontSize: 12, lineHeight: 18 },
  divider: { borderTopWidth: 1, borderColor: colors.line, paddingTop: 14 },
  fees: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  fee: { flex: 1, minWidth: 96, gap: 4 },
  amount: {
    color: colors.ink,
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '600',
  },
  videoHours: {
    borderTopWidth: 1,
    borderColor: colors.line,
    paddingTop: 12,
    gap: 4,
  },
  hoursText: { color: colors.ink, fontSize: 14, lineHeight: 21 },
  videoToggle: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  toggleDescription: { flex: 1, gap: 4 },
  linkCard: { padding: 0, gap: 0, borderRadius: 14, overflow: 'hidden' },
});
