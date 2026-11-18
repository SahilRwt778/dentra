import { ProfilePhotosService } from '../../src/modules/identity/profile-photos/profile-photos.service';
import { readFileSync } from 'node:fs';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import { AppModule } from '../../src/app.module';
import { TokensService } from '../../src/modules/identity/auth/tokens.service';
import { HttpExceptionFilter } from '../../src/common/filters/http-exception.filter';
import { VideoProviderService } from '../../src/modules/care/video/video-provider.service';
import { RazorpayGatewayService } from '../../src/modules/payments/razorpay-gateway.service';

const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a6fQAAAAASUVORK5CYII=',
  'base64',
);
describe('72-hour consultation passes and messages', () => {
  let app: INestApplication,
    pool: Pool,
    tokens: TokensService,
    gateway: RazorpayGatewayService;
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    tokens = module.get(TokensService);
    gateway = module.get(RazorpayGatewayService);
  });
  afterAll(async () => {
    await pool.end();
    await app.close();
  });
  async function account(role: 'patient' | 'dentist') {
    const {
      rows: [user],
    } = await pool.query(
      'insert into users(role,mobile) values($1,$2) returning id',
      [role, `+9196${Math.floor(10000000 + Math.random() * 89999999)}`],
    );
    if (role === 'patient')
      await pool.query(
        "insert into patients(user_id,full_name,date_of_birth) values($1,'Case patient','1990-01-01')",
        [user.id],
      );
    else
      await pool.query(
        `insert into dentists(user_id,full_name,qualification,specialization,council_reg_no,status,
      offers_video,fee_video_paise,fee_clinic_paise,video_hours_from,video_hours_to)
      values($1,'Case dentist','BDS','General Dentist','CASE-TEST','verified',true,1000,1000,'00:00','23:59')`,
        [user.id],
      );
    const auth = await tokens.issue(user.id, role, randomUUID());
    return { id: user.id as string, token: auth.accessToken };
  }
  async function fixture(paid = true, type: 'video' | 'clinic' = 'video') {
    const patient = await account('patient'),
      dentist = await account('dentist');
    const {
      rows: [clinic],
    } = await pool.query(
      "insert into dentist_clinics(dentist_id,name,hours_from,hours_to) values($1,'Case clinic','00:00','23:59') returning id",
      [dentist.id],
    );
    const {
      rows: [day],
    } = await pool.query(
      "select ((now() at time zone 'Asia/Kolkata')::date+1)::text as date",
    );
    const created = await request(app.getHttpServer())
      .post('/appointments')
      .set('Authorization', `Bearer ${patient.token}`)
      .send({
        dentistId: dentist.id,
        type,
        clinicId: type === 'clinic' ? clinic.id : undefined,
        date: day.date,
        time: '10:00',
        concern: 'Same toothache',
        paymentMethod: type === 'clinic' ? 'pay_at_clinic' : 'card',
        idempotencyKey: randomUUID(),
      })
      .expect(201);
    if (paid)
      await pool.query(
        "update transactions set status='paid',gateway_payment_ref=$2 where appointment_id=$1",
        [created.body.id, `pay_${randomUUID()}`],
      );
    await pool.query(
      "update appointments set status='in_consult' where id=$1",
      [created.body.id],
    );
    await pool.query(
      "insert into consultations(appointment_id,diagnosis) values($1,'Synthetic diagnosis')",
      [created.body.id],
    );
    const completed = await request(app.getHttpServer())
      .post(`/appointments/${created.body.id}/consultation/complete`)
      .set('Authorization', `Bearer ${dentist.token}`)
      .expect(200);
    return {
      patient,
      dentist,
      appointment: completed.body,
      caseId: completed.body.consultationCase.id as string,
      clinicId: clinic.id as string,
      date: day.date,
    };
  }
  function followUp(
    test: Awaited<ReturnType<typeof fixture>>,
    extra: Record<string, unknown> = {},
  ) {
    return request(app.getHttpServer())
      .post(`/consultation-cases/${test.caseId}/follow-ups`)
      .set('Authorization', `Bearer ${test.patient.token}`)
      .send({
        type: 'video',
        date: test.date,
        time: '11:00',
        idempotencyKey: randomUUID(),
        ...extra,
      });
  }
  function send(
    token: string,
    id: string,
    text = 'Follow-up message',
    key = randomUUID(),
  ) {
    return request(app.getHttpServer())
      .post(`/appointments/${id}/video/chat`)
      .set('Authorization', `Bearer ${token}`)
      .field('requestId', key)
      .field('text', text);
  }
  it('starts a fixed 72-hour window only after a paid consultation is completed', async () => {
    const t = await fixture();
    const pass = t.appointment.consultationCase;
    expect(pass.status).toBe('active');
    expect(
      new Date(pass.expiresAt).getTime() - new Date(pass.activatedAt).getTime(),
    ).toBe(72 * 60 * 60 * 1000);
    const unpaid = await fixture(false);
    expect(unpaid.appointment.consultationCase.status).toBe('pending');
    await followUp(unpaid).expect(409);
    await send(unpaid.patient.token, unpaid.appointment.id).expect(409);
  });
  it('filters open and closed conversations before pagination for patients and dentists', async () => {
    const t = await fixture();
    await pool.query(
      `with visits as (
      insert into appointments(patient_id,dentist_id,type,scheduled_date,scheduled_time,status,concern_summary)
      select $1,$2,'video',current_date-day,'09:00','completed','Expired consultation'
      from generate_series(1,21) as day returning id,patient_id,dentist_id
    ), paid as (
      insert into transactions(appointment_id,idempotency_key,amount_paise,method,status)
      select id,id::text,1000,'card','paid' from visits returning appointment_id
    ) insert into consultation_cases(original_appointment_id,patient_id,dentist_id,activated_at,expires_at)
      select v.id,v.patient_id,v.dentist_id,now()-interval '96 hours',now()-interval '24 hours'
      from visits v join paid p on p.appointment_id=v.id`,
      [t.patient.id, t.dentist.id],
    );
    for (const user of [t.patient, t.dentist]) {
      const inbox = (query: string) =>
        request(app.getHttpServer())
          .get(`/consultation-cases${query}`)
          .set('Authorization', `Bearer ${user.token}`);
      const open = await inbox('?filter=open').expect(200);
      expect(open.body.items.map((item: { id: string }) => item.id)).toEqual([
        t.caseId,
      ]);
      expect(open.body.nextPage).toBeNull();
      const closed = await inbox('?filter=closed').expect(200);
      expect(closed.body.items).toHaveLength(20);
      expect(
        closed.body.items.every(
          (item: { status: string }) => item.status === 'expired',
        ),
      ).toBe(true);
      expect(closed.body.nextPage).toBe(2);
      const more = await inbox('?filter=closed&page=2').expect(200);
      expect(more.body.items).toHaveLength(1);
      expect(more.body.nextPage).toBeNull();
      const firstAll = await inbox('').expect(200),
        secondAll = await inbox('?filter=all&page=2').expect(200);
      expect(firstAll.body.items.length + secondAll.body.items.length).toBe(22);
      await inbox('?filter=invalid').expect(400);
      await inbox('?page=0').expect(400);
    }
    await pool.query(
      "update transactions set status='refunded' where appointment_id=$1",
      [t.appointment.id],
    );
    const revoked = await request(app.getHttpServer())
      .get('/consultation-cases?filter=closed')
      .set('Authorization', `Bearer ${t.patient.token}`)
      .expect(200);
    expect(
      revoked.body.items.find((item: { id: string }) => item.id === t.caseId)
        .status,
    ).toBe('revoked');
  });
  it('uses the same messaging permission for inbox filters and ongoing consultation chat', async () => {
    const t = await fixture();
    await send(
      t.patient.token,
      t.appointment.id,
      'Existing conversation',
    ).expect(201);
    await pool.query(
      'update consultation_cases set activated_at=null,expires_at=null where id=$1',
      [t.caseId],
    );
    await pool.query(
      `update appointments set status='in_consult',
      scheduled_date=(now() at time zone 'Asia/Kolkata')::date,
      scheduled_time=date_trunc('minute',now() at time zone 'Asia/Kolkata')::time where id=$1`,
      [t.appointment.id],
    );
    jest
      .spyOn(app.get(VideoProviderService), 'isEnabled')
      .mockReturnValue(true);
    const inbox = (actor: typeof t.patient, filter: string) =>
      request(app.getHttpServer())
        .get(`/consultation-cases?filter=${filter}`)
        .set('Authorization', `Bearer ${actor.token}`);
    const chat = (actor: typeof t.patient) =>
      request(app.getHttpServer())
        .get(`/appointments/${t.appointment.id}/video/chat`)
        .set('Authorization', `Bearer ${actor.token}`);
    const closed = await inbox(t.patient, 'closed').expect(200);
    expect(closed.body.items).toEqual([
      expect.objectContaining({
        id: t.caseId,
        status: 'pending',
        canMessage: false,
      }),
    ]);
    expect((await chat(t.patient).expect(200)).body.canSend).toBe(false);
    const session = (token: string) =>
      (
        JSON.parse(
          Buffer.from(token.split('.')[1], 'base64url').toString(),
        ) as { sid: string }
      ).sid;
    await pool.query(
      `insert into video_rooms(appointment_id,room_name,provider_room_id,scheduled_date,scheduled_time,expires_at,patient_session_id,dentist_session_id)
      select id,$2,$2,scheduled_date,scheduled_time,now()+interval '2 hours',$3,$4 from appointments where id=$1`,
      [
        t.appointment.id,
        `synthetic-chat-${randomUUID()}`,
        session(t.patient.token),
        session(t.dentist.token),
      ],
    );
    for (const actor of [t.patient, t.dentist]) {
      const open = await inbox(actor, 'open').expect(200);
      expect(open.body.items).toEqual([
        expect.objectContaining({
          id: t.caseId,
          status: 'pending',
          canMessage: true,
        }),
      ]);
      expect((await chat(actor).expect(200)).body.canSend).toBe(true);
      await send(
        actor.token,
        t.appointment.id,
        'Message during the consultation',
      ).expect(201);
    }
    await pool.query(
      'update video_rooms set closed_at=now() where appointment_id=$1',
      [t.appointment.id],
    );
    expect((await chat(t.patient).expect(200)).body.canSend).toBe(false);
    expect(
      (await inbox(t.patient, 'open').expect(200)).body.items,
    ).toHaveLength(0);
    expect((await inbox(t.patient, 'closed').expect(200)).body.items).toEqual([
      expect.objectContaining({ id: t.caseId, canMessage: false }),
    ]);
    await send(t.patient.token, t.appointment.id, 'Closed call chat').expect(
      409,
    );
  });
  it('books an idempotent free follow-up without a gateway order, transaction, or new validity window', async () => {
    const t = await fixture(),
      key = randomUUID();
    const before = jest.mocked(gateway.createOrder).mock.calls.length;
    const first = await followUp(t, { idempotencyKey: key }).expect(201);
    expect(first.body.payment).toMatchObject({
      amountPaise: 0,
      method: 'follow_up',
      status: 'covered',
      gatewayOrderId: null,
    });
    expect(first.body.followUpOf).toBe(t.appointment.id);
    expect(first.body.concern).toBe('Same toothache');
    const retry = await followUp(t, { idempotencyKey: key }).expect(201);
    expect(retry.body.id).toBe(first.body.id);
    expect(jest.mocked(gateway.createOrder).mock.calls.length).toBe(before);
    const {
      rows: [count],
    } = await pool.query(
      'select count(*)::int as count from transactions where appointment_id=$1',
      [first.body.id],
    );
    expect(count.count).toBe(0);
    await pool.query(
      "update appointments set status='in_consult' where id=$1",
      [first.body.id],
    );
    await pool.query(
      "insert into consultations(appointment_id,diagnosis) values($1,'Follow-up diagnosis')",
      [first.body.id],
    );
    const done = await request(app.getHttpServer())
      .post(`/appointments/${first.body.id}/consultation/complete`)
      .set('Authorization', `Bearer ${t.dentist.token}`)
      .expect(200);
    expect(done.body.consultationCase.expiresAt).toBe(
      t.appointment.consultationCase.expiresAt,
    );
  });
  it('shares text and private files between call routes and the inbox, with server unread counts', async () => {
    const t = await fixture();
    const child = await followUp(t).expect(201);
    const message = await send(t.patient.token, t.appointment.id).expect(201);
    const file = await send(
      t.dentist.token,
      child.body.id,
      'Photo from dentist',
    )
      .attach('file', png, 'photo.png')
      .expect(201);
    const list = await request(app.getHttpServer())
      .get(`/appointments/${t.appointment.id}/video/chat`)
      .set('Authorization', `Bearer ${t.patient.token}`)
      .expect(200);
    expect(list.body.items.map((m: { id: string }) => m.id)).toEqual([
      message.body.id,
      file.body.id,
    ]);
    expect(list.body.canSend).toBe(true);
    await request(app.getHttpServer())
      .get(
        `/appointments/${t.appointment.id}/video/chat/${file.body.id}/content`,
      )
      .set('Authorization', `Bearer ${t.patient.token}`)
      .expect('Content-Type', /image\/png/)
      .expect(200);
    const inbox = await request(app.getHttpServer())
      .get('/consultation-cases')
      .set('Authorization', `Bearer ${t.patient.token}`)
      .expect(200);
    expect(inbox.body.unreadCount).toBe(1);
    await request(app.getHttpServer())
      .post(`/appointments/${t.appointment.id}/video/chat/read`)
      .set('Authorization', `Bearer ${t.patient.token}`)
      .send({ sequence: file.body.sequence })
      .expect(201);
    const read = await request(app.getHttpServer())
      .get('/consultation-cases')
      .set('Authorization', `Bearer ${t.patient.token}`)
      .expect(200);
    expect(read.body.unreadCount).toBe(0);
    const stranger = await account('patient');
    await request(app.getHttpServer())
      .get(`/appointments/${t.appointment.id}/video/chat`)
      .set('Authorization', `Bearer ${stranger.token}`)
      .expect(404);
    await request(app.getHttpServer())
      .get(`/consultation-cases/${t.caseId}`)
      .set('Authorization', `Bearer ${stranger.token}`)
      .expect(404);
  });
  it('enforces slot bounds and expiry while keeping history readable', async () => {
    const t = await fixture();
    await send(t.patient.token, t.appointment.id).expect(201);
    const {
      rows: [late],
    } = await pool.query('select ($1::date+4)::text as date', [t.date]);
    await followUp(t, { date: late.date }).expect(409);
    await pool.query(
      "update consultation_cases set activated_at=now()-interval '73 hours',expires_at=now()-interval '1 hour' where id=$1",
      [t.caseId],
    );
    await followUp(t).expect(409);
    await send(t.patient.token, t.appointment.id, 'Too late').expect(409);
    const history = await request(app.getHttpServer())
      .get(`/appointments/${t.appointment.id}/video/chat`)
      .set('Authorization', `Bearer ${t.patient.token}`)
      .expect(200);
    expect(history.body.items).toHaveLength(1);
    expect(history.body.canSend).toBe(false);
  });
  it('revokes further free bookings and messaging if the original payment is refunded', async () => {
    const t = await fixture();
    await pool.query(
      "update transactions set status='refunded' where appointment_id=$1",
      [t.appointment.id],
    );
    await followUp(t).expect(409);
    await send(t.patient.token, t.appointment.id).expect(409);
    const detail = await request(app.getHttpServer())
      .get(`/consultation-cases/${t.caseId}`)
      .set('Authorization', `Bearer ${t.patient.token}`)
      .expect(200);
    expect(detail.body.status).toBe('revoked');
  });
  it('serializes simultaneous retries, including when the original reply is lost', async () => {
    const t = await fixture(),
      key = randomUUID();
    const [a, b] = await Promise.all([
      followUp(t, { idempotencyKey: key }),
      followUp(t, { idempotencyKey: key }),
    ]);
    expect([a.status, b.status]).toEqual([201, 201]);
    expect(a.body.id).toBe(b.body.id);
    const {
      rows: [count],
    } = await pool.query(
      'select count(*)::int as count from appointments where follow_up_of=$1',
      [t.appointment.id],
    );
    expect(count.count).toBe(1);
  });
  it('activates a completed clinic visit only when its fee is actually collected, and supports either follow-up mode', async () => {
    const t = await fixture(false, 'clinic');
    expect(t.appointment.consultationCase.status).toBe('pending');
    const paid = await request(app.getHttpServer())
      .post(`/appointments/${t.appointment.id}/clinic-payment`)
      .set('Authorization', `Bearer ${t.dentist.token}`)
      .send({ requestId: randomUUID(), amountPaise: 1000, method: 'cash' })
      .expect(200);
    expect(paid.body.consultationCase.status).toBe('active');
    expect(paid.body.consultationCase.activatedAt).toBe(
      t.appointment.completedAt,
    );
    const clinic = await followUp(t, {
      type: 'clinic',
      clinicId: t.clinicId,
    }).expect(201);
    await followUp(t, { time: '12:00' }).expect(201);
    expect(clinic.body.payment).toMatchObject({
      status: 'covered',
      amountPaise: 0,
    });
    await request(app.getHttpServer())
      .post(`/appointments/${clinic.body.id}/clinic-payment`)
      .set('Authorization', `Bearer ${t.dentist.token}`)
      .send({ requestId: randomUUID(), amountPaise: 1000, method: 'cash' })
      .expect(404);
    await send(t.patient.token, t.appointment.id).expect(201);
  });
  it('keeps rescheduling inside the original pass and cancellation creates no refund', async () => {
    const t = await fixture(),
      child = await followUp(t).expect(201);
    const {
      rows: [late],
    } = await pool.query('select ($1::date+4)::text as date', [t.date]);
    await request(app.getHttpServer())
      .post(`/appointments/${child.body.id}/reschedule`)
      .set('Authorization', `Bearer ${t.dentist.token}`)
      .send({ date: late.date, time: '12:00' })
      .expect(409);
    const moved = await request(app.getHttpServer())
      .post(`/appointments/${child.body.id}/reschedule`)
      .set('Authorization', `Bearer ${t.patient.token}`)
      .send({ date: t.date, time: '12:00' })
      .expect(200);
    expect(moved.body.consultationCase.expiresAt).toBe(
      t.appointment.consultationCase.expiresAt,
    );
    const refundsBefore = jest.mocked(gateway.refund).mock.calls.length;
    const cancelled = await request(app.getHttpServer())
      .post(`/appointments/${child.body.id}/cancel`)
      .set('Authorization', `Bearer ${t.patient.token}`)
      .expect(200);
    expect(cancelled.body.status).toBe('cancelled');
    expect(jest.mocked(gateway.refund).mock.calls.length).toBe(refundsBefore);
    const {
      rows: [count],
    } = await pool.query(
      'select count(*)::int as count from transactions where appointment_id=$1',
      [child.body.id],
    );
    expect(count.count).toBe(0);
  });
  it('coalesces message notifications per recipient and never pre-reads future messages', async () => {
    const t = await fixture();
    const one = await send(t.patient.token, t.appointment.id, 'One').expect(
      201,
    );
    const two = await send(t.patient.token, t.appointment.id, 'Two').expect(
      201,
    );
    const notices = await request(app.getHttpServer())
      .get('/notifications')
      .set('Authorization', `Bearer ${t.dentist.token}`)
      .expect(200);
    const chatNotices = notices.body.items.filter(
      (n: { type: string }) => n.type === 'consultation_message',
    );
    expect(chatNotices).toHaveLength(1);
    expect(chatNotices[0]).toMatchObject({
      caseId: t.caseId,
      sequence: two.body.sequence,
      senderName: 'Case patient',
    });
    await request(app.getHttpServer())
      .post(`/appointments/${t.appointment.id}/video/chat/read`)
      .set('Authorization', `Bearer ${t.dentist.token}`)
      .send({ sequence: one.body.sequence })
      .expect(201);
    const unread = await request(app.getHttpServer())
      .get('/consultation-cases')
      .set('Authorization', `Bearer ${t.dentist.token}`)
      .expect(200);
    expect(unread.body.unreadCount).toBe(1);
    await request(app.getHttpServer())
      .post(`/appointments/${t.appointment.id}/video/chat/read`)
      .set('Authorization', `Bearer ${t.dentist.token}`)
      .send({ sequence: '9223372036854775807' })
      .expect(201);
    await send(t.patient.token, t.appointment.id, 'Three').expect(201);
    const next = await request(app.getHttpServer())
      .get('/consultation-cases')
      .set('Authorization', `Bearer ${t.dentist.token}`)
      .expect(200);
    expect(next.body.unreadCount).toBe(1);
  });
  it('rejects a revoked session and preserves private attachments and accepted retries after expiry', async () => {
    const t = await fixture(),
      key = randomUUID();
    const accepted = await send(
      t.patient.token,
      t.appointment.id,
      'Accepted',
      key,
    ).expect(201);
    const file = await send(t.dentist.token, t.appointment.id, 'A photo')
      .attach('file', png, 'photo.png')
      .expect(201);
    await pool.query(
      'update refresh_tokens set revoked_at=now() where user_id=$1',
      [t.dentist.id],
    );
    await send(t.dentist.token, t.appointment.id, 'Revoked session').expect(
      409,
    );
    await pool.query(
      "update consultation_cases set activated_at=now()-interval '73 hours',expires_at=now()-interval '1 hour' where id=$1",
      [t.caseId],
    );
    const retry = await send(
      t.patient.token,
      t.appointment.id,
      'Accepted',
      key,
    ).expect(201);
    expect(retry.body.id).toBe(accepted.body.id);
    await request(app.getHttpServer())
      .get(
        `/appointments/${t.appointment.id}/video/chat/${file.body.id}/content`,
      )
      .set('Authorization', `Bearer ${t.patient.token}`)
      .expect(200);
    const stranger = await account('patient');
    await request(app.getHttpServer())
      .get(
        `/appointments/${t.appointment.id}/video/chat/${file.body.id}/content`,
      )
      .set('Authorization', `Bearer ${stranger.token}`)
      .expect(404);
  });
  it('authorizes both sides of a covered video visit and blocks it when the source payment is revoked', async () => {
    const t = await fixture(true, 'clinic'),
      child = await followUp(t).expect(201);
    const provider = app.get(VideoProviderService);
    jest.spyOn(provider, 'isEnabled').mockReturnValue(true);
    jest.spyOn(provider, 'isConfigured').mockReturnValue(true);
    await pool.query(
      "update consultation_cases set activated_at=now()-interval '2 hours',expires_at=now()+interval '70 hours' where id=$1",
      [t.caseId],
    );
    await pool.query(
      "update appointments set scheduled_date=(now() at time zone 'Asia/Kolkata')::date,scheduled_time=date_trunc('minute',now() at time zone 'Asia/Kolkata')::time where id=$1",
      [child.body.id],
    );
    for (const actor of [t.patient, t.dentist]) {
      const status = await request(app.getHttpServer())
        .get(`/appointments/${child.body.id}/video`)
        .set('Authorization', `Bearer ${actor.token}`)
        .expect(200);
      expect(status.body).toMatchObject({ canJoin: true, reason: 'ready' });
    }
    await request(app.getHttpServer())
      .post(`/appointments/${child.body.id}/start`)
      .set('Authorization', `Bearer ${t.dentist.token}`)
      .expect(200);
    await pool.query(
      "update transactions set status='refunded' where appointment_id=$1",
      [t.appointment.id],
    );
    const revoked = await request(app.getHttpServer())
      .get(`/appointments/${child.body.id}/video`)
      .set('Authorization', `Bearer ${t.patient.token}`)
      .expect(200);
    expect(revoked.body).toMatchObject({
      canJoin: false,
      reason: 'payment_required',
    });
  });

  it('migrates existing appointments and chat without granting a new validity window', async () => {
    const client = await pool.connect();
    const schema = `case_migration_${randomUUID().replaceAll('-', '')}`;
    try {
      await client.query('BEGIN');
      await client.query(`create schema "${schema}"`);
      await client.query(`set local search_path to "${schema}",public`);
      const fresh = readFileSync('schema.sql', 'utf8');
      await client.query(
        fresh.slice(0, fresh.indexOf('CREATE TABLE consultation_cases')),
      );
      const {
        rows: [old],
      } = await client.query(`with p as (
        insert into users(role,mobile) values('patient','+919600000001') returning id
      ), d as (
        insert into users(role,mobile) values('dentist','+919600000002') returning id
      ), patient as (
        insert into patients(user_id,full_name,date_of_birth) select id,'Existing patient','1990-01-01' from p returning user_id
      ), dentist as (
        insert into dentists(user_id,full_name,qualification,specialization,council_reg_no,status)
        select id,'Existing dentist','BDS','General','MIGRATION','verified' from d returning user_id
      ), appointment as (
        insert into appointments(patient_id,dentist_id,type,scheduled_date,scheduled_time,concern_summary,status,completed_at)
        select patient.user_id,dentist.user_id,'video',current_date,'10:00','Existing concern','completed',now()-interval '10 days'
        from patient,dentist returning id,patient_id,completed_at
      ), payment as (
        insert into transactions(appointment_id,idempotency_key,amount_paise,method,status)
        select id,'existing-key',1000,'card','paid' from appointment
      ), message as (
        insert into video_chat_messages(appointment_id,sender_id,sender_role,request_id,body,content_hash)
        select id,patient_id,'patient',gen_random_uuid(),'Existing message',repeat('a',64) from appointment
      ) select id,completed_at from appointment`);
      const migration = readFileSync(
        'migrations/1794843000000_consultation_cases.sql',
        'utf8',
      ).split('-- Down Migration')[0];
      await client.query(migration);
      const {
        rows: [saved],
      } = await client.query(
        `select c.activated_at,c.expires_at,a.booking_key,
        (select count(*)::int from video_chat_messages where appointment_id=a.id) as messages
        from appointments a join consultation_cases c on c.id=a.consultation_case_id where a.id=$1`,
        [old.id],
      );
      expect(saved.activated_at).toEqual(old.completed_at);
      expect(saved.expires_at.getTime() - saved.activated_at.getTime()).toBe(
        72 * 60 * 60 * 1000,
      );
      expect(saved.expires_at.getTime()).toBeLessThan(Date.now());
      expect(saved).toMatchObject({ booking_key: 'existing-key', messages: 1 });
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
  });
  it('does not let an unused clinic follow-up start after the pass has ended', async () => {
    const t = await fixture(),
      child = await followUp(t, {
        type: 'clinic',
        clinicId: t.clinicId,
      }).expect(201);
    await pool.query(
      "update consultation_cases set activated_at=now()-interval '73 hours',expires_at=now()-interval '1 hour' where id=$1",
      [t.caseId],
    );
    await pool.query(
      "update appointments set scheduled_date=((now() at time zone 'Asia/Kolkata')-interval '2 hours')::date,scheduled_time=((now() at time zone 'Asia/Kolkata')-interval '2 hours')::time where id=$1",
      [child.body.id],
    );
    const history = await request(app.getHttpServer())
      .get(`/appointments/${child.body.id}`)
      .set('Authorization', `Bearer ${t.dentist.token}`)
      .expect(200);
    expect(history.body.payment.status).toBe('covered');
    await request(app.getHttpServer())
      .post(`/appointments/${child.body.id}/start`)
      .set('Authorization', `Bearer ${t.dentist.token}`)
      .expect(409);
  });
  it('returns signed profile photos for both participants without exposing storage references', async () => {
    const t = await fixture();
    const photos = app.get(ProfilePhotosService);
    const patientPhoto = await photos.save('patient', t.patient.id, {
      buffer: png,
    });
    const dentistPhoto = await photos.save('dentist', t.dentist.id, {
      buffer: png,
    });
    await pool.query(
      'update patients set profile_photo_url=$2 where user_id=$1',
      [t.patient.id, patientPhoto],
    );
    await pool.query(
      'update dentists set profile_photo_url=$2 where user_id=$1',
      [t.dentist.id, dentistPhoto],
    );
    for (const actor of [t.patient, t.dentist]) {
      const inbox = await request(app.getHttpServer())
        .get('/consultation-cases')
        .set('Authorization', `Bearer ${actor.token}`)
        .expect(200);
      const item = inbox.body.items.find(
        (entry: { id: string }) => entry.id === t.caseId,
      );
      expect(item.patientProfilePhotoUrl).toContain(
        `/profile-photos/patient/${t.patient.id}?`,
      );
      expect(item.dentistProfilePhotoUrl).toContain(
        `/profile-photos/dentist/${t.dentist.id}?`,
      );
      expect(JSON.stringify(item)).not.toContain(patientPhoto);
      expect(JSON.stringify(item)).not.toContain(dentistPhoto);
      await request(app.getHttpServer())
        .get(
          actor.id === t.dentist.id
            ? item.patientProfilePhotoUrl
            : item.dentistProfilePhotoUrl,
        )
        .expect('Content-Type', /image\/png/)
        .expect(200);
    }
    await pool.query(
      'update patients set profile_photo_url=null where user_id=$1',
      [t.patient.id],
    );
    const removed = await request(app.getHttpServer())
      .get(`/consultation-cases/${t.caseId}`)
      .set('Authorization', `Bearer ${t.dentist.token}`)
      .expect(200);
    expect(removed.body.patientProfilePhotoUrl).toBeNull();
    expect(removed.body.dentistProfilePhotoUrl).toContain(
      '/profile-photos/dentist/',
    );
  });
});
