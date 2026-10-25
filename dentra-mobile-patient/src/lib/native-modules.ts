import { TurboModuleRegistry } from 'react-native';

export const ATTACHMENTS_UPDATE_MESSAGE =
  'Attachments are unavailable in this app version. Please update Dentra and try again.';

export function hasNativeModule(name: string) {
  return TurboModuleRegistry.get(name) != null;
}

export function requireNativeModule(name: string) {
  if (!hasNativeModule(name)) throw new Error(ATTACHMENTS_UPDATE_MESSAGE);
}
