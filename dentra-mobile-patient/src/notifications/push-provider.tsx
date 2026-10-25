import { useEffect, useState, type ReactNode } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { Bell, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiCache } from '@/api/cache';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  patientNavigationRef,
  whenPatientNavigationReady,
} from '@/navigation/navigation-ref';
import { colors } from '@/theme';
import { PushContext } from './push-context';
import {
  currentPushSession,
  pushRequest,
  resolvePushNotification,
  sessionFromToken,
} from './push-session';
import {
  reconcilePatientPush,
  startPatientPush,
  type PushState,
} from './push-manager';

export function PatientPushProvider({ children }: { children: ReactNode }) {
  const token = useAppSelector(value => value.auth.accessToken);
  const key = sessionFromToken(token)?.key;
  const dispatch = useAppDispatch();
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<PushState>('unavailable');
  const [banner, setBanner] = useState<string>();

  useEffect(() => {
    const scope = currentPushSession();
    if (!key || scope?.key !== key) return;
    let live = true;
    const controller = new AbortController();
    const refresh = () =>
      dispatch(
        apiCache.invalidateTags([
          'Notifications',
          'Appointments',
          'Consultations',
          'Patients',
        ]),
      );
    async function open(id: string) {
      try {
        const notification = await resolvePushNotification(
          scope!,
          id,
          controller.signal,
        );
        if (!notification || !live || currentPushSession()?.key !== key) return;
        setBanner(undefined);
        whenPatientNavigationReady(() => {
          if (!live || currentPushSession()?.key !== key) return;
          patientNavigationRef.navigate(
            notification.type === 'visit_summary_ready'
              ? 'Visit'
              : 'Appointment',
            { appointmentId: notification.appointmentId },
          );
        });
        pushRequest(
          scope!,
          `/notifications/${id}/read`,
          'PATCH',
          undefined,
          controller.signal,
        )
          .then(refresh)
          .catch(() => undefined);
      } catch {
        /* A notification belonging to a previous account is ignored. */
      }
    }
    const stop = startPatientPush(scope, {
      state: value => {
        if (live) setState(value);
      },
      message: id => {
        refresh();
        setBanner(id);
      },
      open: id => {
        open(id);
      },
    });
    const subscription = AppState.addEventListener('change', value => {
      if (value === 'active') reconcilePatientPush();
    });
    return () => {
      live = false;
      controller.abort();
      stop();
      subscription.remove();
    };
  }, [key, dispatch]);

  useEffect(() => {
    if (!banner) return;
    const timer = setTimeout(() => setBanner(undefined), 8000);
    return () => clearTimeout(timer);
  }, [banner]);

  async function openBanner() {
    const scope = currentPushSession();
    if (!scope || !banner) return;
    try {
      const notification = await resolvePushNotification(
        scope,
        banner,
        new AbortController().signal,
      );
      if (notification && currentPushSession()?.key === scope.key) {
        patientNavigationRef.navigate(
          notification.type === 'visit_summary_ready' ? 'Visit' : 'Appointment',
          { appointmentId: notification.appointmentId },
        );
        pushRequest(scope, `/notifications/${banner}/read`, 'PATCH').catch(
          () => undefined,
        );
      }
    } finally {
      setBanner(undefined);
    }
  }

  return (
    <PushContext value={{ state, enable: () => reconcilePatientPush(true) }}>
      <View style={s.root}>
        {children}
        {banner && (
          <View
            style={[s.banner, { top: insets.top + 8 }]}
            accessibilityLiveRegion="polite"
          >
            <Pressable
              style={s.content}
              accessibilityRole="button"
              accessibilityLabel="New Dentra appointment update. View update"
              onPress={() => {
                openBanner().catch(() => undefined);
              }}
            >
              <Bell size={22} color={colors.accent} />
              <View style={s.copy}>
                <Text style={s.title}>New appointment update</Text>
                <Text style={s.body}>Tap to view your update.</Text>
              </View>
            </Pressable>
            <Pressable
              style={s.close}
              accessibilityRole="button"
              accessibilityLabel="Dismiss update"
              onPress={() => setBanner(undefined)}
            >
              <X size={18} color={colors.muted} />
            </Pressable>
          </View>
        )}
      </View>
    </PushContext>
  );
}
const s = StyleSheet.create({
  root: { flex: 1 },
  banner: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 100,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    elevation: 8,
    shadowColor: '#10283A',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  copy: { flex: 1, gap: 4 },
  title: { fontSize: 15, fontWeight: '600', color: colors.ink },
  body: { fontSize: 13, color: colors.muted },
  close: { padding: 14, justifyContent: 'center' },
});
