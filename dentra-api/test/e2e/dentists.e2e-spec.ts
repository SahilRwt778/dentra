import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { Pool } from 'pg';
import { AppModule } from '../../src/app.module';
import { HttpExceptionFilter } from '../../src/common/filters/http-exception.filter';

/**
 * Covers the dentist self-serve chain, including bugs this module
 * caught while being built: offersVideo=true with no hours set
 * violating schema.sql's dentists_video_hours CHECK, and time columns
 * coming back with seconds ("10:00:00") instead of the "HH:MM" every
 * DTO and spec example uses.
 */
describe('Dentists (e2e)', () => {
  let app: INestApplication;
  let pool: Pool;
  let logSpy: jest.SpyInstance;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
  });

  afterAll(async () => {
    await pool.end();
    await app.close();
  });

  function freshMobile(): string {
    const n = Math.floor(1_000_000_00 + Math.random() * 8_999_999_99);
    return `+9197${n}`;
  }

  async function verifiedDentistToken(mobile: string): Promise<string> {
    logSpy = jest.spyOn(console, 'log').mockImplementation();
    const req = await request(app.getHttpServer())
      .post('/auth/otp/request')
      .send({ mobile, purpose: 'dentist' })
      .expect(200);
    expect(req.body.isNewAccount).toBe(true); // the chicken-and-egg bug: this used to 404 instead

    const logged = logSpy.mock.calls.map((args) => String(args[0])).find((l) => l.includes(mobile));
    const code = /code=(\d{4})(?!\d)/.exec(logged ?? '')?.[1];
    logSpy.mockRestore();

    const verify = await request(app.getHttpServer())
      .post('/auth/otp/verify')
      .send({ otpId: req.body.otpId, code, deviceId: 'e2e-device' })
      .expect(200);
    return verify.body.accessToken;
  }

  async function approveFixture(token: string) {
    const { sub } = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
    await pool.query("update dentists set status = 'verified' where user_id = $1", [sub]);
  }

  it('submits an application with offersVideo and gets back clean HH:MM hours, not HH:MM:SS', async () => {
    const token = await verifiedDentistToken(freshMobile());

    const app201 = await request(app.getHttpServer())
      .post('/dentists/applications')
      .set('Authorization', `Bearer ${token}`)
      .send({
        fullName: 'E2E Dentist',
        qualification: 'BDS',
        specialization: 'General Dentist',
        councilRegNo: `E2E-${Date.now()}`,
        primaryClinicName: 'E2E Clinic',
        offersVideo: true,
        termsConsent: true,
        telemedicineConsent: true,
      })
      .expect(201);

    expect(app201.body.videoHoursFrom).toMatch(/^\d{2}:\d{2}$/);
    expect(app201.body.clinics[0].hoursFrom).toMatch(/^\d{2}:\d{2}$/);

    await request(app.getHttpServer())
      .post('/dentists/applications')
      .set('Authorization', `Bearer ${token}`)
      .send({
        fullName: 'Again',
        qualification: 'BDS',
        specialization: 'General Dentist',
        councilRegNo: 'whatever',
        primaryClinicName: 'x',
        termsConsent: true,
        telemedicineConsent: true,
      })
      .expect(409);
  });

  it('refuses a clinic whose hours leave zero slots', async () => {
    const token = await verifiedDentistToken(freshMobile());
    await request(app.getHttpServer())
      .post('/dentists/applications')
      .set('Authorization', `Bearer ${token}`)
      .send({
        fullName: 'E2E Dentist 2',
        qualification: 'BDS',
        specialization: 'General Dentist',
        councilRegNo: `E2E-${Date.now()}`,
        primaryClinicName: 'E2E Clinic 2',
        termsConsent: true,
        telemedicineConsent: true,
      })
      .expect(201);

    await approveFixture(token);

    await request(app.getHttpServer())
      .post('/dentists/me/clinics')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Too short', hoursFrom: '10:00', hoursTo: '10:05' }) // shorter than SLOT_MINUTES (slots.util.ts)
      .expect(422);
  });

  it('hides a pending dentist from public search and 404s their profile, then shows them once verified', async () => {
    const mobile = freshMobile();
    const token = await verifiedDentistToken(mobile);
    const created = await request(app.getHttpServer())
      .post('/dentists/applications')
      .set('Authorization', `Bearer ${token}`)
      .send({
        fullName: 'Dr Hidden Until Verified',
        qualification: 'BDS',
        specialization: 'Orthodontist',
        councilRegNo: `E2E-${Date.now()}`,
        primaryClinicName: 'Hidden Clinic',
        termsConsent: true,
        telemedicineConsent: true,
      })
      .expect(201);
    const dentistId = created.body.id;

    await request(app.getHttpServer()).get(`/dentists/${dentistId}`).expect(404);

    await pool.query("update dentists set status = 'verified' where user_id = $1", [dentistId]);

    const publicProfile = await request(app.getHttpServer()).get(`/dentists/${dentistId}`).expect(200);
    expect(publicProfile.body.fullName).toBe('Dr Hidden Until Verified');

    const slots = await request(app.getHttpServer())
      .get(`/dentists/${dentistId}/slots`)
      .query({ date: '2026-12-01', type: 'clinic' })
      .expect(200);
    expect(slots.body.slots.length).toBeGreaterThan(0);
    expect(slots.body.slots[0]).toMatch(/^\d{2}:\d{2}$/);

    await request(app.getHttpServer())
      .get(`/dentists/${dentistId}/slots`)
      .query({ date: '2026-12-01', type: 'video' })
      .expect(400);
  });

  it('refuses to remove a dentist\'s only clinic when video is not offered', async () => {
    const token = await verifiedDentistToken(freshMobile());
    await request(app.getHttpServer())
      .post('/dentists/applications')
      .set('Authorization', `Bearer ${token}`)
      .send({
        fullName: 'Single Clinic Dentist',
        qualification: 'BDS',
        specialization: 'General Dentist',
        councilRegNo: `E2E-${Date.now()}`,
        primaryClinicName: 'Only Clinic',
        offersVideo: false,
        termsConsent: true,
        telemedicineConsent: true,
      })
      .expect(201);

    await approveFixture(token);

    const clinics = await request(app.getHttpServer())
      .get('/dentists/me/clinics')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    await request(app.getHttpServer())
      .delete(`/dentists/me/clinics/${clinics.body[0].id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(409);
  });

  it('finds a verified dentist through public search by specialization, but not by an unrelated one', async () => {
    const token = await verifiedDentistToken(freshMobile());
    const uniqueSpecialization = `E2E-Searchable-${Date.now()}`;
    const created = await request(app.getHttpServer())
      .post('/dentists/applications')
      .set('Authorization', `Bearer ${token}`)
      .send({
        fullName: 'Searchable Dentist',
        qualification: 'BDS',
        specialization: uniqueSpecialization,
        councilRegNo: `E2E-${Date.now()}`,
        primaryClinicName: 'Searchable Clinic',
        termsConsent: true,
        telemedicineConsent: true,
      })
      .expect(201);
    await pool.query("update dentists set status = 'verified' where user_id = $1", [created.body.id]);

    const matching = await request(app.getHttpServer())
      .get('/dentists')
      .query({ specialization: uniqueSpecialization })
      .expect(200);
    expect(matching.body.items.map((d: { id: string }) => d.id)).toContain(created.body.id);

    const nonMatching = await request(app.getHttpServer())
      .get('/dentists')
      .query({ specialization: `No-Such-Specialization-${Date.now()}` })
      .expect(200);
    expect(nonMatching.body.items).toHaveLength(0);
  });

  it('lets a dentist read and update their own profile and a specific clinic', async () => {
    const token = await verifiedDentistToken(freshMobile());
    const created = await request(app.getHttpServer())
      .post('/dentists/applications')
      .set('Authorization', `Bearer ${token}`)
      .send({
        fullName: 'Self Update Dentist',
        qualification: 'BDS',
        specialization: 'General Dentist',
        councilRegNo: `E2E-${Date.now()}`,
        primaryClinicName: 'Self Update Clinic',
        termsConsent: true,
        telemedicineConsent: true,
      })
      .expect(201);

    await approveFixture(token);

    const me = await request(app.getHttpServer())
      .get('/dentists/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(me.body.id).toBe(created.body.id);

    const updated = await request(app.getHttpServer())
      .patch('/dentists/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ specialization: 'Updated Specialization', qualification: 'MDS' })
      .expect(200);
    expect(updated.body.specialization).toBe('Updated Specialization');
    expect(updated.body.qualification).toBe('MDS');

    const clinics = await request(app.getHttpServer())
      .get('/dentists/me/clinics')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const updatedClinic = await request(app.getHttpServer())
      .patch(`/dentists/me/clinics/${clinics.body[0].id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Renamed Clinic', hoursFrom: '09:00', hoursTo: '17:00' })
      .expect(200);
    expect(updatedClinic.body.name).toBe('Renamed Clinic');

    await request(app.getHttpServer())
      .patch(`/dentists/me/clinics/${clinics.body[0].id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Too short', hoursFrom: '09:00', hoursTo: '09:05' }) // shorter than SLOT_MINUTES (slots.util.ts)
      .expect(422);
  });

  it('removes a clinic (204) when video consults cover the dentist, even if it was the only location', async () => {
    const token = await verifiedDentistToken(freshMobile());
    await request(app.getHttpServer())
      .post('/dentists/applications')
      .set('Authorization', `Bearer ${token}`)
      .send({
        fullName: 'Video Covered Dentist',
        qualification: 'BDS',
        specialization: 'General Dentist',
        councilRegNo: `E2E-${Date.now()}`,
        primaryClinicName: 'Removable Clinic',
        offersVideo: true,
        termsConsent: true,
        telemedicineConsent: true,
      })
      .expect(201);

    await approveFixture(token);

    const clinics = await request(app.getHttpServer())
      .get('/dentists/me/clinics')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    await request(app.getHttpServer())
      .delete(`/dentists/me/clinics/${clinics.body[0].id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(204);

    const remaining = await request(app.getHttpServer())
      .get('/dentists/me/clinics')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(remaining.body).toHaveLength(0);
  });

  it('uploads and replaces a KYC document, and a dentist cannot upload to another one\'s application', async () => {
    const token = await verifiedDentistToken(freshMobile());
    const created = await request(app.getHttpServer())
      .post('/dentists/applications')
      .set('Authorization', `Bearer ${token}`)
      .send({
        fullName: 'Document Upload Dentist',
        qualification: 'BDS',
        specialization: 'General Dentist',
        councilRegNo: `E2E-${Date.now()}`,
        primaryClinicName: 'Document Clinic',
        termsConsent: true,
        telemedicineConsent: true,
      })
      .expect(201);
    const dentistId = created.body.id;

    const uploaded = await request(app.getHttpServer())
      .post(`/dentists/applications/${dentistId}/documents`)
      .set('Authorization', `Bearer ${token}`)
      .field('docType', 'degree')
      .attach('file', Buffer.from('%PDF-1.4\nSynthetic degree certificate\n%%EOF'), 'degree.pdf')
      .expect(201);
    expect(uploaded.body.docType).toBe('degree');
    expect(uploaded.body.fileUrl).toBeTruthy();
    expect(uploaded.body.verifiedAt).toBeNull();

    // Re-upload keeps the document row and authenticated URL stable,
    // while the storage adapter replaces the underlying private object.
    const corrected = '%PDF-1.4\nSynthetic corrected degree certificate\n%%EOF';
    const reuploaded = await request(app.getHttpServer())
      .post(`/dentists/applications/${dentistId}/documents`)
      .set('Authorization', `Bearer ${token}`)
      .field('docType', 'degree')
      .attach('file', Buffer.from(corrected), 'degree-v2.pdf')
      .expect(201);
    expect(reuploaded.body.id).toBe(uploaded.body.id);
    expect(reuploaded.body.fileUrl).toBe(uploaded.body.fileUrl);

    // fileUrl is the authenticated download route, not a disk path or a
    // static asset URL — fetching it is how we confirm the re-upload
    // actually replaced the stored bytes, not just the DB row.
    const downloaded = await request(app.getHttpServer())
      .get(reuploaded.body.fileUrl)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    // Binary content type (application/pdf) — superagent buffers it into
    // .body as a raw Buffer rather than parsing it as .text.
    expect(Buffer.from(downloaded.body).toString()).toBe(corrected);
    expect(downloaded.headers['content-type']).toBe('application/pdf');

    const otherDentistToken = await verifiedDentistToken(freshMobile());
    await request(app.getHttpServer())
      .get(reuploaded.body.fileUrl)
      .set('Authorization', `Bearer ${otherDentistToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .get(`/dentists/applications/${dentistId}/documents/00000000-0000-0000-0000-000000000000`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404);

    await request(app.getHttpServer())
      .post(`/dentists/applications/${dentistId}/documents`)
      .set('Authorization', `Bearer ${token}`)
      .field('docType', 'not-a-real-doc-type')
      .attach('file', Buffer.from('x'), 'x.pdf')
      .expect(400);

    await request(app.getHttpServer())
      .post(`/dentists/applications/${dentistId}/documents`)
      .set('Authorization', `Bearer ${token}`)
      .field('docType', 'selfie')
      .expect(400); // no file attached

    const otherToken = await verifiedDentistToken(freshMobile());
    await request(app.getHttpServer())
      .post(`/dentists/applications/${dentistId}/documents`)
      .set('Authorization', `Bearer ${otherToken}`)
      .field('docType', 'selfie')
      .attach('file', Buffer.from('x'), 'x.pdf')
      .expect(403);
  });
});
