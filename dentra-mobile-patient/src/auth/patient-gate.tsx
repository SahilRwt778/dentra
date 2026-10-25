import { ActivityIndicator, View } from 'react-native';
import { usePatientQuery } from '@/api/patients';

type GateResult =
  | { status: 'loading' }
  | { status: 'needs-registration' }
  | { status: 'ready' }
  | { status: 'error'; retry: () => void };

/**
 * GET /patients/me 404s until the patient has completed registration
 * (see dentra-api's PatientsController) — this gate decides whether to
 * render the registration screen or the authenticated app, the same
 * role dentist-gate.tsx plays in dentra-web-dentist.
 */
export function usePatientGate(): GateResult {
  const { data, isLoading, isError, error, refetch } = usePatientQuery();

  if (isLoading) return { status: 'loading' };
  if (isError && (error as { status?: number })?.status === 404)
    return { status: 'needs-registration' };
  if (isError || !data) return { status: 'error', retry: refetch };
  return { status: 'ready' };
}

export function GateLoading() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator />
    </View>
  );
}
