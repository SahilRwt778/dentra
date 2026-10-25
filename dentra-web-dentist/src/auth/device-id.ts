// A stable per-browser-install identifier, the web equivalent of a
// mobile app's install ID — scopes the refresh token server-side so one
// browser's session can be revoked without touching the dentist's other
// devices (see dentra-api's refresh_tokens.device_id).
const DEVICE_ID_KEY = 'dentra_dentist_device_id';

export function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}
