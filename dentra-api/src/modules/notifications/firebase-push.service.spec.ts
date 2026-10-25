import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '@config/configuration';
import { FirebasePushService } from './firebase-push.service';

const mockSend = jest.fn<Promise<string>, [unknown]>().mockResolvedValue('projects/local/messages/test');
jest.mock('firebase-admin/app', () => ({
  applicationDefault: () => ({}),
  getApps: () => [],
  initializeApp: () => ({ name: 'test' }),
  deleteApp: jest.fn(),
}));
jest.mock('firebase-admin/messaging', () => ({ getMessaging: () => ({ send: mockSend }) }));

test('sends a private generic alert with an opaque notification ID and matching expiry/collapse metadata', async () => {
  const config = new ConfigService({ push: { enabled: true, projectId: 'local-fixture' } }) as ConfigService<AppConfig>;
  const service = new FirebasePushService(config);
  await service.send('synthetic-token', 'notification-id', 1800);
  const payload = mockSend.mock.calls[0][0] as unknown as {
    data: object;
    notification: { title: string; body: string };
    android: { ttl: number; notification: object };
    apns: { headers: Record<string, string> };
  };
  expect(payload.data).toEqual({ notificationId: 'notification-id' });
  expect(payload.notification).toEqual({
    title: 'Dentra',
    body: 'You have a new appointment update. Open Dentra to view it.',
  });
  expect(payload.android.ttl).toBe(1800000);
  expect(payload.android.notification).toMatchObject({ channelId: 'dentra_appointments', visibility: 'private' });
  expect(payload.apns.headers['apns-collapse-id']).toBe('notification-id');
  await service.onModuleDestroy();
});
