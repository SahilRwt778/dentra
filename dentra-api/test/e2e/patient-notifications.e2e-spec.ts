import { ConflictException, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { randomInt, randomUUID } from 'node:crypto';
import * as request from 'supertest';
import { Pool } from 'pg';
import { AppModule } from '../../src/app.module';
import { HttpExceptionFilter } from '../../src/common/filters/http-exception.filter';
import { NotificationsService } from '../../src/modules/notifications/notifications.service';
import { AppointmentRemindersService } from '../../src/modules/notifications/appointment-reminders.service';
import { RazorpayGatewayService } from '../../src/modules/payments/razorpay-gateway.service';

describe('Patient appointment notifications (e2e)', () => {
  let app: INestApplication;
  let pool: Pool;
  let jwt: JwtService;
  type Update = { type: string; appointmentId: string; readAt: string | null; date: string };
  type Actor = { id: string; token: string; clinicId?: string };
  const auth = (actor: Actor) => ({ Authorization: `Bearer ${actor.token}` });

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

  async function actor(role: 'patient' | 'dentist'): Promise<Actor> {
    const { rows } = await pool.query('insert into users (role, mobile) values ($1, $2) returning id', [
      role,
      `+91${randomInt(6000000000, 9999999999)}`,
    ]);
    const value: Actor = { id: rows[0].id, token: jwt.sign({ sub: rows[0].id, role }) };
    if (role === 'patient') {
      await request(app.getHttpServer())
        .post('/patients/register')
        .set(auth(value))
        .send({
          fullName: 'Synthetic Patient',
          dateOfBirth: '1990-01-01',
          termsConsent: true,
          telemedicineConsent: true,
        })
        .expect(201);
    } else {
      const response = await request(app.getHttpServer())
        .post('/dentists/applications')
        .set(auth(value))
        .send({
          fullName: 'Dr Notification Test',
          qualification: 'BDS',
          specialization: 'General Dentist',
          councilRegNo: randomUUID(),
          primaryClinicName: 'Synthetic Clinic',
          feeClinicPaise: 50000,
          termsConsent: true,
          telemedicineConsent: true,
        })
        .expect(201);
      value.clinicId = response.body.clinics[0].id;
      await pool.query(`update dentists set status = 'verified' where user_id = $1`, [value.id]);
    }
    return value;
  }
  function payload(dentist: Actor, time = '10:30') {
    return {
      dentistId: dentist.id,
      clinicId: dentist.clinicId,
      type: 'clinic',
      date: '2027-06-15',
      time,
      concern: 'Private clinical concern',
      paymentMethod: 'pay_at_clinic',
      idempotencyKey: randomUUID(),
    };
  }
  async function book(patient: Actor, dentist: Actor, time = '10:30') {
    return (
      await request(app.getHttpServer())
        .post('/appointments')
        .set(auth(patient))
        .send(payload(dentist, time))
        .expect(201)
    ).body;
  }
  const inbox = (actor: Actor) => request(app.getHttpServer()).get('/notifications').set(auth(actor));

  it('saves a private confirmation once per booking and distinguishes outstanding online payment', async () => {
    const patient = await actor('patient'),
      other = await actor('patient'),
      dentist = await actor('dentist');
    const body = payload(dentist);
    const first = await request(app.getHttpServer()).post('/appointments').set(auth(patient)).send(body).expect(201);
    await request(app.getHttpServer()).post('/appointments').set(auth(patient)).send(body).expect(201);
    const response = (await inbox(patient).expect(200)).body;
    expect(response.items).toHaveLength(1);
    expect(response.items[0]).toMatchObject({
      type: 'booking_confirmed',
      appointmentId: first.body.id,
      dentistName: 'Dr Notification Test',
      date: body.date,
      time: body.time,
      paymentRequired: false,
      readAt: null,
    });
    expect(JSON.stringify(response)).not.toMatch(/Private clinical concern|patientName|Synthetic Patient|eventKey/);
    expect((await inbox(other).expect(200)).body.items).toHaveLength(0);
    expect((await inbox(dentist).expect(200)).body.items[0].type).toBe('appointment_booked');
    await request(app.getHttpServer())
      .post('/appointments')
      .set(auth(patient))
      .send({ ...payload(dentist, '11:00'), paymentMethod: 'upi' })
      .expect(201);
    expect((await inbox(patient).expect(200)).body.items[0].paymentRequired).toBe(true);
  });

  it('keeps booking and confirmation atomic when notification creation fails', async () => {
    const patient = await actor('patient'),
      dentist = await actor('dentist');
    const service = app.get(NotificationsService),
      original = service.patientAppointmentEvent.bind(service);
    const failure = jest.spyOn(service, 'patientAppointmentEvent').mockImplementationOnce(async (...args) => {
      await original(...args);
      throw new ConflictException('Synthetic notification failure');
    });
    const body = payload(dentist);
    try {
      await request(app.getHttpServer()).post('/appointments').set(auth(patient)).send(body).expect(409);
    } finally {
      failure.mockRestore();
    }
    expect((await inbox(patient).expect(200)).body.items).toHaveLength(0);
    expect((await inbox(dentist).expect(200)).body.items).toHaveLength(0);
    expect((await pool.query('select id from appointments where patient_id = $1', [patient.id])).rows).toHaveLength(0);
  });

  it('cancels once for concurrent retries, queues one refund, and notifies the patient when the dentist cancels', async () => {
    const patient = await actor('patient'),
      dentist = await actor('dentist'),
      stranger = await actor('patient');
    const appointment = await book(patient, dentist);
    await pool.query(
      `update transactions set status = 'paid', gateway_payment_ref = 'pay_synthetic' where appointment_id = $1`,
      [appointment.id],
    );
    const cancel = (who: Actor) =>
      request(app.getHttpServer()).post(`/appointments/${appointment.id}/cancel`).set(auth(who));
    await cancel(stranger).expect(404);
    const refund = app.get(RazorpayGatewayService).refund as jest.Mock;
    const results = await Promise.all([cancel(dentist), cancel(patient)]);
    expect(results.map((result) => result.status)).toEqual([200, 200]);
    expect(refund).not.toHaveBeenCalled();
    const jobs = await pool.query('select r.id from payment_refunds r join transactions t on t.id = r.transaction_id where t.appointment_id = $1', [appointment.id]);
    expect(jobs.rows).toHaveLength(1);
    const cancellations = (await inbox(patient).expect(200)).body.items.filter(
      (item: Update) => item.type === 'appointment_cancelled',
    );
    expect(cancellations).toHaveLength(1);
    expect(cancellations[0].appointmentId).toBe(appointment.id);
  });

  it('rolls cancellation and reschedule back on notification failure before contacting the refund gateway', async () => {
    const patient = await actor('patient'),
      dentist = await actor('dentist');
    const appointment = await book(patient, dentist);
    await pool.query(
      `update transactions set status = 'paid', gateway_payment_ref = 'pay_rollback' where appointment_id = $1`,
      [appointment.id],
    );
    const service = app.get(NotificationsService),
      original = service.patientAppointmentEvent.bind(service);
    for (const operation of ['cancel', 'reschedule']) {
      const failure = jest.spyOn(service, 'patientAppointmentEvent').mockImplementationOnce(async (...args) => {
        await original(...args);
        throw new ConflictException('Synthetic rollback');
      });
      try {
        await request(app.getHttpServer())
          .post(`/appointments/${appointment.id}/${operation}`)
          .set(auth(patient))
          .send(operation === 'reschedule' ? { date: '2027-06-16', time: '11:00' } : {})
          .expect(409);
      } finally {
        failure.mockRestore();
      }
      const current = await request(app.getHttpServer())
        .get(`/appointments/${appointment.id}`)
        .set(auth(patient))
        .expect(200);
      expect(current.body).toMatchObject({
        status: 'booked',
        date: '2027-06-15',
        time: '10:30',
        payment: { status: 'paid' },
      });
      expect((await inbox(patient).expect(200)).body.items).toHaveLength(1);
    }
    expect(app.get(RazorpayGatewayService).refund).not.toHaveBeenCalled();
  });

  it('uses Indian time, skips past/unpaid/inactive visits, and deduplicates concurrent reminder workers', async () => {
    const patient = await actor('patient'),
      dentist = await actor('dentist');
    await book(patient, dentist, '10:00'); // at the start time: no late reminder
    const due = await book(patient, dentist, '10:30');
    const boundary = await book(patient, dentist, '11:00');
    await book(patient, dentist, '11:30'); // too early
    const pendingDentist = await actor('dentist');
    await request(app.getHttpServer())
      .post('/appointments')
      .set(auth(patient))
      .send({ ...payload(pendingDentist), paymentMethod: 'upi' })
      .expect(201);
    const cancelled = await book(patient, pendingDentist, '11:00');
    await request(app.getHttpServer()).post(`/appointments/${cancelled.id}/cancel`).set(auth(patient)).expect(200);
    const inactive = await actor('dentist');
    await book(patient, inactive);
    await pool.query(`update dentists set status = 'disabled' where user_id = $1`, [inactive.id]);
    const job = app.get(AppointmentRemindersService),
      now = new Date('2027-06-15T04:30:00.000Z'); // 10:00 IST
    const runs = await Promise.all([job.runOnce(now), job.runOnce(now)]);
    expect(runs.reduce((sum, count) => sum + count, 0)).toBeGreaterThanOrEqual(2);
    await job.runOnce(now);
    const reminders = (await inbox(patient).expect(200)).body.items.filter(
      (item: Update) => item.type === 'appointment_reminder',
    );
    expect(reminders.map((item: Update) => item.appointmentId).sort()).toEqual([due.id, boundary.id].sort());
  });

  it('reschedules once, dismisses old reminders, and creates a reminder for the new schedule revision', async () => {
    const patient = await actor('patient'),
      dentist = await actor('dentist');
    const appointment = await book(patient, dentist);
    const job = app.get(AppointmentRemindersService),
      now = new Date('2027-06-15T04:30:00.000Z');
    await job.runOnce(now);
    const moved = { date: '2027-06-16', time: '11:00' };
    const move = () =>
      request(app.getHttpServer()).post(`/appointments/${appointment.id}/reschedule`).set(auth(patient)).send(moved);
    expect((await Promise.all([move(), move()])).map((result) => result.status)).toEqual([200, 200]);
    const response = (await inbox(patient).expect(200)).body;
    expect(response.items.filter((item: Update) => item.type === 'appointment_rescheduled')).toHaveLength(1);
    expect(response.items.find((item: Update) => item.type === 'appointment_rescheduled')).toMatchObject({
      ...moved,
      previousDate: '2027-06-15',
      previousTime: '10:30',
    });
    expect(response.items.find((item: Update) => item.type === 'appointment_reminder').readAt).toBeTruthy();
    await request(app.getHttpServer())
      .post(`/appointments/${appointment.id}/reschedule`)
      .set(auth(patient))
      .send({ ...moved, time: '03:00' })
      .expect(400);
    await job.runOnce(new Date('2027-06-16T04:30:00.000Z'));
    const reminders = (await inbox(patient).expect(200)).body.items.filter(
      (item: Update) => item.type === 'appointment_reminder',
    );
    expect(reminders).toHaveLength(2);
    expect(reminders.find((item: Update) => item.date === moved.date).readAt).toBeNull();
    await request(app.getHttpServer()).post(`/appointments/${appointment.id}/cancel`).set(auth(patient)).expect(200);
    expect(
      (await inbox(patient).expect(200)).body.items
        .filter((item: Update) => item.type === 'appointment_reminder')
        .every((item: Update) => item.readAt),
    ).toBe(true);
  });

  it('preserves patient read state across pages and never lets a recipient use another patient’s cursor', async () => {
    const patient = await actor('patient'),
      other = await actor('patient'),
      dentist = await actor('dentist');
    await pool.query(
      `insert into notifications (user_id, channel, template_key, payload, created_at)
      select $1, 'in_app', 'booking_confirmed', jsonb_build_object('appointmentId', gen_random_uuid(),
        'dentistName', 'Dr Pagination', 'date', '2027-06-15', 'time', '10:30', 'appointmentType', 'clinic',
        'paymentRequired', false, 'eventKey', gen_random_uuid()), now() - make_interval(secs => n)
      from generate_series(1, 25) n`,
      [patient.id],
    );
    const first = (await inbox(patient).expect(200)).body;
    expect(first.items).toHaveLength(20);
    expect(first.unreadCount).toBe(25);
    const id = first.items[0].id;
    await request(app.getHttpServer()).get(`/notifications?cursor=${id}`).set(auth(other)).expect(404);
    await request(app.getHttpServer()).patch(`/notifications/${id}/read`).set(auth(dentist)).expect(404);
    await request(app.getHttpServer())
      .post('/notifications/read-all')
      .set(auth(other))
      .send({ through: id })
      .expect(404);
    await book(patient, dentist);
    const older = await request(app.getHttpServer())
      .get(`/notifications?cursor=${first.nextCursor}`)
      .set(auth(patient))
      .expect(200);
    expect(older.body.items).toHaveLength(5);
    await request(app.getHttpServer())
      .post('/notifications/read-all')
      .set(auth(patient))
      .send({ through: id })
      .expect(200);
    expect((await inbox(patient).expect(200)).body.unreadCount).toBe(1);
    const read = await request(app.getHttpServer()).patch(`/notifications/${id}/read`).set(auth(patient)).expect(200);
    const retry = await request(app.getHttpServer()).patch(`/notifications/${id}/read`).set(auth(patient)).expect(200);
    expect(retry.body.readAt).toBe(read.body.readAt);
  });
});
