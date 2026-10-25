import { createHash } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import {
  AccessToken,
  RoomServiceClient,
  TokenVerifier,
} from 'livekit-server-sdk';
import type { AppConfig } from '@config/configuration';
import { VideoProviderService } from './video-provider.service';

const apiKey = 'synthetic-video-key';
const apiSecret = 'synthetic-video-secret-at-least-32-characters';
let provider: VideoProviderService;
beforeEach(() => {
  provider = new VideoProviderService(
    new ConfigService({
      video: {
        enabled: true,
        serverUrl: 'wss://synthetic.livekit.test',
        apiKey,
        apiSecret,
      },
    }) as ConfigService<AppConfig>
  );
  jest
    .spyOn(RoomServiceClient.prototype, 'createRoom')
    .mockResolvedValue({ sid: 'RM_test' } as never);
  jest
    .spyOn(RoomServiceClient.prototype, 'removeParticipant')
    .mockResolvedValue(undefined);
  jest
    .spyOn(RoomServiceClient.prototype, 'deleteRoom')
    .mockResolvedValue(undefined);
});
afterEach(() => jest.restoreAllMocks());

test('issues a short-lived private token permitting media and screen sharing with an opaque identity', async () => {
  const result = await provider.issue('opaque-room', 'patient', null, null);
  const claims = await new TokenVerifier(apiKey, apiSecret).verify(
    result.token
  );
  expect(result.provider).toBe('livekit');
  expect(claims.sub).toBe(result.identity);
  expect(claims.exp! - claims.nbf!).toBeLessThanOrEqual(60);
  expect(claims.video).toMatchObject({
    room: 'opaque-room',
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: false,
  });
  expect(claims.video?.roomAdmin).toBeUndefined();
  expect(claims.metadata).toBe('{"role":"patient"}');
  expect(RoomServiceClient.prototype.createRoom).toHaveBeenCalledWith({
    name: 'opaque-room',
    maxParticipants: 2,
    emptyTimeout: 300,
    departureTimeout: 60,
  });
});
test('rotates participant identity and strictly revokes the previous device before returning a token', async () => {
  const result = await provider.issue(
    'opaque-room',
    'patient',
    'RM_test',
    'old-identity'
  );
  expect(result.created).toBe(false);
  expect(result.identity).not.toBe('old-identity');
  expect(RoomServiceClient.prototype.removeParticipant).toHaveBeenCalledWith(
    'opaque-room',
    'old-identity',
    { revokeTokenTs: expect.any(BigInt) }
  );
});
test('removes a newly created room if provisioning fails', async () => {
  jest
    .spyOn(RoomServiceClient.prototype, 'removeParticipant')
    .mockRejectedValueOnce(new Error('Synthetic failure'));
  await expect(
    provider.issue('opaque-room', 'patient', null, 'old')
  ).rejects.toThrow('Synthetic failure');
  expect(RoomServiceClient.prototype.deleteRoom).toHaveBeenCalledWith(
    'opaque-room'
  );
});
test('treats missing rooms/participants as already removed, while retrying other provider errors', async () => {
  jest
    .spyOn(RoomServiceClient.prototype, 'deleteRoom')
    .mockRejectedValueOnce({ code: 'not_found' });
  await expect(provider.close('gone')).resolves.toBeUndefined();
  jest
    .mocked(RoomServiceClient.prototype.deleteRoom)
    .mockRejectedValueOnce(new Error('Network failure'));
  await expect(provider.close('retry')).rejects.toThrow('Network failure');
});
test('verifies both the LiveKit signature and exact raw-body checksum', async () => {
  const body = Buffer.from(
    JSON.stringify({
      event: 'participant_joined',
      room: { sid: 'RM_test', name: 'opaque-room' },
      participant: { identity: 'opaque-identity' },
    })
  );
  const signature = new AccessToken(apiKey, apiSecret, { ttl: 60 });
  signature.sha256 = createHash('sha256').update(body).digest('base64');
  const authorization = await signature.toJwt();
  await expect(provider.verifyEvent(body, authorization)).resolves.toEqual({
    event: 'participant_joined',
    roomId: 'RM_test',
    roomName: 'opaque-room',
    identity: 'opaque-identity',
  });
  await expect(
    provider.verifyEvent(Buffer.from(body.toString() + ' '), authorization)
  ).rejects.toThrow('Invalid video webhook');
  await expect(provider.verifyEvent(body, 'forged-token')).rejects.toThrow(
    'Invalid video webhook'
  );
});
test('reports missing configuration without attempting a provider request', async () => {
  const unconfigured = new VideoProviderService(
    new ConfigService({
      video: {
        enabled: true,
        serverUrl: '',
        apiKey: '',
        apiSecret: '',
      },
    }) as ConfigService<AppConfig>
  );
  expect(unconfigured.isEnabled()).toBe(false);
  await expect(
    unconfigured.issue('room', 'patient', null, null)
  ).rejects.toThrow('unavailable');
  expect(RoomServiceClient.prototype.createRoom).not.toHaveBeenCalled();
});
