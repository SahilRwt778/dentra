/** Android emulators reach the development computer's loopback through this alias. */
export function videoClientUrl(serverUrl: string, platform: string) {
  const url = new URL(serverUrl);
  if (
    platform === 'android' &&
    ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  )
    url.hostname = '10.0.2.2';
  return url.toString().replace(/\/$/, '');
}
