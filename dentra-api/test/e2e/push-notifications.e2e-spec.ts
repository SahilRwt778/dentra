import { ConflictException, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { randomInt, randomUUID } from 'node:crypto';
import * as request from 'supertest';
import { Pool } from 'pg';
import { AppModule } from '../../src/app.module';
import { HttpExceptionFilter } from '../../src/common/filters/http-exception.filter';
import { TokensService } from '../../src/modules/identity/auth/tokens.service';
import { NotificationsService } from '../../src/modules/notifications/notifications.service';
import { FirebasePushService } from '../../src/modules/notifications/firebase-push.service';
import { PushDeliveryService } from '../../src/modules/notifications/push-delivery.service';

describe('Patient push notifications (e2e)', () => {
  let app: INestApplication, pool: Pool, tokens: TokensService, worker: PushDeliveryService, firebase: FirebasePushService;
  type Actor = { id: string; token: string; refresh: string; installation: string; clinicId?: string };
  const auth = (actor: Actor) => ({ Authorization: `Bearer ${actor.token}` });
  const fcmToken = () => `synthetic-fcm-${randomUUID()}`;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    tokens = app.get(TokensService); worker = app.get(PushDeliveryService); firebase = app.get(FirebasePushService);
  });
  afterAll(async () => { await pool.end(); await app.close(); });

  async function actor(role: 'patient' | 'dentist', installation = randomUUID()): Promise<Actor> {
    const { rows } = await pool.query('insert into users (role, mobile) values ($1, $2) returning id', [role, `+91${randomInt(6000000000, 9999999999)}`]);
    const session = await tokens.issue(rows[0].id, role, installation);
    const value: Actor = { id: rows[0].id, token: session.accessToken, refresh: session.refreshToken, installation };
    if (role === 'patient') await request(app.getHttpServer()).post('/patients/register').set(auth(value)).send({ fullName: 'Synthetic Push Patient', dateOfBirth: '1990-01-01', termsConsent: true, telemedicineConsent: true }).expect(201);
    else {
      const response = await request(app.getHttpServer()).post('/dentists/applications').set(auth(value)).send({ fullName: 'Synthetic Push Dentist', qualification: 'BDS', specialization: 'General Dentist', councilRegNo: randomUUID(), primaryClinicName: 'Synthetic Clinic', feeClinicPaise: 50000, termsConsent: true, telemedicineConsent: true }).expect(201);
      value.clinicId = response.body.clinics[0].id;
      await pool.query(`update dentists set status = 'verified' where user_id = $1`, [value.id]);
    }
    return value;
  }
  const register = (actor: Actor, token = fcmToken()) => request(app.getHttpServer()).put('/notifications/push-device').set(auth(actor)).send({ token, platform: 'android' });
  function booking(dentist: Actor, time = '10:30') { return { dentistId: dentist.id, clinicId: dentist.clinicId, type: 'clinic', date: '2027-06-15', time, concern: 'Private concern excluded from push', paymentMethod: 'pay_at_clinic', idempotencyKey: randomUUID() }; }
  const book = (patient: Actor, dentist: Actor, time = '10:30') => request(app.getHttpServer()).post('/appointments').set(auth(patient)).send(booking(dentist, time));
  const device = async (patient: Actor) => (await pool.query('select * from push_devices where installation_id = $1', [patient.installation])).rows[0];
  const deliveries = async (patient: Actor) => (await pool.query('select j.* from push_deliveries j join push_devices d on d.id = j.device_id where d.installation_id = $1 order by j.created_at', [patient.installation])).rows;
  function enable() { jest.spyOn(firebase, 'isEnabled').mockReturnValue(true); }
  const send = () => firebase.send as jest.Mock;

  it('requires a live patient session, hides tokens, and preserves binding on registration heartbeat', async () => {
    const patient = await actor('patient'), dentist = await actor('dentist'), token = fcmToken();
    const status = await request(app.getHttpServer()).get('/notifications/push-device').set(auth(patient)).expect(200);
    expect(status.body).toEqual({ available: false });
    await request(app.getHttpServer()).put('/notifications/push-device').send({ token, platform: 'android' }).expect(401);
    await register(dentist).expect(403);
    await request(app.getHttpServer()).put('/notifications/push-device').set(auth(patient)).send({ token: 'invalid', platform: 'android' }).expect(400);
    const legacy = app.get(JwtService).sign({ sub: patient.id, role: 'patient' });
    await request(app.getHttpServer()).put('/notifications/push-device').set('Authorization', `Bearer ${legacy}`).send({ token, platform: 'android' }).expect(409);
    const response = await register(patient, token).expect(200);
    expect(response.body).toMatchObject({ enabled: true, platform: 'android' });
    expect(JSON.stringify(response.body)).not.toContain(token);
    const first = await device(patient);
    await register(patient, token).expect(200);
    expect((await device(patient)).binding_id).toBe(first.binding_id);
    await request(app.getHttpServer()).put('/notifications/push-device').set(auth(patient)).send({ token, platform: 'android', userId: dentist.id }).expect(400);
  });

  it('queues delivery atomically once and skips historical replay when a phone is first registered', async () => {
    const patient = await actor('patient'), dentist = await actor('dentist');
    await book(patient, dentist).expect(201);
    await register(patient).expect(200);
    expect(await deliveries(patient)).toHaveLength(0);
    const body = booking(dentist, '11:00');
    await request(app.getHttpServer()).post('/appointments').set(auth(patient)).send(body).expect(201);
    await request(app.getHttpServer()).post('/appointments').set(auth(patient)).send(body).expect(201);
    expect(await deliveries(patient)).toHaveLength(1);
    await worker.runOnce();
    expect(send()).not.toHaveBeenCalled();
    enable();
    await Promise.all([worker.runOnce(), worker.runOnce()]);
    expect(send()).toHaveBeenCalledTimes(1);
    expect((await deliveries(patient))[0]).toMatchObject({ status: 'sent', attempts: 1 });
    const notificationId = send().mock.calls[0][1];
    const notification = await request(app.getHttpServer()).get(`/notifications/${notificationId}`).set(auth(patient)).expect(200);
    expect(notification.body.type).toBe('booking_confirmed');
    await request(app.getHttpServer()).get(`/notifications/${notificationId}`).set(auth(dentist)).expect(404);
    expect(send().mock.calls[0]).toHaveLength(3); // token, opaque update ID, TTL; no clinical payload
  });

  it('rolls back the delivery queue when booking fails after its notification insert', async () => {
    const patient = await actor('patient'), dentist = await actor('dentist');
    await register(patient).expect(200);
    const service = app.get(NotificationsService), original = service.patientAppointmentEvent.bind(service);
    const failure = jest.spyOn(service, 'patientAppointmentEvent').mockImplementationOnce(async (...args) => { await original(...args); throw new ConflictException('Synthetic rollback'); });
    try { await book(patient, dentist).expect(409); } finally { failure.mockRestore(); }
    expect(await deliveries(patient)).toHaveLength(0);
  });

  it('retries transient provider errors, recovers an expired worker lease and preserves sent state', async () => {
    const patient = await actor('patient'), dentist = await actor('dentist');
    await register(patient).expect(200); await book(patient, dentist).expect(201); enable();
    send().mockRejectedValueOnce({ code: 'messaging/server-unavailable' });
    await worker.runOnce();
    expect((await deliveries(patient))[0]).toMatchObject({ status: 'pending', attempts: 1, last_error_code: 'messaging/server-unavailable' });
    await pool.query(`update push_deliveries set status = 'sending', lease_until = now() - interval '1 minute' where id = $1`, [(await deliveries(patient))[0].id]);
    await worker.runOnce();
    expect((await deliveries(patient))[0]).toMatchObject({ status: 'sent', attempts: 2 });
    const calls = send().mock.calls.length;
    await worker.runOnce();
    expect(send()).toHaveBeenCalledTimes(calls);
  });

  it('invalidates an expired FCM token without disabling a newer token refreshed during delivery', async () => {
    const patient = await actor('patient'), dentist = await actor('dentist');
    await register(patient).expect(200); await book(patient, dentist).expect(201); enable();
    let reject: (value: unknown) => void = () => undefined;
    let started: () => void = () => undefined;
    const waiting = new Promise<void>(resolve => { started = resolve; });
    send().mockImplementationOnce(() => new Promise((_resolve, failure) => { reject = failure; started(); }));
    const run = worker.runOnce(); await waiting;
    const before = await device(patient);
    await register(patient).expect(200);
    expect((await device(patient)).binding_id).not.toBe(before.binding_id);
    reject({ code: 'messaging/registration-token-not-registered' }); await run;
    expect((await device(patient)).enabled).toBe(true);
    await book(patient, dentist, '11:00').expect(201);
    send().mockRejectedValueOnce({ code: 'messaging/registration-token-not-registered' });
    await worker.runOnce();
    expect((await device(patient)).enabled).toBe(false);
  });

  it('keeps refresh rotation on the same device binding and revokes push after an offline/expired-JWT logout', async () => {
    const patient = await actor('patient'), dentist = await actor('dentist');
    const token = fcmToken(); await register(patient, token).expect(200);
    const before = await device(patient);
    const rotation = await request(app.getHttpServer()).post('/auth/refresh').send({ refreshToken: patient.refresh }).expect(200);
    patient.token = rotation.body.accessToken;
    await register(patient, token).expect(200);
    expect((await device(patient)).binding_id).toBe(before.binding_id);
    await book(patient, dentist).expect(201);
    // No access token is needed: the opaque refresh token authorizes revoking its own family.
    await request(app.getHttpServer()).post('/auth/logout').send({ refreshToken: patient.refresh }).expect(204);
    expect((await device(patient)).enabled).toBe(false);
    await request(app.getHttpServer()).post('/auth/refresh').send({ refreshToken: rotation.body.refreshToken }).expect(401);
    await register(patient).expect(409);
    enable(); await worker.runOnce();
    expect(send()).not.toHaveBeenCalled();
    expect((await deliveries(patient))[0].status).toBe('skipped');
  });

  it('does not deliver an old account’s queued updates after a newer account takes over the installation', async () => {
    const installation = randomUUID(), first = await actor('patient', installation), dentist = await actor('dentist');
    await register(first).expect(200); await book(first, dentist).expect(201);
    const old = await deliveries(first);
    const second = await actor('patient', installation);
    await register(second).expect(200);
    await register(first).expect(409); // an older session cannot rebind the phone after a late response
    await request(app.getHttpServer()).delete('/notifications/push-device').set(auth(first)).expect(204);
    await request(app.getHttpServer()).post('/auth/logout').send({ refreshToken: first.refresh }).expect(204);
    expect((await device(second))).toMatchObject({ user_id: second.id, enabled: true });
    enable(); await worker.runOnce();
    expect(send()).not.toHaveBeenCalled();
    await request(app.getHttpServer()).get(`/notifications/${old[0].notification_id}`).set(auth(second)).expect(404);
    await book(second, dentist, '11:00').expect(201); await worker.runOnce();
    expect(send()).toHaveBeenCalledTimes(1);
  });

  it('skips read or stale notifications and safely unregisters only the current phone session', async () => {
    const patient = await actor('patient'), dentist = await actor('dentist');
    await register(patient).expect(200); await book(patient, dentist).expect(201);
    const first = (await deliveries(patient))[0];
    await request(app.getHttpServer()).patch(`/notifications/${first.notification_id}/read`).set(auth(patient)).expect(200);
    await book(patient, dentist, '11:00').expect(201);
    const second = (await deliveries(patient))[1];
    await pool.query(`update notifications set created_at = now() - interval '25 hours' where id = $1`, [second.notification_id]);
    enable(); await worker.runOnce();
    expect(send()).not.toHaveBeenCalled();
    expect((await deliveries(patient)).every(row => row.status === 'skipped')).toBe(true);
    await request(app.getHttpServer()).delete('/notifications/push-device').set(auth(patient)).expect(204);
    expect((await device(patient)).enabled).toBe(false);
    await book(patient, dentist, '11:30').expect(201);
    expect(await deliveries(patient)).toHaveLength(2);
  });
});
