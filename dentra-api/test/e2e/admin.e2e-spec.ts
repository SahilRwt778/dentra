import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import * as request from 'supertest';
import { Pool } from 'pg';
import { AppModule } from '../../src/app.module';
import { HttpExceptionFilter } from '../../src/common/filters/http-exception.filter';

/**
 * Dentist review, the audit trail, and privacy requests — the Admin and
 * Privacy tags. Admin login itself (email + password) is real and
 * covered separately in auth-admin-login.e2e-spec.ts; admin accounts
 * here are seeded directly instead — there is no self-serve admin
 * signup by design — and the JWT is signed the same way
 * TokensService.issue signs every other token, just skipping the login
 * endpoint in front of it, as a test-speed shortcut.
 */
describe('Admin: dentist review, audit log, privacy requests (e2e)', () => {
  let app: INestApplication;
  let pool: Pool;
  let jwtService: JwtService;
  let logSpy: jest.SpyInstance;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    jwtService = moduleRef.get(JwtService);
  });

  afterAll(async () => {
    await pool.end();
    await app.close();
  });

  function freshMobile(prefix: string): string {
    const n = Math.floor(1_000_000_00 + Math.random() * 8_999_999_99);
    return `+91${prefix}${n}`;
  }

  async function seedAdminToken(): Promise<string> {
    const { rows } = await pool.query(
      `insert into users (role, email, password_hash) values ('admin', $1, 'seed-placeholder') returning id`,
      [`admin-e2e-${Date.now()}-${Math.random().toString(36).slice(2)}@dentra.test`],
    );
    return jwtService.signAsync({ sub: rows[0].id, role: 'admin' });
  }

  async function verifiedToken(mobile: string, purpose: 'patient' | 'dentist'): Promise<string> {
    logSpy = jest.spyOn(console, 'log').mockImplementation();
    const req = await request(app.getHttpServer()).post('/auth/otp/request').send({ mobile, purpose }).expect(200);
    const logged = logSpy.mock.calls.map((a) => String(a[0])).find((l) => l.includes(mobile));
    const code = /code=(\d{4})(?!\d)/.exec(logged ?? '')?.[1];
    logSpy.mockRestore();
    const verify = await request(app.getHttpServer())
      .post('/auth/otp/verify')
      .send({ otpId: req.body.otpId, code, deviceId: 'e2e-admin' })
      .expect(200);
    return verify.body.accessToken;
  }

  it('rejects unauthenticated and non-admin callers', async () => {
    await request(app.getHttpServer()).get('/admin/dentists').expect(401);

    const dentistToken = await verifiedToken(freshMobile('80'), 'dentist');
    await request(app.getHttpServer())
      .get('/admin/dentists')
      .set('Authorization', `Bearer ${dentistToken}`)
      .expect(403);
  });

  it('creates a dentist with a mobile number that already belongs to a patient without changing the patient identity', async () => {
    const adminToken = await seedAdminToken();
    const mobile = freshMobile('87');
    await verifiedToken(mobile, 'patient');
    const { rows: before } = await pool.query("select id from users where mobile = $1 and role = 'patient'", [mobile]);
    const created = await request(app.getHttpServer()).post('/admin/dentists')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ fullName: 'Dentist And Patient', mobile, primaryClinicName: 'Shared Number Clinic' }).expect(201);
    expect(created.body.id).not.toBe(before[0].id);
    const { rows: after } = await pool.query('select id, role from users where mobile = $1 order by role::text', [mobile]);
    expect(after).toEqual([{ id: created.body.id, role: 'dentist' }, { id: before[0].id, role: 'patient' }]);
  });

  it('creates, lists, approves, disables, enables and rejects dentists — each action logged to the audit trail', async () => {
    const adminToken = await seedAdminToken();

    const created = await request(app.getHttpServer())
      .post('/admin/dentists')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ fullName: 'Admin Created Dentist', mobile: freshMobile('81'), primaryClinicName: 'Admin Seeded Clinic' })
      .expect(201);
    expect(created.body.status).toBe('pending_review');
    expect(created.body.qualification).toBe(''); // left blank for the dentist to complete via PATCH /dentists/me

    const listed = await request(app.getHttpServer())
      .get('/admin/dentists?status=pending_review')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(listed.body.items.some((d: { id: string }) => d.id === created.body.id)).toBe(true);

    await request(app.getHttpServer())
      .post(`/admin/dentists/${created.body.id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
      .expect(422); // no documents on file yet

    const approved = await request(app.getHttpServer())
      .post(`/admin/dentists/${created.body.id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ force: true })
      .expect(200);
    expect(approved.body.status).toBe('verified');

    await request(app.getHttpServer())
      .post(`/admin/dentists/${created.body.id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ force: true })
      .expect(409); // already verified

    const disabled = await request(app.getHttpServer())
      .post(`/admin/dentists/${created.body.id}/disable`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(disabled.body.status).toBe('disabled');

    const enabled = await request(app.getHttpServer())
      .post(`/admin/dentists/${created.body.id}/enable`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(enabled.body.status).toBe('verified');

    const toReject = await request(app.getHttpServer())
      .post('/admin/dentists')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ fullName: 'To Be Rejected', mobile: freshMobile('82'), primaryClinicName: 'Rejected Clinic' })
      .expect(201);
    const rejected = await request(app.getHttpServer())
      .post(`/admin/dentists/${toReject.body.id}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Documents inconsistent with council registry.' })
      .expect(200);
    expect(rejected.body.status).toBe('rejected');
    expect(rejected.body.rejectionReason).toBe('Documents inconsistent with council registry.');

    const reconsidered = await request(app.getHttpServer())
      .post(`/admin/dentists/${toReject.body.id}/reconsider`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(reconsidered.body.status).toBe('pending_review');
    expect(reconsidered.body.resubmissionCount).toBe(1);

    await request(app.getHttpServer())
      .post(`/admin/dentists/${toReject.body.id}/reconsider`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(409); // no longer rejected — already back in pending_review

    const audit = await request(app.getHttpServer())
      .get(`/admin/audit-log?entityType=dentist&entityId=${created.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(audit.body.items.map((i: { action: string }) => i.action)).toEqual(
      expect.arrayContaining(['created', 'approved_with_override', 'disabled', 'enabled']),
    );
  });

  it('refuses overrideVerify without a reason, but verifies immediately with one and logs the override', async () => {
    const adminToken = await seedAdminToken();

    await request(app.getHttpServer())
      .post('/admin/dentists')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ fullName: 'Bad Override', mobile: freshMobile('83'), primaryClinicName: 'X', overrideVerify: true })
      .expect(422);

    const overridden = await request(app.getHttpServer())
      .post('/admin/dentists')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        fullName: 'Pre-Verified Sales Visit',
        mobile: freshMobile('84'),
        primaryClinicName: 'Sales Clinic',
        overrideVerify: true,
        overrideReason: 'KYC checked in person during the onboarding visit.',
      })
      .expect(201);
    expect(overridden.body.status).toBe('verified');

    const audit = await request(app.getHttpServer())
      .get(`/admin/audit-log?entityType=dentist&entityId=${overridden.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(audit.body.items[0].action).toBe('created_with_override_verify');
    expect(audit.body.items[0].detail).toBe('KYC checked in person during the onboarding visit.');
  });

  it('approves without force once degree, council, ID proof and selfie are on file — clinic proof and insurance are not required', async () => {
    const adminToken = await seedAdminToken();
    const dentistToken = await verifiedToken(freshMobile('86'), 'dentist');
    const application = await request(app.getHttpServer())
      .post('/dentists/applications')
      .set('Authorization', `Bearer ${dentistToken}`)
      .send({
        fullName: 'Fully Documented Dentist',
        qualification: 'BDS',
        specialization: 'General Dentist',
        councilRegNo: `RECONSIDER-E2E-${Date.now()}`,
        primaryClinicName: 'Documented Clinic',
        termsConsent: true,
        telemedicineConsent: true,
      })
      .expect(201);
    const dentistId = application.body.id;

    for (const docType of ['degree', 'council', 'id_proof', 'selfie']) {
      await request(app.getHttpServer())
        .post(`/dentists/applications/${dentistId}/documents`)
        .set('Authorization', `Bearer ${dentistToken}`)
        .field('docType', docType)
        .attach('file', Buffer.from(`%PDF-1.4\nSynthetic ${docType}\n%%EOF`), `${docType}.pdf`)
        .expect(201);
    }

    await request(app.getHttpServer())
      .post('/dentists/applications/me/submit')
      .set('Authorization', `Bearer ${dentistToken}`)
      .expect(200);

    const approved = await request(app.getHttpServer())
      .post(`/admin/dentists/${dentistId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
      .expect(200);
    expect(approved.body.status).toBe('verified');
  });

  it('lets a patient file a privacy request and only an admin list or resolve it', async () => {
    const adminToken = await seedAdminToken();
    const patientToken = await verifiedToken(freshMobile('85'), 'patient');
    await request(app.getHttpServer())
      .post('/patients/register')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({ fullName: 'Privacy Patient', dateOfBirth: '1992-05-05', termsConsent: true, telemedicineConsent: true })
      .expect(201);

    const filed = await request(app.getHttpServer())
      .post('/privacy-requests')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({ type: 'export' })
      .expect(201);
    expect(filed.body.status).toBe('open');
    expect(filed.body.patientName).toBe('Privacy Patient');
    expect(new Date(filed.body.slaDueAt).getTime()).toBeGreaterThan(Date.now());

    await request(app.getHttpServer())
      .get('/privacy-requests')
      .set('Authorization', `Bearer ${patientToken}`)
      .expect(403);

    const listed = await request(app.getHttpServer())
      .get('/privacy-requests?status=open')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(listed.body.some((r: { id: string }) => r.id === filed.body.id)).toBe(true);

    const resolved = await request(app.getHttpServer())
      .post(`/privacy-requests/${filed.body.id}/resolve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(resolved.body.status).toBe('resolved');

    await request(app.getHttpServer())
      .post(`/privacy-requests/${filed.body.id}/resolve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(409);

    const audit = await request(app.getHttpServer())
      .get(`/admin/audit-log?entityType=patient&entityId=${filed.body.patientId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(audit.body.items[0].action).toBe('resolved_export');
  });

  it('lists appointments across every dentist for an admin, filterable by today/upcoming/past', async () => {
    const adminToken = await seedAdminToken();
    const dentistToken = await verifiedToken(freshMobile('89'), 'dentist');
    const application = await request(app.getHttpServer())
      .post('/dentists/applications')
      .set('Authorization', `Bearer ${dentistToken}`)
      .send({
        fullName: 'Admin Appointments Dentist',
        qualification: 'BDS',
        specialization: 'General Dentist',
        councilRegNo: `ADMIN-APPT-E2E-${Date.now()}`,
        primaryClinicName: 'Admin Appointments Clinic',
        feeClinicPaise: 50000,
        termsConsent: true,
        telemedicineConsent: true,
      })
      .expect(201);
    const dentistId = application.body.id;
    await pool.query("update dentists set status = 'verified' where user_id = $1", [dentistId]);

    const clinics = await request(app.getHttpServer())
      .get('/dentists/me/clinics')
      .set('Authorization', `Bearer ${dentistToken}`)
      .expect(200);
    const clinicId = clinics.body[0].id;

    const patientToken = await verifiedToken(freshMobile('90'), 'patient');
    await request(app.getHttpServer())
      .post('/patients/register')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({ fullName: 'Admin Appointments Patient', dateOfBirth: '1990-01-01', termsConsent: true, telemedicineConsent: true })
      .expect(201);

    const booked = await request(app.getHttpServer())
      .post('/appointments')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({
        dentistId,
        clinicId,
        type: 'clinic',
        date: '2027-05-01',
        time: '11:00',
        concern: 'Admin visibility check',
        paymentMethod: 'upi',
        idempotencyKey: `idem-admin-appt-${Date.now()}`,
      })
      .expect(201);

    const upcoming = await request(app.getHttpServer())
      .get('/admin/appointments?filter=upcoming&from=2027-05-01&to=2027-05-01&limit=100')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const found = upcoming.body.items.find((a: { id: string }) => a.id === booked.body.id);
    expect(found).toBeTruthy();
    expect(found.patientName).toBe('Admin Appointments Patient');
    expect(found.dentistName).toBe('Admin Appointments Dentist');
    // 'pending' until the Razorpay payment.captured webhook confirms it —
    // booking no longer stubs online payments as instantly paid.
    expect(found.payment.status).toBe('pending');

    const today = await request(app.getHttpServer())
      .get('/admin/appointments?filter=today')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(today.body.items.some((a: { id: string }) => a.id === booked.body.id)).toBe(false);

    // More than one page of history and today's visits, without touching external payment providers.
    const { rows: history } = await pool.query<{ id: string; status: string }>(
      `insert into appointments (patient_id, dentist_id, clinic_id, type, scheduled_date, scheduled_time, concern_summary, status)
       select a.patient_id, a.dentist_id, a.clinic_id, 'clinic', '2000-01-02'::date,
              ('09:00'::time + i * interval '15 minutes')::time, 'Admin pagination fixture',
              (case when i < 5 then 'cancelled' when i < 15 then 'completed' else 'booked' end)::appointment_status
       from appointments a cross join generate_series(0, 24) i where a.id = $1 returning id, status`,
      [booked.body.id],
    );
    await pool.query(
      `insert into appointments (patient_id, dentist_id, clinic_id, type, scheduled_date, scheduled_time, concern_summary, status)
       select a.patient_id, a.dentist_id, a.clinic_id, 'clinic', (now() at time zone 'Asia/Kolkata')::date,
              ('09:00'::time + i * interval '15 minutes')::time, 'Admin today fixture',
              (case when i < 5 then 'cancelled' when i < 15 then 'completed' else 'booked' end)::appointment_status
       from appointments a cross join generate_series(0, 24) i where a.id = $1`,
      [booked.body.id],
    );
    const paidAppointment = history.find(item => item.status === 'completed')!.id;
    const retriedAppointment = history.find(item => item.status === 'booked')!.id;
    await pool.query(
      `insert into transactions (appointment_id, idempotency_key, amount_paise, method, status, created_at) values
         ($1, $3, 10000, 'card', 'paid', '2000-01-01'),
         ($2, $4, 5000, 'upi', 'paid', '2000-01-01'),
         ($2, $5, 5000, 'upi', 'failed', '2000-01-02')`,
      [paidAppointment, retriedAppointment, `paid-${paidAppointment}`, `old-${retriedAppointment}`, `new-${retriedAppointment}`],
    );
    const historyQuery = '/admin/appointments?filter=past&from=2000-01-02&to=2000-01-02';
    const firstPage = await request(app.getHttpServer()).get(historyQuery)
      .set('Authorization', `Bearer ${adminToken}`).expect(200);
    expect(firstPage.body).toMatchObject({ total: 25, page: 1, limit: 20, nextPage: 2,
      summary: { notCancelled: 20, completed: 10, cancelled: 5, paidAmountPaise: 10000 } });
    expect(firstPage.body.items).toHaveLength(20);
    expect(firstPage.body.items[0].date).toBe('2000-01-02');
    expect(firstPage.body.items[0].time).toBe('15:00:00');
    const secondPage = await request(app.getHttpServer()).get(`${historyQuery}&page=2`)
      .set('Authorization', `Bearer ${adminToken}`).expect(200);
    expect(secondPage.body).toMatchObject({ total: 25, page: 2, limit: 20, nextPage: null });
    expect(secondPage.body.items).toHaveLength(5);
    const ids = [...firstPage.body.items, ...secondPage.body.items].map(item => item.id);
    expect(new Set(ids).size).toBe(25);
    expect(secondPage.body.summary).toEqual(firstPage.body.summary);
    const largerPage = await request(app.getHttpServer()).get(`${historyQuery}&limit=50`)
      .set('Authorization', `Bearer ${adminToken}`).expect(200);
    expect(largerPage.body.items).toHaveLength(25);
    expect(largerPage.body).toMatchObject({ total: 25, limit: 50, nextPage: null });
    const completed = await request(app.getHttpServer()).get(`${historyQuery}&status=completed&type=clinic&limit=10`)
      .set('Authorization', `Bearer ${adminToken}`).expect(200);
    expect(completed.body.items).toHaveLength(10);
    expect(completed.body).toMatchObject({ total: 10, nextPage: null });
    const noVideo = await request(app.getHttpServer()).get(`${historyQuery}&type=video`)
      .set('Authorization', `Bearer ${adminToken}`).expect(200);
    expect(noVideo.body).toMatchObject({ total: 0, items: [], nextPage: null });
    const beyondLastPage = await request(app.getHttpServer()).get(`${historyQuery}&page=3`)
      .set('Authorization', `Bearer ${adminToken}`).expect(200);
    expect(beyondLastPage.body).toMatchObject({ total: 25, items: [], nextPage: null });
    const todayPage = await request(app.getHttpServer()).get('/admin/appointments?filter=today')
      .set('Authorization', `Bearer ${adminToken}`).expect(200);
    expect(todayPage.body.items).toHaveLength(20);
    expect(todayPage.body.total).toBeGreaterThanOrEqual(25);
    expect(todayPage.body.summary.completed).toBeGreaterThanOrEqual(10);
    expect(todayPage.body.summary.cancelled).toBeGreaterThanOrEqual(5);

    await request(app.getHttpServer()).get(historyQuery).set('Authorization', `Bearer ${patientToken}`).expect(403);

    await request(app.getHttpServer()).get('/admin/appointments').expect(401);
  });

  it('rejects invalid admin appointment filters, dates and page sizes', async () => {
    const token = await seedAdminToken();
    for (const query of [
      'page=0', 'page=-1', 'page=1.5', 'page=abc', 'limit=0', 'limit=101', 'limit=2.5',
      'filter=unknown', 'status=unknown', 'type=unknown', 'from=2026-02-30',
      'to=2026-01-01T12:00:00Z', 'from=2026-10-20&to=2026-10-01',
    ]) {
      await request(app.getHttpServer()).get(`/admin/appointments?${query}`)
        .set('Authorization', `Bearer ${token}`).expect(400);
    }
  });
});
