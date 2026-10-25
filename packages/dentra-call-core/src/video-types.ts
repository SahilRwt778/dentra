export type VideoCredentials = {
  provider: 'livekit';
  serverUrl: string;
  token: string;
  identity: string;
  roomName: string;
  role: 'patient' | 'dentist';
  closesAt: string;
  issuedAt: string;
};
