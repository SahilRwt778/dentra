import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { Pool } from 'pg';
import { randomInt, randomUUID } from 'node:crypto';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { HttpExceptionFilter } from '../../src/common/filters/http-exception.filter';

describe('Weekly availability and time off (e2e)', () => {
  let app: INestApplication, pool: Pool, jwt: JwtService;
  type Actor = { id: string; token: string; clinicId: string };
  const base = '/dentists/me/time-off';
  const period = {
    startDate: '2027-06-14',
    endDate: '2027-06-15',
    allDay: false,
    fromTime: '10:05',
    toTime: '10:20',
  };

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
    jwt = app.get(JwtService);
  });
  afterAll(async () => {
    await pool.end();
    await app.close();
  });

  async function actor(
    role: 'dentist' | 'patient',
    status = 'verified',
  ): Promise<Actor> {
    const id = randomUUID();
    await pool.query('insert into users (id, role, mobile) values ($1,$2,$3)', [
      id,
      role,
      `+91${randomInt(6000000000, 9999999999)}`,
    ]);
    let clinicId = '';
    if (role === 'dentist') {
      await pool.query(
        `insert into dentists (user_id, full_name, qualification, specialization, council_reg_no,
        status, offers_video, video_hours_from, video_hours_to) values ($1,'Availability Test Dentist','BDS','General','TEST',$2,true,'10:00','12:00')`,
        [id, status],
      );
      const result = await pool.query(
        "insert into dentist_clinics (dentist_id, name, hours_from, hours_to) values ($1,'Availability Test Clinic','10:00','12:00') returning id",
        [id],
      );
      clinicId = result.rows[0].id;
    } else {
      await pool.query(
        "insert into patients (user_id, full_name, date_of_birth) values ($1,'Availability Test Patient','1990-01-01')",
        [id],
      );
    }
    return { id, clinicId, token: jwt.sign({ sub: id, role }) };
  }
  const get = (user: Actor, path: string) =>
    request(app.getHttpServer())
      .get(path)
      .set('Authorization', `Bearer ${user.token}`);
  const post = (user: Actor, path: string, body: object) =>
    request(app.getHttpServer())
      .post(path)
      .set('Authorization', `Bearer ${user.token}`)
      .send(body);
  const patch = (user: Actor, path: string, body: object) =>
    request(app.getHttpServer())
      .patch(path)
      .set('Authorization', `Bearer ${user.token}`)
      .send(body);
  const remove = (user: Actor, id: string) =>
    request(app.getHttpServer())
      .delete(`${base}/${id}`)
      .set('Authorization', `Bearer ${user.token}`);
  const slots = (dentist: Actor, type = 'clinic', date = '2027-06-14') =>
    request(app.getHttpServer())
      .get(`/dentists/${dentist.id}/slots`)
      .query({
        type,
        date,
        ...(type === 'clinic' ? { clinicId: dentist.clinicId } : {}),
      });
  const booking = (dentist: Actor, date: string, time = '10:00') => ({
    dentistId: dentist.id,
    clinicId: dentist.clinicId,
    type: 'clinic',
    date,
    time,
    concern: 'Availability test',
    paymentMethod: 'pay_at_clinic',
    idempotencyKey: randomUUID(),
  });

  it('keeps every day by default, separates clinic/video weekdays, and preserves omitted days on edits', async () => {
    const dentist = await actor('dentist');
    const me = await get(dentist, '/dentists/me').expect(200);
    expect(me.body.videoWorkingDays).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(me.body.clinics[0].workingDays).toEqual([0, 1, 2, 3, 4, 5, 6]);
    await patch(dentist, '/dentists/me', { videoWorkingDays: [2] }).expect(200);
    const clinic = {
      name: 'Weekly clinic',
      hoursFrom: '10:00',
      hoursTo: '12:00',
    };
    await patch(dentist, `/dentists/me/clinics/${dentist.clinicId}`, {
      ...clinic,
      workingDays: [1],
    }).expect(200);
    expect((await slots(dentist).expect(200)).body.slots).toContain('10:00'); // Monday
    expect(
      (await slots(dentist, 'clinic', '2027-06-15').expect(200)).body.slots,
    ).toEqual([]);
    expect((await slots(dentist, 'video').expect(200)).body.slots).toEqual([]);
    expect(
      (await slots(dentist, 'video', '2027-06-15').expect(200)).body.slots,
    ).toContain('10:00');
    expect(
      (
        await patch(
          dentist,
          `/dentists/me/clinics/${dentist.clinicId}`,
          clinic,
        ).expect(200)
      ).body.workingDays,
    ).toEqual([1]);
    expect(
      (await patch(dentist, '/dentists/me', { feeVideoPaise: 100 }).expect(200))
        .body.videoWorkingDays,
    ).toEqual([2]);
    await patch(dentist, '/dentists/me', { videoWorkingDays: [] }).expect(200);
    expect(
      (await slots(dentist, 'video', '2027-06-15').expect(200)).body.slots,
    ).toEqual([]);
  });

  it('rejects closed weekdays during booking and rescheduling without changing an existing booking', async () => {
    const dentist = await actor('dentist'),
      patient = await actor('patient');
    await patch(dentist, `/dentists/me/clinics/${dentist.clinicId}`, {
      name: 'Monday clinic',
      hoursFrom: '10:00',
      hoursTo: '12:00',
      workingDays: [1],
    }).expect(200);
    const booked = await post(
      patient,
      '/appointments',
      booking(dentist, '2027-06-14'),
    ).expect(201);
    await post(patient, '/appointments', booking(dentist, '2027-06-15')).expect(
      400,
    );
    await post(patient, `/appointments/${booked.body.id}/reschedule`, {
      date: '2027-06-15',
      time: '10:00',
    }).expect(400);
    expect(
      (await get(dentist, `/appointments/${booked.body.id}`).expect(200)).body
        .date,
    ).toBe('2027-06-14');
    // Updating weekdays doesn't silently move or cancel already booked appointments.
    await patch(dentist, `/dentists/me/clinics/${dentist.clinicId}`, {
      name: 'Closed clinic',
      hoursFrom: '10:00',
      hoursTo: '12:00',
      workingDays: [],
    }).expect(200);
    expect(
      (await get(patient, `/appointments/${booked.body.id}`).expect(200)).body
        .status,
    ).toBe('booked');
  });

  it('blocks overlapping slots across clinics and video, supports full days, retries, and removal', async () => {
    const dentist = await actor('dentist'),
      patient = await actor('patient');
    const input = {
      ...period,
      requestId: randomUUID(),
      reason: 'Private test leave',
    };
    expect(
      (await post(dentist, `${base}/preview`, period).expect(200)).body,
    ).toEqual({ total: 0, appointments: [] });
    const created = await post(dentist, base, input).expect(201);
    expect(created.body).toMatchObject({
      ...period,
      id: input.requestId,
      reason: input.reason,
    });
    await post(dentist, base, input).expect(201);
    expect((await get(dentist, base).expect(200)).body).toHaveLength(1);
    for (const type of ['clinic', 'video']) {
      const available = (await slots(dentist, type).expect(200)).body.slots;
      expect(available).not.toContain('10:00'); // begins before leave, but overlaps
      expect(available).not.toContain('10:10');
      expect(available).toContain('10:20'); // exact end is available
      expect(
        (await slots(dentist, type, '2027-06-15').expect(200)).body.slots,
      ).not.toContain('10:10');
      expect(
        (await slots(dentist, type, '2027-06-16').expect(200)).body.slots,
      ).toContain('10:00');
    }
    await post(
      patient,
      '/appointments',
      booking(dentist, period.startDate),
    ).expect(400);
    const later = await post(
      patient,
      '/appointments',
      booking(dentist, '2027-06-16'),
    ).expect(201);
    await post(dentist, `/appointments/${later.body.id}/reschedule`, {
      date: period.startDate,
      time: '10:10',
    }).expect(400);
    const publicProfile = await request(app.getHttpServer())
      .get(`/dentists/${dentist.id}`)
      .expect(200);
    expect(JSON.stringify(publicProfile.body)).not.toContain(input.reason);
    await remove(dentist, created.body.id).expect(204);
    expect((await slots(dentist).expect(200)).body.slots).toContain('10:00');
    await post(dentist, base, {
      ...period,
      allDay: true,
      requestId: randomUUID(),
    }).expect(201);
    expect((await slots(dentist).expect(200)).body.slots).toEqual([]);
    expect((await slots(dentist, 'video').expect(200)).body.slots).toEqual([]);
  });

  it('previews affected appointments and rechecks a booking made after preview', async () => {
    const dentist = await actor('dentist'),
      patient = await actor('patient');
    const fullDay = { ...period, allDay: true };
    await post(dentist, `${base}/preview`, fullDay).expect(200);
    const appointment = await post(
      patient,
      '/appointments',
      booking(dentist, period.startDate),
    ).expect(201);
    await post(dentist, base, { ...fullDay, requestId: randomUUID() }).expect(
      409,
    );
    expect((await get(dentist, base).expect(200)).body).toEqual([]);
    const preview = await post(dentist, `${base}/preview`, fullDay).expect(200);
    expect(preview.body.total).toBe(1);
    expect(preview.body.appointments[0]).toMatchObject({
      id: appointment.body.id,
      date: period.startDate,
      time: '10:00',
      type: 'clinic',
    });
    await post(
      patient,
      `/appointments/${appointment.body.id}/cancel`,
      {},
    ).expect(200);
    await post(dentist, base, { ...fullDay, requestId: randomUUID() }).expect(
      201,
    );
  });

  it('serializes a block against a simultaneous booking', async () => {
    const dentist = await actor('dentist'),
      patient = await actor('patient');
    const results = await Promise.all([
      post(dentist, base, { ...period, allDay: true, requestId: randomUUID() }),
      post(patient, '/appointments', booking(dentist, period.startDate)),
    ]);
    expect(results.filter((result) => result.status === 201)).toHaveLength(1);
    expect(results.map((result) => result.status).sort()).toEqual(
      expect.arrayContaining([201]),
    );
    expect([400, 409]).toContain(
      results.find((result) => result.status !== 201)!.status,
    );
  });

  it('validates calendar days, time ranges and weekday arrays; restricts access and ownership', async () => {
    const dentist = await actor('dentist'),
      other = await actor('dentist'),
      patient = await actor('patient');
    await request(app.getHttpServer()).get(base).expect(401);
    await get(patient, base).expect(403);
    const pending = await actor('dentist', 'pending_review');
    await get(pending, base).expect(403);
    for (const days of [[1, 1], [7], [1.5], ['1'], null]) {
      await patch(dentist, '/dentists/me', { videoWorkingDays: days }).expect(
        400,
      );
      await patch(dentist, `/dentists/me/clinics/${dentist.clinicId}`, {
        name: 'Test',
        hoursFrom: '10:00',
        hoursTo: '12:00',
        workingDays: days,
      }).expect(400);
    }
    for (const changes of [
      { startDate: '2027-02-30' },
      { startDate: '2027-06-16' },
      { endDate: '2029-01-01' },
      { fromTime: '14:00', toTime: '10:00' },
      { fromTime: null },
      { toTime: undefined },
      { reason: 'a'.repeat(201) },
    ])
      await post(dentist, `${base}/preview`, { ...period, ...changes }).expect(
        400,
      );
    await slots(dentist, 'unsupported').expect(400);
    await slots(dentist, 'video', '2027-02-30').expect(400);
    const created = await post(dentist, base, {
      ...period,
      requestId: randomUUID(),
    }).expect(201);
    await remove(other, created.body.id).expect(404);
    expect((await get(other, base).expect(200)).body).toEqual([]);
    expect(
      (await post(other, `${base}/preview`, period).expect(200)).body.total,
    ).toBe(0);
  });
});
