import type { VideoCredentials } from '@dentra/call-core';
export function testVideoCredentials(
  role: 'patient' | 'dentist',
  sequence = 1
): VideoCredentials {
  return {
    provider: 'livekit',
    serverUrl: 'wss://synthetic.livekit.test',
    token: `synthetic-token-${sequence}`,
    identity: `${role}-${sequence}`,
    roomName: 'synthetic-room',
    role,
    issuedAt: new Date().toISOString(),
    closesAt: new Date(Date.now() + 600000).toISOString(),
  };
}
