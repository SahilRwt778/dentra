import { ConflictException, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { randomInt, randomUUID } from 'node:crypto';
import * as request from 'supertest';
import { Pool } from 'pg';
import { AppModule } from '../../src/app.module';
import { HttpExceptionFilter } from '../../src/common/filters/http-exception.filter';
import { NotificationsService } from '../../src/modules/notifications/notifications.service';

describe('Dentist booking notifications (e2e)', () => {
  let app: INestApplication;
  let pool: Pool;
  let jwt: JwtService;
  type Actor = { id: string; token: string; clinicId?: string };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    jwt = app.get(JwtService);
  });
  afterAll(async () => {
    await pool.end();
    await app.close();
  });

  async function actor(role: 'dentist' | 'patient', approved = true): Promise<Actor> {
    const mobile = `+91${randomInt(6000000000, 9999999999)}`;
    const { rows } = await pool.query('insert into users (role, mobile) values ($1, $2) returning id', [role, mobile]);
    const id = rows[0].id;
    const token = jwt.sign({ sub: id, role });
    if (role === 'patient') {
      await request(app.getHttpServer())
        .post('/patients/register')
        .set('Authorization', `Bearer ${token}`)
        .send({
          fullName: 'Notification Test Patient',
          dateOfBirth: '1990-01-01',
          termsConsent: true,
          telemedicineConsent: true,
        })
        .expect(201);
      return { id, token };
    }
    await request(app.getHttpServer())
      .post('/dentists/applications')
      .set('Authorization', `Bearer ${token}`)
      .send({
        fullName: 'Notification Test Dentist',
        qualification: 'BDS',
        specialization: 'General Dentist',
        councilRegNo: randomUUID(),
        primaryClinicName: 'Notification Test Clinic',
        feeClinicPaise: 50000,
        offersVideo: false,
        termsConsent: true,
        telemedicineConsent: true,
      })
      .expect(201);
    if (approved) await pool.query("update dentists set status = 'verified' where user_id = $1", [id]);
    const clinic = await pool.query('select id from dentist_clinics where dentist_id = $1', [id]);
    return { id, token, clinicId: clinic.rows[0].id };
  }

  function booking(dentist: Actor, time = '10:00') {
    return {
      dentistId: dentist.id,
      clinicId: dentist.clinicId,
      type: 'clinic',
      date: '2027-06-15',
      time,
      concern: 'Private concern must not appear in notification payload',
      paymentMethod: 'pay_at_clinic',
      idempotencyKey: randomUUID(),
    };
  }
  const auth = (actor: Actor) => ({ Authorization: `Bearer ${actor.token}` });

  it('creates exactly one durable notification for the assigned dentist, including after booking retries', async () => {
    const dentist = await actor('dentist'),
      otherDentist = await actor('dentist'),
      patient = await actor('patient');
    const payload = booking(dentist);
    const first = await request(app.getHttpServer()).post('/appointments').set(auth(patient)).send(payload).expect(201);
    const replay = await request(app.getHttpServer())
      .post('/appointments')
      .set(auth(patient))
      .send(payload)
      .expect(201);
    expect(replay.body.id).toBe(first.body.id);
    const inbox = await request(app.getHttpServer()).get('/notifications').set(auth(dentist)).expect(200);
    expect(inbox.body.unreadCount).toBe(1);
    expect(inbox.body.items).toHaveLength(1);
    expect(inbox.body.items[0]).toMatchObject({
      type: 'appointment_booked',
      appointmentId: first.body.id,
      patientName: 'Notification Test Patient',
      date: payload.date,
      time: payload.time,
      appointmentType: 'clinic',
      readAt: null,
    });
    expect(JSON.stringify(inbox.body)).not.toContain(payload.concern);
    const unrelated = await request(app.getHttpServer()).get('/notifications').set(auth(otherDentist)).expect(200);
    expect(unrelated.body).toEqual({ items: [], nextCursor: null, unreadCount: 0 });
    const otherPatient = await actor('patient');
    await request(app.getHttpServer()).post('/appointments').set(auth(otherPatient)).send(payload).expect(409);
    const count = await pool.query('select count(*)::int as count from notifications where user_id = $1', [dentist.id]);
    expect(count.rows[0].count).toBe(1);
  });

  it('rolls back the appointment and notification together when booking cannot commit', async () => {
    const dentist = await actor('dentist'),
      patient = await actor('patient');
    const service = app.get(NotificationsService);
    const insert = service.appointmentBooked.bind(service);
    const failure = jest.spyOn(service, 'appointmentBooked').mockImplementationOnce(async (client, appointment) => {
      await insert(client, appointment);
      throw new ConflictException('Simulated booking failure');
    });
    const payload = booking(dentist);
    await request(app.getHttpServer()).post('/appointments').set(auth(patient)).send(payload).expect(409);
    failure.mockRestore();
    const inbox = await request(app.getHttpServer()).get('/notifications').set(auth(dentist)).expect(200);
    expect(inbox.body.unreadCount).toBe(0);
    const appointments = await pool.query('select id from appointments where dentist_id = $1', [dentist.id]);
    expect(appointments.rows).toHaveLength(0);
    await request(app.getHttpServer()).post('/appointments').set(auth(patient)).send(payload).expect(201);
  });

  it('does not notify on a slot conflict and never duplicates a notification for concurrent booking attempts', async () => {
    const dentist = await actor('dentist'),
      patient = await actor('patient');
    const payload = booking(dentist);
    const results = await Promise.all(
      [1, 2].map(() => request(app.getHttpServer()).post('/appointments').set(auth(patient)).send(payload)),
    );
    expect(results.some((result) => result.status === 201)).toBe(true);
    expect(results.every((result) => result.status === 201 || result.status === 409)).toBe(true);
    expect(new Set(results.filter((result) => result.status === 201).map((result) => result.body.id)).size).toBe(1);
    await request(app.getHttpServer())
      .post('/appointments')
      .set(auth(patient))
      .send({ ...payload, idempotencyKey: randomUUID() })
      .expect(409);
    const inbox = await request(app.getHttpServer()).get('/notifications').set(auth(dentist)).expect(200);
    expect(inbox.body.items).toHaveLength(1);
  });

  it('scopes reading, marking and cursors to the approved dentist and preserves read timestamps', async () => {
    const dentist = await actor('dentist'),
      other = await actor('dentist'),
      patient = await actor('patient'),
      pending = await actor('dentist', false);
    await request(app.getHttpServer()).post('/appointments').set(auth(patient)).send(booking(dentist)).expect(201);
    const inbox = await request(app.getHttpServer()).get('/notifications').set(auth(dentist)).expect(200);
    const id = inbox.body.items[0].id;
    await request(app.getHttpServer()).get('/notifications').expect(401);
    await request(app.getHttpServer()).get('/notifications').set(auth(patient)).expect(200);
    await request(app.getHttpServer()).get('/notifications').set(auth(pending)).expect(403);
    await request(app.getHttpServer()).patch(`/notifications/${id}/read`).set(auth(other)).expect(404);
    await request(app.getHttpServer())
      .post('/notifications/read-all')
      .set(auth(other))
      .send({ through: id })
      .expect(404);
    await request(app.getHttpServer()).get(`/notifications?cursor=${id}`).set(auth(other)).expect(404);
    await request(app.getHttpServer()).get('/notifications?cursor=invalid').set(auth(dentist)).expect(400);
    const read = await request(app.getHttpServer()).patch(`/notifications/${id}/read`).set(auth(dentist)).expect(200);
    expect(read.body.readAt).toBeTruthy();
    const repeated = await request(app.getHttpServer())
      .patch(`/notifications/${id}/read`)
      .set(auth(dentist))
      .expect(200);
    expect(repeated.body.readAt).toBe(read.body.readAt);
    const updated = await request(app.getHttpServer()).get('/notifications').set(auth(dentist)).expect(200);
    expect(updated.body.unreadCount).toBe(0);
    expect(updated.body.items).toHaveLength(1);
  });

  it('paginates without skipping older bookings and leaves newer arrivals unread when marking the snapshot read', async () => {
    const dentist = await actor('dentist'),
      patient = await actor('patient');
    await pool.query(
      `insert into notifications (user_id, channel, template_key, payload, created_at)
      select $1, 'in_app', 'appointment_booked', jsonb_build_object('appointmentId', gen_random_uuid(),
        'patientName', 'Pagination Test', 'date', '2027-06-15', 'time', '10:00', 'appointmentType', 'clinic'),
        now() - make_interval(secs => n) from generate_series(1, 25) n`,
      [dentist.id],
    );
    const first = await request(app.getHttpServer()).get('/notifications').set(auth(dentist)).expect(200);
    expect(first.body.items).toHaveLength(20);
    expect(first.body.unreadCount).toBe(25);
    await request(app.getHttpServer()).post('/appointments').set(auth(patient)).send(booking(dentist)).expect(201);
    const older = await request(app.getHttpServer())
      .get(`/notifications?cursor=${first.body.nextCursor}`)
      .set(auth(dentist))
      .expect(200);
    expect(older.body.items).toHaveLength(5);
    expect(older.body.nextCursor).toBeNull();
    expect(new Set([...first.body.items, ...older.body.items].map((item) => item.id)).size).toBe(25);
    const marked = await request(app.getHttpServer())
      .post('/notifications/read-all')
      .set(auth(dentist))
      .send({ through: first.body.items[0].id })
      .expect(200);
    expect(marked.body.markedRead).toBe(25);
    const latest = await request(app.getHttpServer()).get('/notifications').set(auth(dentist)).expect(200);
    expect(latest.body.unreadCount).toBe(1);
    expect(latest.body.items[0].readAt).toBeNull();
  });
});
