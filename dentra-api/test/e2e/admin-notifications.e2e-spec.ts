import { ConflictException, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { randomInt, randomUUID } from 'node:crypto';
import * as request from 'supertest';
import { Pool } from 'pg';
import { AppModule } from '../../src/app.module';
import { HttpExceptionFilter } from '../../src/common/filters/http-exception.filter';
import { NotificationsService } from '../../src/modules/notifications/notifications.service';

describe('Admin onboarding notifications (e2e)', () => {
  let app: INestApplication;
  let pool: Pool;
  let jwt: JwtService;
  type Actor = { id: string; token: string };
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

  async function admin(status = 'active'): Promise<Actor> {
    const { rows } = await pool.query(
      `insert into users (role, email, password_hash, status) values ('admin', $1, 'test-only', $2) returning id`,
      [`notifications-${randomUUID()}@dentra.test`, status],
    );
    return { id: rows[0].id, token: jwt.sign({ sub: rows[0].id, role: 'admin' }) };
  }

  async function applicant(complete = true): Promise<Actor> {
    const { rows } = await pool.query(`insert into users (role, mobile) values ('dentist', $1) returning id`, [
      `+91${randomInt(6000000000, 9999999999)}`,
    ]);
    const dentist = { id: rows[0].id, token: jwt.sign({ sub: rows[0].id, role: 'dentist' }) };
    await request(app.getHttpServer())
      .post('/dentists/applications')
      .set(auth(dentist))
      .send({
        fullName: 'Dr Notification Applicant',
        qualification: 'BDS',
        specialization: 'General Dentist',
        councilRegNo: randomUUID(),
        primaryClinicName: 'Synthetic Test Clinic',
        termsConsent: true,
        telemedicineConsent: true,
      })
      .expect(201);
    if (complete)
      await pool.query(
        `insert into dentist_documents (dentist_id, doc_type, file_url)
       select $1, type::kyc_doc_type, 'synthetic-test-only.pdf' from unnest($2::text[]) type`,
        [dentist.id, ['degree', 'council', 'id_proof', 'selfie']],
      );
    return dentist;
  }
  const submit = (dentist: Actor) =>
    request(app.getHttpServer()).post('/dentists/applications/me/submit').set(auth(dentist));
  const inbox = (actor: Actor) => request(app.getHttpServer()).get('/notifications').set(auth(actor));

  it('notifies every active admin only after a complete submission and deduplicates concurrent retries', async () => {
    const first = await admin(),
      second = await admin(),
      locked = await admin('locked');
    const dentist = await applicant(false);
    expect((await inbox(first).expect(200)).body.unreadCount).toBe(0);
    await submit(dentist).expect(422);
    expect((await inbox(first).expect(200)).body.items).toEqual([]);
    await pool.query(
      `insert into dentist_documents (dentist_id, doc_type, file_url)
       select $1, type::kyc_doc_type, 'synthetic-test-only.pdf' from unnest($2::text[]) type`,
      [dentist.id, ['degree', 'council', 'id_proof', 'selfie']],
    );
    const submissions = await Promise.all([submit(dentist), submit(dentist)]);
    expect(submissions.map((result) => result.status)).toEqual([200, 200]);
    for (const recipient of [first, second]) {
      const response = await inbox(recipient).expect(200);
      expect(response.body.unreadCount).toBe(1);
      expect(response.body.items).toHaveLength(1);
      expect(response.body.items[0]).toMatchObject({
        type: 'dentist_onboarding_submitted',
        dentistId: dentist.id,
        dentistName: 'Dr Notification Applicant',
        qualification: 'BDS',
        specialization: 'General Dentist',
        readAt: null,
      });
      expect(JSON.stringify(response.body)).not.toMatch(/file_url|councilRegNo|mobile|password/);
    }
    expect((await pool.query('select id from notifications where user_id = $1', [locked.id])).rows).toHaveLength(0);
    expect((await pool.query('select id from notifications where user_id = $1', [dentist.id])).rows).toHaveLength(0);
  });

  it('rolls back the submission, audit entry and notifications together if notification creation fails', async () => {
    const recipient = await admin(),
      dentist = await applicant();
    const service = app.get(NotificationsService);
    const insert = service.dentistOnboardingSubmitted.bind(service);
    const failure = jest.spyOn(service, 'dentistOnboardingSubmitted').mockImplementationOnce(async (client, row) => {
      await insert(client, row);
      throw new ConflictException('Synthetic submission failure');
    });
    try {
      await submit(dentist).expect(409);
    } finally {
      failure.mockRestore();
    }
    expect((await pool.query('select status from dentists where user_id = $1', [dentist.id])).rows[0].status).toBe(
      'draft',
    );
    expect((await pool.query('select id from audit_log where entity_id = $1', [dentist.id])).rows).toHaveLength(0);
    expect((await inbox(recipient).expect(200)).body.items).toEqual([]);
    await submit(dentist).expect(200);
    expect((await inbox(recipient).expect(200)).body.unreadCount).toBe(1);
  });

  it('restricts reads, cursors and application details to their authorized user and keeps newer requests unread', async () => {
    const first = await admin(),
      second = await admin(),
      dentist = await applicant();
    await submit(dentist).expect(200);
    const initial = (await inbox(first).expect(200)).body;
    const id = initial.items[0].id;
    await request(app.getHttpServer()).patch(`/notifications/${id}/read`).set(auth(second)).expect(404);
    await request(app.getHttpServer()).get(`/notifications?cursor=${id}`).set(auth(second)).expect(404);
    await request(app.getHttpServer())
      .post('/notifications/read-all')
      .set(auth(second))
      .send({ through: id })
      .expect(404);
    const details = await request(app.getHttpServer())
      .get(`/admin/dentists/${dentist.id}`)
      .set(auth(first))
      .expect(200);
    expect(details.body.id).toBe(dentist.id);
    expect(details.body.status).toBe('pending_review');
    expect(details.body.documents).toHaveLength(4);
    await request(app.getHttpServer()).get(`/admin/dentists/${dentist.id}`).set(auth(dentist)).expect(403);
    await request(app.getHttpServer()).get(`/admin/dentists/${randomUUID()}`).set(auth(first)).expect(404);
    await request(app.getHttpServer()).get('/admin/dentists/invalid').set(auth(first)).expect(400);
    // Once approved, a dentist still cannot access an admin notification.
    await pool.query(`update dentists set status = 'verified' where user_id = $1`, [dentist.id]);
    await request(app.getHttpServer()).patch(`/notifications/${id}/read`).set(auth(dentist)).expect(404);
    expect((await inbox(dentist).expect(200)).body.items).toEqual([]);
    const next = await applicant();
    await submit(next).expect(200);
    await request(app.getHttpServer())
      .post('/notifications/read-all')
      .set(auth(first))
      .send({ through: id })
      .expect(200);
    const latest = (await inbox(first).expect(200)).body;
    expect(latest.unreadCount).toBe(1);
    expect(latest.items[0].dentistId).toBe(next.id);
    expect(latest.items[0].readAt).toBeNull();
    const read = await request(app.getHttpServer())
      .patch(`/notifications/${latest.items[0].id}/read`)
      .set(auth(first))
      .expect(200);
    const retry = await request(app.getHttpServer())
      .patch(`/notifications/${latest.items[0].id}/read`)
      .set(auth(first))
      .expect(200);
    expect(retry.body.readAt).toBe(read.body.readAt);
    expect((await inbox(second).expect(200)).body.unreadCount).toBe(2);
    // Historical notifications continue to open the current application after review.
    const reviewed = await request(app.getHttpServer())
      .get(`/admin/dentists/${dentist.id}`)
      .set(auth(first))
      .expect(200);
    expect(reviewed.body.status).toBe('verified');
  });
});
