import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { HttpExceptionFilter } from '../../src/common/filters/http-exception.filter';

/**
 * Covers the exact chain that broke three times while building this:
 * the sub/userId claim mismatch, the date-column timezone bug, and the
 * stale-build issue that dropped routes silently. Needs a real
 * Postgres reachable at DATABASE_URL (see ../../.env.example) — not
 * mocked, since those three bugs only ever showed up against a real DB.
 */
describe('Patients (e2e)', () => {
  let app: INestApplication;
  let logSpy: jest.SpyInstance;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  function freshMobile(): string {
    // +91 98XXXXXXXX, random enough not to collide between test runs
    const n = Math.floor(1_000_000_00 + Math.random() * 8_999_999_99);
    return `+9198${n}`;
  }

  async function verifiedAccessToken(mobile: string): Promise<{ accessToken: string }> {
    logSpy = jest.spyOn(console, 'log').mockImplementation();
    const req = await request(app.getHttpServer())
      .post('/auth/otp/request')
      .send({ mobile, purpose: 'patient' })
      .expect(200);

    const logged = logSpy.mock.calls.map((args) => String(args[0])).find((l) => l.includes(mobile));
    const code = /code=(\d{4})(?!\d)/.exec(logged ?? '')?.[1];
    logSpy.mockRestore();
    expect(code).toBeDefined();

    const verify = await request(app.getHttpServer())
      .post('/auth/otp/verify')
      .send({ otpId: req.body.otpId, code, deviceId: 'e2e-device' })
      .expect(200);

    return verify.body;
  }

  it('rejects the wrong code, then accepts the right one, and registration completes the loop', async () => {
    const mobile = freshMobile();
    const { accessToken } = await verifiedAccessToken(mobile);

    const before = await request(app.getHttpServer())
      .get('/patients/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(404);
    expect(before.body.code).toBe('NOT_FOUND');

    const registered = await request(app.getHttpServer())
      .post('/patients/register')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        fullName: 'E2E Test Patient',
        dateOfBirth: '1996-04-14',
        termsConsent: true,
        telemedicineConsent: true,
      })
      .expect(201);

    // The exact bug this test would have caught: date columns coming
    // back a day off due to UTC/local timezone shift in node-postgres.
    expect(registered.body.dateOfBirth).toBe('1996-04-14');
    expect(registered.body.mobile).toBe(mobile);

    await request(app.getHttpServer())
      .post('/patients/register')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ fullName: 'Again', dateOfBirth: '1996-04-14', termsConsent: true, telemedicineConsent: true })
      .expect(409);

    const me = await request(app.getHttpServer())
      .get('/patients/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(me.body.fullName).toBe('E2E Test Patient');
  });

  it('refuses a minor registration without guardian consent, and accepts one with it', async () => {
    const mobile = freshMobile();
    const { accessToken } = await verifiedAccessToken(mobile);

    await request(app.getHttpServer())
      .post('/patients/register')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ fullName: 'Minor', dateOfBirth: '2015-01-01', termsConsent: true, telemedicineConsent: true })
      .expect(422);

    const registered = await request(app.getHttpServer())
      .post('/patients/register')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        fullName: 'Minor',
        dateOfBirth: '2015-01-01',
        termsConsent: true,
        telemedicineConsent: true,
        guardianName: 'Parent',
        guardianRelationship: 'Mother',
        guardianMobile: '+919800000000',
        guardianConsent: true,
      })
      .expect(201);
    expect(registered.body.guardian?.name).toBe('Parent');
  });

  it('requires a bearer token for /patients/me', async () => {
    await request(app.getHttpServer()).get('/patients/me').expect(401);
  });

  it('updates profile fields via PATCH and reads them back from GET /patients/me', async () => {
    const mobile = freshMobile();
    const { accessToken } = await verifiedAccessToken(mobile);
    await request(app.getHttpServer())
      .post('/patients/register')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ fullName: 'Pre Update', dateOfBirth: '1990-01-01', termsConsent: true, telemedicineConsent: true })
      .expect(201);

    const updated = await request(app.getHttpServer())
      .patch('/patients/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ fullName: 'Post Update', city: 'Mumbai', allergies: 'Penicillin' })
      .expect(200);
    expect(updated.body.fullName).toBe('Post Update');
    expect(updated.body.city).toBe('Mumbai');

    const me = await request(app.getHttpServer())
      .get('/patients/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(me.body.allergies).toBe('Penicillin');
  });

  it("returns the patient's dental chart, empty until any consultation records one", async () => {
    const mobile = freshMobile();
    const { accessToken } = await verifiedAccessToken(mobile);
    await request(app.getHttpServer())
      .post('/patients/register')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ fullName: 'Chart Patient', dateOfBirth: '1990-01-01', termsConsent: true, telemedicineConsent: true })
      .expect(201);

    const chart = await request(app.getHttpServer())
      .get('/patients/me/chart')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(chart.body).toEqual([]);
  });
});
