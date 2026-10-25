const KEY = 'dentra_admin_device_id';

export function getDeviceId(): string {
  const existing = localStorage.getItem(KEY);
  if (existing) return existing;
  const id = `admin-web-${crypto.randomUUID()}`;
  localStorage.setItem(KEY, id);
  return id;
}
