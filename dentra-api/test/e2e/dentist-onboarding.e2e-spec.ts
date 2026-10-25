import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import * as request from 'supertest';
import { Pool } from 'pg';
import { AppModule } from '../../src/app.module';
import { HttpExceptionFilter } from '../../src/common/filters/http-exception.filter';

describe('Self-serve dentist application and authorization (e2e)', () => {
  let app: INestApplication;
  let pool: Pool;
  let adminToken: string;
  const details = {
    fullName: 'Dr Onboarding Test', qualification: 'BDS', specialization: 'General Dentist',
    councilRegNo: 'ONBOARD-TEST', primaryClinicName: 'Onboarding Test Clinic',
    offersVideo: true, termsConsent: true, telemedicineConsent: true,
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const { rows } = await pool.query(
      `insert into users (role, email, password_hash) values ('admin', $1, 'test-only') returning id`,
      [`onboarding-${Date.now()}@dentra.test`],
    );
    adminToken = moduleRef.get(JwtService).sign({ sub: rows[0].id, role: 'admin' });
  });

  afterAll(async () => { await pool.end(); await app.close(); });

  async function newApplicant() {
    const mobile = `+9198${Math.floor(10000000 + Math.random() * 89999999)}`;
    const log = jest.spyOn(console, 'log').mockImplementation();
    let otpId: string;
    let code: string | undefined;
    try {
      const sent = await request(app.getHttpServer()).post('/auth/otp/request').send({ mobile, purpose: 'dentist' }).expect(200);
      expect(sent.body.isNewAccount).toBe(true);
      otpId = sent.body.otpId;
      code = /code=(\d{4})(?!\d)/.exec(log.mock.calls.map((args) => args.join(' ')).find((line) => line.includes(mobile)) ?? '')?.[1];
    } finally { log.mockRestore(); }
    expect(code).toBeDefined();
    const verified = await request(app.getHttpServer()).post('/auth/otp/verify').send({ otpId, code, deviceId: 'onboarding-e2e' }).expect(200);
    expect(verified.body.isNewAccount).toBe(true);
    return { token: verified.body.accessToken as string, mobile };
  }

  function upload(token: string, dentistId: string, type: string) {
    return request(app.getHttpServer()).post(`/dentists/applications/${dentistId}/documents`)
      .set('Authorization', `Bearer ${token}`).field('docType', type)
      .attach('file', Buffer.from(`%PDF-1.4\nSynthetic ${type}\n%%EOF`), `${type}.pdf`);
  }

  async function blockedFromCare(token: string) {
    for (const path of ['/appointments', '/dentists/me/patients', '/dentists/me/clinics']) {
      await request(app.getHttpServer()).get(path).set('Authorization', `Bearer ${token}`).expect(403);
    }
    await request(app.getHttpServer()).post('/appointments/00000000-0000-0000-0000-000000000000/start')
      .set('Authorization', `Bearer ${token}`).expect(403);
  }

  it('keeps a new applicant in onboarding until an admin approves their completed request', async () => {
    await request(app.getHttpServer()).post('/dentists/applications').send(details).expect(401);
    const { token } = await newApplicant();
    const auth = { Authorization: `Bearer ${token}` };
    await request(app.getHttpServer()).get('/dentists/me').set(auth).expect(404);
    await blockedFromCare(token);
    await request(app.getHttpServer()).post('/dentists/applications').set(auth)
      .send({ ...details, termsConsent: false }).expect(400);

    const created = await request(app.getHttpServer()).post('/dentists/applications').set(auth)
      .send({ ...details, status: 'verified' }).expect(201);
    const id = created.body.id;
    expect(created.body.status).toBe('draft');
    expect(created.body.submittedBy).toBe('self');
    await request(app.getHttpServer()).post(`/admin/dentists/${id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`).send({ force: true }).expect(409);

    const edited = await request(app.getHttpServer()).patch('/dentists/applications/me').set(auth)
      .send({ ...details, fullName: 'Dr Edited Applicant', yearsExperience: 7 }).expect(200);
    expect(edited.body.fullName).toBe('Dr Edited Applicant');
    expect(edited.body.clinics[0].id).toBe(created.body.clinics[0].id);
    await upload(token, id, 'degree').then((res) => expect(res.status).toBe(201));
    const resumed = await request(app.getHttpServer()).get('/dentists/me').set(auth).expect(200);
    expect(resumed.body.documents.map((doc: { docType: string }) => doc.docType)).toEqual(['degree']);
    await request(app.getHttpServer()).post('/dentists/applications/me/submit').set(auth).expect(422);
    const queueBefore = await request(app.getHttpServer()).get('/admin/dentists?status=pending_review')
      .set('Authorization', `Bearer ${adminToken}`).expect(200);
    expect(queueBefore.body.items.some((item: { id: string }) => item.id === id)).toBe(false);

    for (const type of ['council', 'id_proof', 'selfie']) {
      await upload(token, id, type).then((res) => expect(res.status).toBe(201));
    }
    const submitted = await request(app.getHttpServer()).post('/dentists/applications/me/submit').set(auth).expect(200);
    expect(submitted.body.status).toBe('pending_review');
    await request(app.getHttpServer()).post('/dentists/applications/me/submit').set(auth).expect(200);
    const queue = await request(app.getHttpServer()).get('/admin/dentists?status=pending_review')
      .set('Authorization', `Bearer ${adminToken}`).expect(200);
    expect(queue.body.items.some((item: { id: string }) => item.id === id)).toBe(true);
    const audit = await pool.query("select count(*)::int as count from audit_log where entity_id = $1 and action = 'onboarding_submitted'", [id]);
    expect(audit.rows[0].count).toBe(1);
    await blockedFromCare(token);
    await request(app.getHttpServer()).patch('/dentists/applications/me').set(auth).send(details).expect(409);
    await upload(token, id, 'degree').then((res) => expect(res.status).toBe(409));
    await request(app.getHttpServer()).post(`/admin/dentists/${id}/approve`).set(auth).send({}).expect(403);

    await request(app.getHttpServer()).post(`/admin/dentists/${id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`).send({}).expect(200);
    const me = await request(app.getHttpServer()).get('/dentists/me').set(auth).expect(200);
    expect(me.body.status).toBe('verified');
    await request(app.getHttpServer()).get('/appointments').set(auth).expect(200);
    await request(app.getHttpServer()).get('/dentists/me/patients').set(auth).expect(200);
    await request(app.getHttpServer()).get(`/dentists/${id}`).expect(200);

    await request(app.getHttpServer()).post(`/admin/dentists/${id}/disable`)
      .set('Authorization', `Bearer ${adminToken}`).expect(200);
    await blockedFromCare(token);
    await request(app.getHttpServer()).get(`/dentists/${id}`).expect(404);
  });

  it('returns the admin rejection reason and keeps the same session restricted after rejection', async () => {
    const { token } = await newApplicant();
    const auth = { Authorization: `Bearer ${token}` };
    const created = await request(app.getHttpServer()).post('/dentists/applications').set(auth).send(details).expect(201);
    for (const type of ['degree', 'council', 'id_proof', 'selfie']) {
      await upload(token, created.body.id, type).then((res) => expect(res.status).toBe(201));
    }
    await request(app.getHttpServer()).post('/dentists/applications/me/submit').set(auth).expect(200);
    const reason = 'The council certificate does not match the registration number.';
    await request(app.getHttpServer()).post(`/admin/dentists/${created.body.id}/reject`)
      .set('Authorization', `Bearer ${adminToken}`).send({ reason }).expect(200);
    const me = await request(app.getHttpServer()).get('/dentists/me').set(auth).expect(200);
    expect(me.body.status).toBe('rejected');
    expect(me.body.rejectionReason).toBe(reason);
    await blockedFromCare(token);
    await request(app.getHttpServer()).post('/dentists/applications/me/submit').set(auth).expect(409);
    await request(app.getHttpServer()).post('/dentists/applications').set(auth).send(details).expect(409);
    await request(app.getHttpServer()).get(`/dentists/${created.body.id}`).expect(404);
  });

  it('serves byte-validated private documents only to the owning dentist and reviewing admin', async () => {
    const owner = await newApplicant(), other = await newApplicant();
    const auth = { Authorization: `Bearer ${owner.token}` };
    const created = await request(app.getHttpServer()).post('/dentists/applications').set(auth).send(details).expect(201);
    const id = created.body.id;
    await request(app.getHttpServer()).post(`/dentists/applications/${id}/documents`).set(auth)
      .field('docType', 'degree').attach('file', Buffer.from('<html>not a PDF</html>'), 'degree.pdf').expect(400);
    const first = await upload(owner.token, id, 'degree').expect(201);
    const url = first.body.fileUrl;
    await request(app.getHttpServer()).get(url).expect(401);
    await request(app.getHttpServer()).get(url).set('Authorization', `Bearer ${other.token}`).expect(403);
    await request(app.getHttpServer()).get(url).set(auth).expect('Content-Type', /application\/pdf/)
      .expect('Cache-Control', 'private, no-store').expect('X-Content-Type-Options', 'nosniff').expect(200);
    await request(app.getHttpServer()).get(url).set('Authorization', `Bearer ${adminToken}`).expect(200);
    const replacement = await upload(owner.token, id, 'degree').expect(201);
    expect(replacement.body.id).toBe(first.body.id);
    await request(app.getHttpServer()).get(url).set(auth).expect(200);
  });
});
