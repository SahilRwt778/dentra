import { createNavigationContainerRef } from '@react-navigation/native';
import type { PatientStackParams } from './types';

export const patientNavigationRef =
  createNavigationContainerRef<PatientStackParams>();
let pending: (() => void) | undefined;
export function whenPatientNavigationReady(action: () => void) {
  if (patientNavigationRef.isReady()) action();
  else pending = action;
}
export function flushReadyNavigation() {
  const action = pending;
  pending = undefined;
  action?.();
}
