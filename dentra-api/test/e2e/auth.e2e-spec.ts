import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { HttpExceptionFilter } from '../../src/common/filters/http-exception.filter';
import type { Pool } from 'pg';
import { PG_POOL } from '../../src/database/database.module';
import * as otpUtils from '../../src/common/utils/otp-hash.util';

describe('Auth: four-digit OTP, refresh and logout (e2e)', () => {
  let app: INestApplication;
  let pool: Pool;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
    pool = moduleRef.get(PG_POOL);
  });

  afterAll(async () => {
    await app.close();
  });

  function freshMobile(): string {
    const n = Math.floor(1_000_000_00 + Math.random() * 8_999_999_99);
    return `+9199${n}`;
  }

  async function requestCode(mobile = freshMobile(), forcedCode?: string, purpose: 'patient' | 'dentist' = 'patient') {
    const logSpy = jest.spyOn(console, 'log').mockImplementation();
    const generator = forcedCode ? jest.spyOn(otpUtils, 'generateOtpCode').mockReturnValue(forcedCode) : undefined;
    try {
      const req = await request(app.getHttpServer())
        .post('/auth/otp/request')
        .send({ mobile, purpose })
        .expect(200);
      const logged = logSpy.mock.calls.map((a) => String(a[0])).find((line) => line.includes(mobile));
      const code = /code=(\d{4})(?!\d)/.exec(logged ?? '')?.[1];
      expect(code).toMatch(/^\d{4}$/);
      return { otpId: req.body.otpId as string, code: code!, mobile };
    } finally {
      generator?.mockRestore();
      logSpy.mockRestore();
    }
  }

  async function verifiedTokens(mobile: string, purpose: 'patient' | 'dentist' = 'patient') {
    const { otpId, code } = await requestCode(mobile, undefined, purpose);
    const verify = await request(app.getHttpServer())
      .post('/auth/otp/verify')
      .send({ otpId, code, deviceId: 'e2e-auth' })
      .expect(200);
    return verify.body as { accessToken: string; refreshToken: string; isNewAccount: boolean };
  }

  function claims(token: string): { sub: string; role: string } {
    return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
  }

  it.each(['patient', 'dentist'] as const)('keeps an existing %s profile while signing up the other role with the same mobile', async (existingRole) => {
    const mobile = freshMobile();
    const newRole = existingRole === 'patient' ? 'dentist' : 'patient';
    const { rows } = await pool.query('insert into users (mobile, role) values ($1, $2) returning id', [mobile, existingRole]);
    const existingId = rows[0].id;
    if (existingRole === 'patient') {
      await pool.query("insert into patients (user_id, full_name, date_of_birth) values ($1, 'Existing Patient', '1990-01-01')", [existingId]);
    } else {
      await pool.query(`insert into dentists (user_id, full_name, qualification, specialization, council_reg_no, status)
        values ($1, 'Existing Dentist', 'BDS', 'General Dentist', 'ROLE-TEST', 'verified')`, [existingId]);
    }

    const newAccount = await verifiedTokens(mobile, newRole);
    expect(newAccount.isNewAccount).toBe(true);
    expect(claims(newAccount.accessToken).role).toBe(newRole);
    expect(claims(newAccount.accessToken).sub).not.toBe(existingId);
    await request(app.getHttpServer()).get(existingRole === 'patient' ? '/patients/me' : '/dentists/me')
      .set('Authorization', `Bearer ${newAccount.accessToken}`).expect(403);
    await request(app.getHttpServer()).get(newRole === 'patient' ? '/patients/me' : '/dentists/me')
      .set('Authorization', `Bearer ${newAccount.accessToken}`).expect(404);

    // Simulate waiting out resend cooldown; keep normal OTP verification for both roles.
    await pool.query("update otp_codes set created_at = now() - interval '1 minute' where mobile = $1", [mobile]);
    const returning = await verifiedTokens(mobile, existingRole);
    expect(returning.isNewAccount).toBe(false);
    expect(claims(returning.accessToken)).toEqual(expect.objectContaining({ sub: existingId, role: existingRole }));
    await request(app.getHttpServer()).get(existingRole === 'patient' ? '/patients/me' : '/dentists/me')
      .set('Authorization', `Bearer ${returning.accessToken}`).expect(200);
    const identities = await pool.query('select role from users where mobile = $1 order by role::text', [mobile]);
    expect(identities.rows.map((row) => row.role)).toEqual(['dentist', 'patient']);
    await expect(pool.query('insert into users (mobile, role) values ($1, $2)', [mobile, existingRole]))
      .rejects.toMatchObject({ code: '23505' });
  });

  it('reuses one account when separate OTP challenges for the same mobile and role are verified concurrently', async () => {
    const mobile = freshMobile();
    const first = await requestCode(mobile);
    await pool.query("update otp_codes set created_at = now() - interval '1 minute' where id = $1", [first.otpId]);
    const second = await requestCode(mobile);
    const responses = await Promise.all([first, second].map(({ otpId, code }, index) =>
      request(app.getHttpServer()).post('/auth/otp/verify').send({ otpId, code, deviceId: `same-role-${index}` }),
    ));
    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    const firstUser = claims(responses[0].body.accessToken);
    expect(firstUser.role).toBe('patient');
    expect(claims(responses[1].body.accessToken).sub).toBe(firstUser.sub);
    const identities = await pool.query('select id from users where mobile = $1 and role = $2', [mobile, 'patient']);
    expect(identities.rows).toEqual([{ id: firstUser.sub }]);
  });

  it('rotates the refresh token on use and revokes the one it replaced', async () => {
    const first = await verifiedTokens(freshMobile());

    const rotated = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: first.refreshToken })
      .expect(200);
    // Not asserting the access token differs from the original: its
    // payload is just {sub, role} with a whole-second iat, so two
    // issued within the same second are byte-identical — expected, not
    // a bug. The refresh token is the one that actually has to rotate.
    expect(rotated.body.refreshToken).not.toBe(first.refreshToken);

    // The token just rotated away from no longer works — rotation, not reuse.
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: first.refreshToken })
      .expect(401);

    // But the freshly-issued one does.
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: rotated.body.refreshToken })
      .expect(200);
  });

  it('rejects a malformed or unknown refresh token', async () => {
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: 'not-a-real-token' })
      .expect(401);
  });

  it('rejects the former 1111 bypass, records a failed attempt, and still accepts the generated code once', async () => {
    const { otpId, code } = await requestCode(freshMobile(), '4826');
    await request(app.getHttpServer())
      .post('/auth/otp/verify')
      .send({ otpId, code: '1111', deviceId: 'e2e-auth' })
      .expect(401);
    const attempt = await pool.query('select attempts, consumed_at from otp_codes where id = $1', [otpId]);
    expect(attempt.rows[0].attempts).toBe(1);
    expect(attempt.rows[0].consumed_at).toBeNull();
    await request(app.getHttpServer())
      .post('/auth/otp/verify')
      .send({ otpId, code, deviceId: 'e2e-auth' })
      .expect(200);
    await request(app.getHttpServer())
      .post('/auth/otp/verify')
      .send({ otpId, code, deviceId: 'e2e-auth' })
      .expect(401);
  });

  it.each(['0123', '1111'])('accepts %s only when it is the generated code and refuses replay', async (code) => {
    const { otpId } = await requestCode(freshMobile(), code);
    const verified = await request(app.getHttpServer())
      .post('/auth/otp/verify')
      .send({ otpId, code, deviceId: 'e2e-auth' })
      .expect(200);
    expect(verified.body.accessToken).toBeTruthy();
    await request(app.getHttpServer()).post('/auth/otp/verify')
      .send({ otpId, code, deviceId: 'e2e-auth' }).expect(401);
  });

  it.each(['123', '12345', '123456', '12a4', 1111])('rejects a code that is not a four-digit string: %s', async (code) => {
    const { otpId } = await requestCode();
    await request(app.getHttpServer())
      .post('/auth/otp/verify')
      .send({ otpId, code, deviceId: 'e2e-auth' })
      .expect(400);
  });

  it('refuses expired codes, including 1111 even when it was genuinely generated', async () => {
    const { otpId, code } = await requestCode(freshMobile(), '1111');
    await pool.query("update otp_codes set expires_at = now() - interval '1 second' where id = $1", [otpId]);
    await request(app.getHttpServer()).post('/auth/otp/verify')
      .send({ otpId, code, deviceId: 'e2e-auth' }).expect(410);
  });

  it('locks after five incorrect attempts and refuses the correct code after lockout', async () => {
    const { otpId, code } = await requestCode(freshMobile(), '1111');
    for (let i = 0; i < 5; i++) {
      await request(app.getHttpServer()).post('/auth/otp/verify')
        .send({ otpId, code: '4826', deviceId: 'e2e-auth' }).expect(i === 4 ? 423 : 401);
    }
    await request(app.getHttpServer()).post('/auth/otp/verify')
      .send({ otpId, code, deviceId: 'e2e-auth' }).expect(423);
    const attempts = await pool.query('select attempts from otp_codes where id = $1', [otpId]);
    expect(attempts.rows[0].attempts).toBe(5);
  });

  it('allows only one of two concurrent requests to consume the same code', async () => {
    const { otpId, code } = await requestCode();
    const responses = await Promise.all(['first-device', 'second-device'].map((deviceId) =>
      request(app.getHttpServer()).post('/auth/otp/verify').send({ otpId, code, deviceId }),
    ));
    expect(responses.map((response) => response.status).sort()).toEqual([200, 401]);
  });

  it('logs out and revokes the refresh token so it can no longer be used', async () => {
    const tokens = await verifiedTokens(freshMobile());

    // Logout isn't @Public() — it needs a valid access token too, even
    // though the body's refreshToken is what actually gets revoked (the
    // access token alone can't identify which device's session to end).
    await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Authorization', `Bearer ${tokens.accessToken}`)
      .send({ refreshToken: tokens.refreshToken })
      .expect(204);

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: tokens.refreshToken })
      .expect(401);
  });
});
