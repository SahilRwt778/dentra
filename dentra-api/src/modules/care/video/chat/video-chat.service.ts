import {
  BadRequestException,
  ConflictException,
  HttpException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { PG_POOL } from '@database/database.module';
import type { AuthenticatedUser } from '@common/decorators/current-user.decorator';
import { PatientFilesStorage } from '../../files/patient-files.storage';
import { detectPatientFileType } from '../../files/validate-patient-file';
import { VideoService } from '../video.service';
import type { ChatPageDto, SendChatDto } from './video-chat.dto';

type MessageRow = {
  id: string;
  sequence: string;
  sender_id: string;
  sender_role: 'patient' | 'dentist';
  request_id: string;
  body: string;
  content_hash: string;
  file_name: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: Date;
};

@Injectable()
export class VideoChatService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly video: VideoService,
    private readonly storage: PatientFilesStorage
  ) {}

  private async owner(
    user: AuthenticatedUser,
    id: string,
    db: Pool | PoolClient = this.pool
  ) {
    const result = await db.query(
      `select a.id from appointments a
      join users p on p.id=a.patient_id and p.status='active'
      join users d on d.id=a.dentist_id and d.status='active'
      join dentists dt on dt.user_id=d.id and dt.status='verified'
      where a.id=$1 and a.type='video' and a.${
        user.role === 'dentist' ? 'dentist_id' : 'patient_id'
      }=$2`,
      [id, user.userId]
    );
    if (!result.rowCount)
      throw new NotFoundException('No such video consultation.');
  }

  async list(user: AuthenticatedUser, id: string, page: ChatPageDto) {
    if (
      [page.after, page.before].some(
        (cursor) => cursor && BigInt(cursor) > 9223372036854775807n
      )
    )
      throw new BadRequestException('Invalid message cursor.');
    if (page.after && page.before)
      throw new BadRequestException('Choose one message cursor.');
    await this.owner(user, id);
    const { rows } = await this.pool.query<MessageRow>(
      `select * from video_chat_messages
      where appointment_id=$1 ${
        page.after
          ? 'and sequence>$3::bigint'
          : page.before
          ? 'and sequence<$3::bigint'
          : ''
      }
      order by sequence ${page.after ? 'asc' : 'desc'} limit $2`,
      page.after || page.before
        ? [id, page.limit + 1, page.after ?? page.before]
        : [id, page.limit + 1]
    );
    const selected = rows.slice(0, page.limit);
    if (!page.after) selected.reverse();
    return {
      items: selected.map((row) => this.message(row, user.userId)),
      hasMore: rows.length > page.limit,
    };
  }

  async send(
    user: AuthenticatedUser,
    id: string,
    dto: SendChatDto,
    file?: Express.Multer.File
  ) {
    const text = (dto.text ?? '').trim();
    if (!text && !file)
      throw new BadRequestException(
        'Write a message or choose a photo or PDF.'
      );
    const mime = file ? detectPatientFileType(file.buffer) : null;
    let name = file
      ? file.originalname
          .replace(/[\\/\p{Cc}]/gu, '_')
          .trim()
          .slice(0, 160) || 'Attachment'
      : null;
    if (name && mime) {
      const extension =
        mime === 'application/pdf'
          ? 'pdf'
          : mime === 'image/png'
          ? 'png'
          : 'jpg';
      if (!name.toLowerCase().endsWith(`.${extension}`))
        name = `${name.slice(0, 155)}.${extension}`;
    }
    const hash = createHash('sha256')
      .update(text)
      .update('\0')
      .update(file?.buffer ?? Buffer.alloc(0))
      .update(name ?? '')
      .digest('hex');
    const client = await this.pool.connect();
    const messageId = randomUUID();
    let stored = false;
    try {
      await client.query('BEGIN');
      // The appointment lock serializes sends with cancellation/completion and duplicate retries.
      await this.video.assertCanJoin(user, id, client, true);
      const previous = await client.query<MessageRow>(
        'select * from video_chat_messages where appointment_id=$1 and sender_id=$2 and request_id=$3',
        [id, user.userId, dto.requestId]
      );
      if (previous.rows[0]) {
        if (previous.rows[0].content_hash !== hash)
          throw new ConflictException(
            'This message retry has different content.'
          );
        await client.query('COMMIT');
        return this.message(previous.rows[0], user.userId);
      }
      const active = await client.query(
        `select id from video_rooms where appointment_id=$1 and provider='livekit'
        and closed_at is null and expires_at>now() and provider_room_id is not null
        and ${
          user.role === 'dentist' ? 'dentist_session_id' : 'patient_session_id'
        }=$2`,
        [id, user.sessionId]
      );
      if (!active.rowCount)
        throw new ConflictException(
          'Join the video consultation before sending messages.'
        );
      const {
        rows: [quota],
      } = await client.query(
        `select count(*) filter(where sender_id=$2 and created_at>now()-interval '1 minute')::int as recent,
        count(*)::int as total, coalesce(sum(size_bytes),0)::bigint as bytes from video_chat_messages where appointment_id=$1`,
        [id, user.userId]
      );
      if (quota.recent >= 30)
        throw new HttpException(
          'Please wait a moment before sending another message.',
          429
        );
      if (
        quota.total >= 2000 ||
        Number(quota.bytes) + (file?.buffer.length ?? 0) > 100 * 1024 * 1024
      )
        throw new ConflictException(
          'This consultation has reached its chat storage limit.'
        );
      if (file) {
        await this.storage.save(messageId, file.buffer);
        stored = true;
      }
      const { rows } = await client.query<MessageRow>(
        `insert into video_chat_messages
        (id,appointment_id,sender_id,sender_role,request_id,body,content_hash,file_name,mime_type,size_bytes)
        values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning *`,
        [
          messageId,
          id,
          user.userId,
          user.role,
          dto.requestId,
          text,
          hash,
          name,
          mime,
          file?.buffer.length ?? null,
        ]
      );
      await client.query('COMMIT');
      return this.message(rows[0], user.userId);
    } catch (error) {
      await client.query('ROLLBACK');
      if (stored) await this.storage.remove(messageId).catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async content(user: AuthenticatedUser, id: string, messageId: string) {
    await this.owner(user, id);
    const { rows } = await this.pool.query<MessageRow>(
      'select * from video_chat_messages where appointment_id=$1 and id=$2 and file_name is not null',
      [id, messageId]
    );
    if (!rows[0]) throw new NotFoundException('No such chat attachment.');
    try {
      return { file: rows[0], bytes: await this.storage.read(messageId) };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT')
        throw new NotFoundException('This attachment is unavailable.');
      throw error;
    }
  }
  private message(row: MessageRow, viewer: string) {
    return {
      id: row.id,
      sequence: row.sequence,
      requestId: row.request_id,
      text: row.body,
      senderRole: row.sender_role,
      own: row.sender_id === viewer,
      createdAt: row.created_at,
      attachment: row.file_name
        ? {
            id: row.id,
            name: row.file_name,
            mimeType: row.mime_type,
            sizeBytes: row.size_bytes,
          }
        : null,
    };
  }
}
