import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { Pool } from 'pg';
import { AppModule } from '../../src/app.module';
import { HttpExceptionFilter } from '../../src/common/filters/http-exception.filter';
import { hashPassword } from '../../src/common/utils/password.util';

/**
 * POST /auth/admin/login — email + password, the one auth path that
 * isn't OTP-over-SMS. There's no self-serve admin signup (see
 * scripts/create-admin.ts), so the account here is seeded the same way
 * ops would seed the first real one: a bcrypt hash written straight to
 * the users table.
 */
describe('Auth: admin email+password login (e2e)', () => {
  let app: INestApplication;
  let pool: Pool;

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

  async function seedAdmin(email: string, password: string, status = 'active') {
    const passwordHash = await hashPassword(password);
    await pool.query(`insert into users (role, email, password_hash, status) values ('admin', $1, $2, $3)`, [
      email,
      passwordHash,
      status,
    ]);
  }

  it('logs in with the right password, and the token works on an admin route', async () => {
    const email = `admin-login-${Date.now()}@dentra.test`;
    await seedAdmin(email, 'correct-password');

    const login = await request(app.getHttpServer())
      .post('/auth/admin/login')
      .send({ email, password: 'correct-password' })
      .expect(200);
    expect(login.body.accessToken).toBeTruthy();
    expect(login.body.refreshToken).toBeTruthy();

    await request(app.getHttpServer())
      .get('/admin/dentists')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(200);
  });

  it('rejects a wrong password and an unknown email, both with the same 401', async () => {
    const email = `admin-login-${Date.now()}@dentra.test`;
    await seedAdmin(email, 'correct-password');

    await request(app.getHttpServer())
      .post('/auth/admin/login')
      .send({ email, password: 'wrong-password' })
      .expect(401);

    await request(app.getHttpServer())
      .post('/auth/admin/login')
      .send({ email: 'nobody@dentra.test', password: 'whatever' })
      .expect(401);
  });

  it('rejects a locked admin account even with the right password', async () => {
    const email = `admin-login-${Date.now()}@dentra.test`;
    await seedAdmin(email, 'correct-password', 'locked');

    await request(app.getHttpServer())
      .post('/auth/admin/login')
      .send({ email, password: 'correct-password' })
      .expect(401);
  });
  it('keeps independent admin browser sessions refreshable and revokes only the logged-out family', async () => {
    const email = `admin-browsers-${Date.now()}@dentra.test`;
    await seedAdmin(email, 'correct-password');
    const login = (deviceId: string) => request(app.getHttpServer()).post('/auth/admin/login')
      .send({ email, password: 'correct-password', deviceId });
    const first = await login('admin-browser-a').expect(200);
    const second = await login('admin-browser-b').expect(200);
    const refresh = (refreshToken: string) => request(app.getHttpServer()).post('/auth/refresh').send({ refreshToken });
    const nextFirst = await refresh(first.body.refreshToken).expect(200);
    const nextSecond = await refresh(second.body.refreshToken).expect(200);
    await refresh(first.body.refreshToken).expect(401);
    await request(app.getHttpServer()).post('/auth/logout').send({ refreshToken: nextFirst.body.refreshToken }).expect(204);
    await refresh(nextFirst.body.refreshToken).expect(401);
    const stillSignedIn = await refresh(nextSecond.body.refreshToken).expect(200);
    await request(app.getHttpServer()).get('/admin/me').set('Authorization', `Bearer ${stillSignedIn.body.accessToken}`).expect(200);
  });

});
