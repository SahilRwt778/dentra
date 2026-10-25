import { AccessToken } from 'livekit-server-sdk';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomInt, randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { HttpExceptionFilter } from '../../src/common/filters/http-exception.filter';
import { TokensService } from '../../src/modules/identity/auth/tokens.service';
import { VideoService } from '../../src/modules/care/video/video.service';
import { VideoProviderService } from '../../src/modules/care/video/video-provider.service';

describe('Appointment video consultations (e2e)', () => {
  let app: INestApplication,
    pool: Pool,
    tokens: TokensService,
    video: VideoService,
    provider: VideoProviderService;
  type Actor = {
    id: string;
    token: string;
    refreshToken: string;
    sessionId: string;
  };
  type Fixture = { patient: Actor; dentist: Actor; appointmentId: string };
  const auth = (actor: Actor) => ({ Authorization: `Bearer ${actor.token}` });
  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    const server = moduleRef.createNestApplication<NestExpressApplication>({
      rawBody: true,
    });
    server.useBodyParser('json', {
      type: ['application/json', 'application/webhook+json'],
    });
    server.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      })
    );
    server.useGlobalFilters(new HttpExceptionFilter());
    await server.init();
    app = server;
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    tokens = app.get(TokensService);
    video = app.get(VideoService);
    provider = app.get(VideoProviderService);
  });
  beforeEach(() => {
    jest.spyOn(provider, 'isEnabled').mockReturnValue(true);
    jest.spyOn(provider, 'isConfigured').mockReturnValue(true);
    jest.spyOn(provider, 'removeParticipant').mockResolvedValue(undefined);
    jest
      .spyOn(provider, 'issue')
      .mockImplementation(async (room, _role, roomId, previous) => {
        if (previous) await provider.removeParticipant(room, previous);
        return {
          provider: 'livekit',
          created: !roomId,
          roomId: roomId ?? `RM_${randomUUID()}`,
          serverUrl: 'wss://synthetic.livekit.test',
          identity: randomUUID(),
          token: `synthetic-${randomUUID()}`,
        };
      });
    jest.spyOn(provider, 'close').mockResolvedValue(undefined);
  });
  afterAll(async () => {
    await pool.end();
    await app.close();
  });

  async function actor(role: 'patient' | 'dentist'): Promise<Actor> {
    const { rows } = await pool.query(
      'insert into users(role, mobile) values($1,$2) returning id',
      [role, `+91${randomInt(6000000000, 9999999999)}`]
    );
    const id = rows[0].id as string;
    if (role === 'patient')
      await pool.query(
        "insert into patients(user_id, full_name, date_of_birth) values($1,'Synthetic Video Patient','1990-01-01')",
        [id]
      );
    else
      await pool.query(
        `insert into dentists(user_id,full_name,qualification,specialization,council_reg_no,status,offers_video,video_hours_from,video_hours_to)
      values($1,'Synthetic Video Dentist','BDS','General Dentist',$2,'verified',true,'00:00','23:59')`,
        [id, randomUUID()]
      );
    const result = await tokens.issue(id, role, randomUUID());
    return {
      id,
      token: result.accessToken,
      refreshToken: result.refreshToken,
      sessionId: app.get(JwtService).decode(result.accessToken).sid,
    };
  }
  function slot(offsetMinutes = -2) {
    const local = new Date(
      Date.now() + (330 + offsetMinutes) * 60_000
    ).toISOString();
    return { date: local.slice(0, 10), time: local.slice(11, 16) };
  }
  async function fixture(offsetMinutes = -2, paid = true): Promise<Fixture> {
    const patient = await actor('patient'),
      dentist = await actor('dentist'),
      scheduled = slot(offsetMinutes);
    const { rows } = await pool.query(
      `insert into appointments(patient_id,dentist_id,type,scheduled_date,scheduled_time,concern_summary)
      values($1,$2,'video',$3,$4,'Synthetic private concern') returning id`,
      [patient.id, dentist.id, scheduled.date, scheduled.time]
    );
    const appointmentId = rows[0].id as string;
    await pool.query(
      `insert into transactions(appointment_id,idempotency_key,amount_paise,method,status) values($1,$2,40000,'upi',$3)`,
      [appointmentId, randomUUID(), paid ? 'paid' : 'pending']
    );
    return { patient, dentist, appointmentId };
  }
  async function roomId(value: Fixture): Promise<string> {
    return (
      await pool.query(
        'select provider_room_id from video_rooms where appointment_id=$1 and closed_at is null',
        [value.appointmentId]
      )
    ).rows[0].provider_room_id;
  }
  const join = (value: Fixture, actor = value.patient, extra = {}) =>
    request(app.getHttpServer())
      .post(`/appointments/${value.appointmentId}/video/token`)
      .set(auth(actor))
      .send({ platform: 'android', ...extra });
  const status = (value: Fixture, actor = value.patient) =>
    request(app.getHttpServer())
      .get(`/appointments/${value.appointmentId}/video`)
      .set(auth(actor));
  it('requires authentication, the assigned participant, a live session, and server-controlled room parameters', async () => {
    const value = await fixture(),
      foreignPatient = await actor('patient'),
      foreignDentist = await actor('dentist');
    await request(app.getHttpServer())
      .get(`/appointments/${value.appointmentId}/video`)
      .expect(401);
    await join(value, foreignPatient).expect(404);
    await join(value, foreignDentist).expect(404);
    const admin = app
      .get(JwtService)
      .sign({ sub: randomUUID(), role: 'admin' });
    await request(app.getHttpServer())
      .post(`/appointments/${value.appointmentId}/video/token`)
      .set('Authorization', `Bearer ${admin}`)
      .send({ platform: 'web' })
      .expect(403);
    await join(value, value.patient, {
      roomName: 'stolen-room',
      identity: 'dentist',
    }).expect(400);
    const legacy = {
      ...value.patient,
      token: app
        .get(JwtService)
        .sign({ sub: value.patient.id, role: 'patient' }),
    };
    await join(value, legacy).expect(409);
    const response = await status(value).expect(200);
    expect(response.body).toMatchObject({
      canJoin: true,
      reason: 'ready',
      roomName: null,
    });
    expect(response.headers['cache-control']).toBe('no-store');
    expect(JSON.stringify(response.body)).not.toContain('token');
  });

  it('enforces the joining window, paid status, verified active dentist and video appointment type', async () => {
    for (const [offset, paid, reason] of [
      [11, true, 'too_early'],
      [-121, true, 'closed'],
      [-2, false, 'payment_required'],
    ] as const) {
      const value = await fixture(offset, paid);
      expect((await status(value).expect(200)).body.reason).toBe(reason);
      await join(value).expect(409);
    }
    const value = await fixture();
    await pool.query("update dentists set status='disabled' where user_id=$1", [
      value.dentist.id,
    ]);
    expect((await status(value).expect(200)).body.reason).toBe(
      'dentist_unavailable'
    );
    await join(value).expect(409);
    await pool.query("update dentists set status='verified' where user_id=$1", [
      value.dentist.id,
    ]);
    const clinic = await pool.query(
      "insert into dentist_clinics(dentist_id,name) values($1,'Synthetic clinic') returning id",
      [value.dentist.id]
    );
    await pool.query(
      "update appointments set type='clinic',clinic_id=$2 where id=$1",
      [value.appointmentId, clinic.rows[0].id]
    );
    expect((await status(value).expect(200)).body.reason).toBe('not_video');
    await join(value).expect(409);
  });

  it('issues private LiveKit credentials and serializes both roles into one meeting', async () => {
    const value = await fixture();
    const [patient, dentist] = await Promise.all([
      join(value),
      join(value, value.dentist, { platform: 'web' }),
    ]);
    expect(patient.status).toBe(200);
    expect(dentist.status).toBe(200);
    expect(patient.body.roomName).toBe(dentist.body.roomName);
    expect(patient.body.roomName).toBe(dentist.body.roomName);
    expect(patient.body.identity).not.toBe(dentist.body.identity);
    for (const [response, role] of [
      [patient, 'patient'],
      [dentist, 'dentist'],
    ] as const) {
      expect(response.body).toMatchObject({
        provider: 'livekit',
        role,
      });
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.body.serverUrl).toBe('wss://synthetic.livekit.test');
      expect(response.body.token).toEqual(expect.any(String));
      expect(JSON.stringify(response.body)).not.toContain(value.patient.id);
      expect(JSON.stringify(response.body)).not.toContain(
        'Synthetic private concern'
      );
    }
    const rooms = (
      await pool.query('select * from video_rooms where appointment_id=$1', [
        value.appointmentId,
      ])
    ).rows;
    expect(rooms).toHaveLength(1);
    expect(JSON.stringify(rooms)).not.toContain('token');
    const replacement = await join(value).expect(200);
    expect(provider.removeParticipant).toHaveBeenCalledWith(
      patient.body.roomName,
      patient.body.identity
    );
    expect(replacement.body.identity).not.toBe(patient.body.identity);
  });

  it('checks in a patient only after a signed provider join event, and rejects old role credentials', async () => {
    const value = await fixture(),
      joined = await join(value).expect(200);
    const event = {
      event: 'participant_joined',
      roomId: await roomId(value),
      roomName: joined.body.roomName,
      identity: joined.body.identity,
    };
    await request(app.getHttpServer())
      .post('/video/webhook')
      .send(event)
      .expect(401);
    expect(
      (
        await pool.query('select status from appointments where id=$1', [
          value.appointmentId,
        ])
      ).rows[0].status
    ).toBe('booked');
    await video.handleEvent({ ...event, identity: randomUUID() });
    expect(
      (
        await pool.query('select status from appointments where id=$1', [
          value.appointmentId,
        ])
      ).rows[0].status
    ).toBe('booked');
    const body = JSON.stringify({
      event: event.event,
      room: { sid: event.roomId, name: event.roomName },
      participant: { identity: event.identity },
    });
    const signature = new AccessToken(
      process.env.LIVEKIT_API_KEY,
      process.env.LIVEKIT_API_SECRET,
      { ttl: 60 }
    );
    signature.sha256 = createHash('sha256').update(body).digest('base64');
    await request(app.getHttpServer())
      .post('/video/webhook')
      .set('Content-Type', 'application/webhook+json')
      .set('Authorization', await signature.toJwt())
      .send(body)
      .expect(204);
    await video.handleEvent(event);
    expect(
      (
        await pool.query('select status from appointments where id=$1', [
          value.appointmentId,
        ])
      ).rows[0].status
    ).toBe('waiting');
  });

  it('rejects a revoked login and removes its late provider connection', async () => {
    const value = await fixture(),
      joined = await join(value).expect(200);
    await tokens.revoke(value.patient.refreshToken);
    await video.cleanup();
    expect(provider.close).toHaveBeenCalledWith(joined.body.roomName);
    expect((await status(value)).body.reason).toBe('session_ended');
    await join(value).expect(409);
    await video.handleEvent({
      event: 'participant_joined',
      roomId: (
        await pool.query(
          'select provider_room_id from video_rooms where room_name=$1',
          [joined.body.roomName]
        )
      ).rows[0].provider_room_id,
      roomName: joined.body.roomName,
      identity: joined.body.identity,
    });
    expect(provider.close).toHaveBeenCalledWith(joined.body.roomName);
    expect(
      (
        await pool.query('select status from appointments where id=$1', [
          value.appointmentId,
        ])
      ).rows[0].status
    ).toBe('booked');
  });

  it('rotates the private room on reschedule and refuses cancelled/completed appointments', async () => {
    const value = await fixture(),
      first = await join(value).expect(200),
      next = slot(1);
    await pool.query(
      'update appointments set scheduled_date=$2,scheduled_time=$3 where id=$1',
      [value.appointmentId, next.date, next.time]
    );
    const second = await join(value).expect(200);
    expect(second.body.roomName).not.toBe(first.body.roomName);
    await video.cleanup();
    expect(provider.close).toHaveBeenCalledWith(first.body.roomName);
    for (const state of ['cancelled', 'completed']) {
      await pool.query('update appointments set status=$2 where id=$1', [
        value.appointmentId,
        state,
      ]);
      expect((await status(value)).body.canJoin).toBe(false);
      await join(value).expect(409);
    }
    await video.cleanup();
    expect(provider.close).toHaveBeenCalledWith(second.body.roomName);
  });

  it('keeps failed room shutdowns for retry and closes expired rooms', async () => {
    const value = await fixture(),
      joined = await join(value).expect(200);
    await pool.query(
      "update video_rooms set expires_at=now()-interval '1 second' where appointment_id=$1",
      [value.appointmentId]
    );
    jest
      .mocked(provider.close)
      .mockRejectedValueOnce(new Error('Synthetic media outage'));
    await video.cleanup();
    const first = (
      await pool.query(
        'select closed_at,cleaned_at from video_rooms where room_name=$1',
        [joined.body.roomName]
      )
    ).rows[0];
    expect(first.closed_at).not.toBeNull();
    expect(first.cleaned_at).toBeNull();
    await video.cleanup();
    expect(
      (
        await pool.query(
          'select cleaned_at from video_rooms where room_name=$1',
          [joined.body.roomName]
        )
      ).rows[0].cleaned_at
    ).not.toBeNull();
  });

  it('reports disabled provider availability without returning credentials', async () => {
    const value = await fixture();
    jest.mocked(provider.isEnabled).mockReturnValue(false);
    expect((await status(value)).body).toMatchObject({
      available: false,
      canJoin: false,
      reason: 'unavailable',
    });
    await join(value).expect(409);
  });

  it('exchanges durable private chat only between joined appointment participants', async () => {
    const value = await fixture(),
      stranger = await actor('patient');
    const url = `/appointments/${value.appointmentId}/video/chat`;
    await request(app.getHttpServer()).get(url).expect(401);
    await request(app.getHttpServer()).get(url).set(auth(stranger)).expect(404);
    await request(app.getHttpServer())
      .post(url)
      .set(auth(value.patient))
      .send({ requestId: randomUUID(), text: 'Before joining' })
      .expect(409);
    await join(value).expect(200);
    await request(app.getHttpServer())
      .post(`/appointments/${value.appointmentId}/video/token`)
      .set(auth(value.dentist))
      .send({ platform: 'ios' })
      .expect(200);
    const sent = await request(app.getHttpServer())
      .post(url)
      .set(auth(value.patient))
      .send({ requestId: randomUUID(), text: 'My tooth is sensitive.' })
      .expect(201);
    await request(app.getHttpServer())
      .post(url)
      .set(auth(value.dentist))
      .send({ requestId: randomUUID(), text: 'Please show me the photo.' })
      .expect(201);
    const patient = await request(app.getHttpServer())
      .get(url)
      .set(auth(value.patient))
      .expect(200);
    const dentist = await request(app.getHttpServer())
      .get(url)
      .set(auth(value.dentist))
      .expect(200);
    expect(
      patient.body.items.map((item: { own: boolean }) => item.own)
    ).toEqual([true, false]);
    expect(
      dentist.body.items.map((item: { own: boolean }) => item.own)
    ).toEqual([false, true]);
    expect(dentist.body.items[0].id).toBe(sent.body.id);
    expect(dentist.body.items[0].senderRole).toBe('patient');
  });

  it('deduplicates concurrent sends, rejects changed retries and pages without dropping messages', async () => {
    const value = await fixture();
    await join(value).expect(200);
    const url = `/appointments/${value.appointmentId}/video/chat`,
      key = randomUUID();
    const results = await Promise.all(
      [1, 2, 3].map(() =>
        request(app.getHttpServer())
          .post(url)
          .set(auth(value.patient))
          .send({ requestId: key, text: 'One message' })
          .expect(201)
      )
    );
    expect(new Set(results.map((result) => result.body.id)).size).toBe(1);
    await request(app.getHttpServer())
      .post(url)
      .set(auth(value.patient))
      .send({ requestId: key, text: 'Changed' })
      .expect(409);
    for (const text of ['Two', 'Three', 'Four'])
      await request(app.getHttpServer())
        .post(url)
        .set(auth(value.patient))
        .send({ requestId: randomUUID(), text })
        .expect(201);
    const latest = await request(app.getHttpServer())
      .get(url)
      .query({ limit: 2 })
      .set(auth(value.patient))
      .expect(200);
    expect(
      latest.body.items.map((item: { text: string }) => item.text)
    ).toEqual(['Three', 'Four']);
    expect(latest.body.hasMore).toBe(true);
    const earlier = await request(app.getHttpServer())
      .get(url)
      .query({ before: latest.body.items[0].sequence, limit: 2 })
      .set(auth(value.patient))
      .expect(200);
    expect(
      earlier.body.items.map((item: { text: string }) => item.text)
    ).toEqual(['One message', 'Two']);
    const after = await request(app.getHttpServer())
      .get(url)
      .query({ after: earlier.body.items[1].sequence })
      .set(auth(value.patient))
      .expect(200);
    expect(after.body.items.map((item: { text: string }) => item.text)).toEqual(
      ['Three', 'Four']
    );
    await request(app.getHttpServer())
      .get(url)
      .query({ after: '9999999999999999999' })
      .set(auth(value.patient))
      .expect(400);
  });

  it('shares byte-validated photos and PDFs through private downloads, with no cross-appointment access', async () => {
    const value = await fixture();
    await join(value).expect(200);
    await request(app.getHttpServer())
      .post(`/appointments/${value.appointmentId}/video/token`)
      .set(auth(value.dentist))
      .send({ platform: 'web' })
      .expect(200);
    const url = `/appointments/${value.appointmentId}/video/chat`;
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lRYAAAAASUVORK5CYII=',
      'base64'
    );
    const sent = await request(app.getHttpServer())
      .post(url)
      .set(auth(value.patient))
      .field('requestId', randomUUID())
      .field('text', 'Photo')
      .attach('file', png, {
        filename: 'tooth.png',
        contentType: 'application/octet-stream',
      })
      .expect(201);
    expect(sent.body.attachment).toMatchObject({
      mimeType: 'image/png',
      sizeBytes: png.length,
    });
    const content = `${url}/${sent.body.id}/content`;
    const response = await request(app.getHttpServer())
      .get(content)
      .set(auth(value.dentist))
      .expect(200);
    expect(response.headers['content-type']).toContain('image/png');
    expect(response.headers['cache-control']).toContain('no-store');
    expect(Buffer.from(response.body)).toEqual(png);
    const stranger = await actor('dentist');
    await request(app.getHttpServer())
      .get(content)
      .set(auth(stranger))
      .expect(404);
    const other = await fixture();
    await request(app.getHttpServer())
      .get(
        `/appointments/${other.appointmentId}/video/chat/${sent.body.id}/content`
      )
      .set(auth(other.patient))
      .expect(404);
    const pdf = Buffer.from('%PDF-1.4\nSynthetic PDF report\n%%EOF');
    const doctorFile = await request(app.getHttpServer())
      .post(url)
      .set(auth(value.dentist))
      .field('requestId', randomUUID())
      .attach('file', pdf, {
        filename: 'report.pdf',
        contentType: 'application/pdf',
      })
      .expect(201);
    expect(doctorFile.body.senderRole).toBe('dentist');
    await request(app.getHttpServer())
      .get(`${url}/${doctorFile.body.id}/content`)
      .set(auth(value.patient))
      .expect('Content-Type', /application\/pdf/)
      .expect(200);
    await request(app.getHttpServer())
      .post(url)
      .set(auth(value.patient))
      .field('requestId', randomUUID())
      .attach('file', Buffer.from('<html>not an image</html>'), {
        filename: 'photo.jpg',
        contentType: 'image/jpeg',
      })
      .expect(400);
  });

  it('validates sends and closes writing after cancellation while retaining message history', async () => {
    const value = await fixture();
    await join(value).expect(200);
    const url = `/appointments/${value.appointmentId}/video/chat`;
    await request(app.getHttpServer())
      .post(url)
      .set(auth(value.patient))
      .send({ requestId: randomUUID(), text: '   ' })
      .expect(400);
    await request(app.getHttpServer())
      .post(url)
      .set(auth(value.patient))
      .send({ requestId: randomUUID(), text: 'x'.repeat(4001) })
      .expect(400);
    const saved = await request(app.getHttpServer())
      .post(url)
      .set(auth(value.patient))
      .send({ requestId: randomUUID(), text: 'Saved before ending' })
      .expect(201);
    await pool.query("update appointments set status='cancelled' where id=$1", [
      value.appointmentId,
    ]);
    await request(app.getHttpServer())
      .post(url)
      .set(auth(value.patient))
      .send({ requestId: randomUUID(), text: 'After ending' })
      .expect(409);
    const history = await request(app.getHttpServer())
      .get(url)
      .set(auth(value.patient))
      .expect(200);
    expect(history.body.items.map((item: { id: string }) => item.id)).toEqual([
      saved.body.id,
    ]);
  });

  it('screen publication does not create another participant or mark arrival', async () => {
    const value = await fixture();
    const session = await join(value).expect(200);
    await video.handleEvent({
      event: 'track_published',
      roomId: await roomId(value),
      roomName: session.body.roomName,
      identity: session.body.identity,
    });
    expect(provider.removeParticipant).not.toHaveBeenCalled();
    expect(
      (
        await pool.query('select status from appointments where id=$1', [
          value.appointmentId,
        ])
      ).rows[0].status
    ).toBe('booked');
  });

  it('rejects a cached token that recreates an old room without affecting a newer join', async () => {
    const value = await fixture();
    const joined = await join(value).expect(200);
    const event = {
      event: 'participant_joined',
      roomId: 'RM_unmanaged-recreation',
      roomName: joined.body.roomName,
      identity: joined.body.identity,
    };
    await video.handleEvent(event);
    expect(provider.removeParticipant).toHaveBeenCalledWith(
      joined.body.roomName,
      joined.body.identity
    );
    await pool.query("update appointments set status='cancelled' where id=$1", [
      value.appointmentId,
    ]);
    await video.cleanup();
    jest.mocked(provider.close).mockClear();
    await video.handleEvent(event);
    expect(provider.close).toHaveBeenCalledWith(joined.body.roomName);
  });

  it('requires a new device to join before writing, and stops the replaced device from sending', async () => {
    const value = await fixture();
    await join(value).expect(200);
    const next = await tokens.issue(value.patient.id, 'patient', randomUUID());
    const url = `/appointments/${value.appointmentId}/video/chat`;
    await request(app.getHttpServer())
      .post(url)
      .set({ Authorization: `Bearer ${next.accessToken}` })
      .send({ requestId: randomUUID(), text: 'Not joined here' })
      .expect(409);
    await request(app.getHttpServer())
      .post(`/appointments/${value.appointmentId}/video/token`)
      .set({ Authorization: `Bearer ${next.accessToken}` })
      .send({ platform: 'android' })
      .expect(200);
    await request(app.getHttpServer())
      .post(url)
      .set({ Authorization: `Bearer ${next.accessToken}` })
      .send({ requestId: randomUUID(), text: 'Joined on this device' })
      .expect(201);
    await request(app.getHttpServer())
      .post(url)
      .set(auth(value.patient))
      .send({ requestId: randomUUID(), text: 'Older device' })
      .expect(409);
  });
});
