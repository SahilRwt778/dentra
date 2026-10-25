import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { applicationDefault, deleteApp, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import type { AppConfig } from '@config/configuration';

@Injectable()
export class FirebasePushService implements OnModuleDestroy {
  private app?: App;
  constructor(private readonly config: ConfigService<AppConfig>) {}

  isEnabled() {
    return this.config.get('push.enabled', { infer: true }) === true;
  }

  async send(token: string, notificationId: string, ttlSeconds: number) {
    if (!this.isEnabled()) throw new Error('Push delivery is disabled.');
    this.app ??=
      getApps().find((app) => app.name === 'dentra-push') ??
      initializeApp(
        {
          credential: applicationDefault(),
          projectId: this.config.get('push.projectId', { infer: true }),
        },
        'dentra-push',
      );
    return getMessaging(this.app).send({
      token,
      // Keep names, visit dates, diagnoses and medicines off lock screens and provider payloads.
      notification: { title: 'Dentra', body: 'You have a new appointment update. Open Dentra to view it.' },
      data: { notificationId },
      android: {
        priority: 'high',
        ttl: ttlSeconds * 1000,
        collapseKey: 'dentra-updates',
        notification: {
          channelId: 'dentra_appointments',
          tag: notificationId,
          icon: 'ic_stat_dentra',
          visibility: 'private',
        },
      },
      apns: {
        headers: {
          'apns-push-type': 'alert',
          'apns-priority': '10',
          'apns-expiration': String(Math.floor(Date.now() / 1000) + ttlSeconds),
          'apns-collapse-id': notificationId,
        },
        payload: { aps: { sound: 'default', threadId: 'dentra-updates' } },
      },
    });
  }

  async onModuleDestroy() {
    if (this.app) await deleteApp(this.app);
  }
}
