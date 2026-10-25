import { randomUUID } from 'node:crypto';
import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AccessToken,
  RoomServiceClient,
  WebhookReceiver,
} from 'livekit-server-sdk';
import type { AppConfig } from '@config/configuration';

export type VideoEvent = {
  event: string;
  roomId?: string;
  roomName?: string;
  identity?: string;
};

@Injectable()
export class VideoProviderService {
  private rooms?: RoomServiceClient;
  constructor(private readonly config: ConfigService<AppConfig>) {}

  private settings() {
    return this.config.get('video', { infer: true })!;
  }
  isConfigured() {
    const { serverUrl, apiKey, apiSecret } = this.settings();
    return Boolean(serverUrl && apiKey && apiSecret);
  }
  isEnabled() {
    return this.settings().enabled && this.isConfigured();
  }
  private client() {
    if (!this.isConfigured())
      throw new ServiceUnavailableException(
        'Video consultations are unavailable.'
      );
    const { serverUrl, apiKey, apiSecret } = this.settings();
    const url = serverUrl.replace(/^ws:/, 'http:').replace(/^wss:/, 'https:');
    return (this.rooms ??= new RoomServiceClient(url, apiKey, apiSecret, {
      requestTimeout: 8,
    }));
  }

  async issue(
    roomName: string,
    role: 'patient' | 'dentist',
    previousRoomId: string | null,
    previousIdentity: string | null
  ) {
    const client = this.client();
    const room = await client.createRoom({
      name: roomName,
      maxParticipants: 2,
      emptyTimeout: 300,
      departureTimeout: 60,
    });
    const created = room.sid !== previousRoomId;
    try {
      if (previousIdentity)
        await this.removeParticipant(roomName, previousIdentity);
      // Identities rotate on every join. No patient names, IDs or clinical data leave the API.
      const identity = randomUUID();
      const { apiKey, apiSecret, serverUrl } = this.settings();
      const token = new AccessToken(apiKey, apiSecret, {
        identity,
        ttl: 60,
        metadata: JSON.stringify({ role }),
      });
      token.addGrant({
        roomJoin: true,
        room: roomName,
        canPublish: true,
        canSubscribe: true,
        canPublishData: false,
        canUpdateOwnMetadata: false,
      });
      return {
        provider: 'livekit' as const,
        serverUrl: this.settings().publicUrl || serverUrl,
        token: await token.toJwt(),
        identity,
        roomId: room.sid,
        created,
      };
    } catch (error) {
      if (created) await this.close(roomName).catch(() => undefined);
      throw error;
    }
  }

  async removeParticipant(roomName: string, identity: string) {
    try {
      await this.client().removeParticipant(roomName, identity, {
        revokeTokenTs: BigInt(Math.floor(Date.now() / 1000) + 1),
      });
    } catch (error) {
      if (!this.isMissing(error)) throw error;
    }
  }
  async close(roomName: string) {
    try {
      await this.client().deleteRoom(roomName);
    } catch (error) {
      if (!this.isMissing(error)) throw error;
    }
  }
  private isMissing(error: unknown) {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'not_found'
    );
  }

  async verifyEvent(body: Buffer, authorization: string): Promise<VideoEvent> {
    if (!this.isConfigured())
      throw new ServiceUnavailableException(
        'Video consultations are unavailable.'
      );
    const { apiKey, apiSecret } = this.settings();
    try {
      const event = await new WebhookReceiver(apiKey, apiSecret).receive(
        body.toString('utf8'),
        authorization
      );
      return {
        event: event.event,
        roomId: event.room?.sid,
        roomName: event.room?.name,
        identity: event.participant?.identity,
      };
    } catch {
      throw new UnauthorizedException('Invalid video webhook.');
    }
  }
}
