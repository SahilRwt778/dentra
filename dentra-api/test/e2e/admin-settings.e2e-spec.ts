import { ConflictException, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import * as request from 'supertest';
import { randomInt, randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { AppModule } from '../../src/app.module';
import { HttpExceptionFilter } from '../../src/common/filters/http-exception.filter';
import { hashPassword } from '../../src/common/utils/password.util';
import { AuditService } from '../../src/modules/admin/audit/audit.service';

describe('Admin profile and platform settings (e2e)', () => {
  let app: INestApplication, pool: Pool, jwt: JwtService, passwordHash: string;
  const password = 'Settings-fixture-password';
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    jwt = app.get(JwtService);
    passwordHash = await hashPassword(password);
  });
  afterAll(async () => {
    await pool.end();
    await app.close();
  });
  type Admin = { id: string; email: string; token: string };
  async function admin(status = 'active'): Promise<Admin> {
    const id = randomUUID(),
      email = `settings-${id}@example.test`;
    await pool.query(
      "insert into users (id, role, email, password_hash, status) values ($1,'admin',$2,$3,$4)",
      [id, email, passwordHash, status],
    );
    return { id, email, token: jwt.sign({ sub: id, role: 'admin' }) };
  }
  const get = (actor: Admin, path = '/admin/me') =>
    request(app.getHttpServer()).get(path).set('Authorization', `Bearer ${actor.token}`);
  const patch = (actor: Admin, body: object, path = '/admin/me') =>
    request(app.getHttpServer()).patch(path).set('Authorization', `Bearer ${actor.token}`).send(body);
  const logs = (id: string) =>
    pool.query('select * from audit_log where entity_id = $1 order by created_at', [id]);

  it('requires an active admin on every settings endpoint', async () => {
    for (const path of ['/admin/me', '/admin/settings']) {
      await request(app.getHttpServer()).get(path).expect(401);
      await request(app.getHttpServer()).patch(path).send({ version: 1, name: 'Forbidden' }).expect(401);
      for (const role of ['patient', 'dentist']) {
        const token = jwt.sign({ sub: randomUUID(), role });
        await request(app.getHttpServer()).get(path).set('Authorization', `Bearer ${token}`).expect(403);
        await request(app.getHttpServer())
          .patch(path)
          .set('Authorization', `Bearer ${token}`)
          .send({ version: 1, name: 'Forbidden' })
          .expect(403);
      }
      const locked = await admin('locked');
      await get(locked, path).expect(403);
      await patch(locked, { version: 1, name: 'Forbidden' }, path).expect(403);
    }
  });
  it('reads the actual signed-in email and persisted platform defaults without exposing credentials', async () => {
    const actor = await admin();
    const profile = await get(actor).expect(200);
    expect(profile.headers['cache-control']).toBe('no-store');
    expect(profile.body).toMatchObject({
      id: actor.id,
      email: actor.email,
      name: 'Dentra admin',
      phone: null,
      version: 0,
    });
    expect(profile.body.passwordHash).toBeUndefined();
    expect(JSON.stringify(profile.body)).not.toContain(passwordHash);
    const platform = await get(actor, '/admin/settings').expect(200);
    expect(platform.body).toMatchObject({
      name: 'Dentra',
      region: 'Delhi NCR',
      supportEmail: 'support@dentra.in',
      version: 1,
    });
    expect((await logs(actor.id)).rows).toHaveLength(0);
  });
  it('persists profile edits across fresh reads and keeps another admin unchanged', async () => {
    const actor = await admin(),
      other = await admin();
    const mobile = `${randomInt(6000000000, 9999999999)}`;
    const response = await patch(actor, { version: 0, name: '  Test admin  ', phone: mobile }).expect(200);
    expect(response.body).toMatchObject({
      name: 'Test admin',
      phone: `+91${mobile}`,
      email: actor.email,
      version: 1,
    });
    expect((await get(actor).expect(200)).body).toEqual(response.body);
    expect((await get(other).expect(200)).body).toMatchObject({
      email: other.email,
      phone: null,
      version: 0,
    });
    const audit = (await logs(actor.id)).rows;
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({
      actor_user_id: actor.id,
      entity_type: 'admin',
      action: 'admin_profile_updated',
    });
    expect(audit[0].after_state).toMatchObject({ name: 'Test admin', phone: `+91${mobile}` });
    expect(JSON.stringify(audit)).not.toContain(passwordHash);
    await patch(actor, { version: 1, phone: '' }).expect(200);
    expect((await get(actor).expect(200)).body.phone).toBeNull();
  });
  it('requires the current password for login-email changes and uses the saved email on the next login', async () => {
    const actor = await admin(),
      email = `updated-${randomUUID()}@example.test`;
    await patch(actor, { version: 0, email }).expect(400);
    await patch(actor, { version: 0, email, currentPassword: 'wrong-password' }).expect(403);
    expect((await get(actor).expect(200)).body.email).toBe(actor.email);
    const updated = await patch(actor, {
      version: 0,
      email: ` ${email.toUpperCase()} `,
      currentPassword: password,
    }).expect(200);
    expect(updated.body.email).toBe(email);
    await request(app.getHttpServer())
      .post('/auth/admin/login')
      .send({ email: actor.email, password })
      .expect(401);
    const login = await request(app.getHttpServer())
      .post('/auth/admin/login')
      .send({ email, password })
      .expect(200);
    expect(jwt.verify(login.body.accessToken).sub).toBe(actor.id);
    expect(JSON.stringify((await logs(actor.id)).rows)).not.toContain(password);
    expect(updated.body.currentPassword).toBeUndefined();
  });
  it('returns a conflict for duplicate login email or admin contact number without changing either account', async () => {
    const actor = await admin(),
      other = await admin();
    const mobile = `+91${randomInt(6000000000, 9999999999)}`;
    await pool.query('update users set mobile = $2 where id = $1', [other.id, mobile]);
    await patch(actor, { version: 0, email: other.email.toUpperCase(), currentPassword: password }).expect(
      409,
    );
    await patch(actor, { version: 0, phone: mobile }).expect(409);
    expect((await get(actor).expect(200)).body).toMatchObject({
      email: actor.email,
      phone: null,
      version: 0,
    });
    expect((await logs(actor.id)).rows).toHaveLength(0);
  });
  it('validates settings and rejects attempts to edit another account or privileged fields', async () => {
    const actor = await admin();
    const invalidProfiles: object[] = [
      { name: '' },
      { name: null },
      { email: null },
      { email: 'invalid' },
      { phone: 'abc' },
      { phone: 1234567890 },
      { id: randomUUID(), name: 'Spoofed' },
      { role: 'patient' },
      { status: 'deleted' },
      { passwordHash: 'anything' },
      { name: 'x'.repeat(101) },
    ];
    for (const body of invalidProfiles) await patch(actor, { version: 0, ...body }).expect(400);
    await patch(actor, { name: 'Missing version' }).expect(400);
    await patch(actor, { version: 0 }).expect(400);
    for (const body of [
      { name: ' ' },
      { region: null },
      { supportEmail: 'invalid' },
      { version: 0, name: 'Invalid' },
      { unknown: 'value' },
    ]) {
      await patch(actor, { version: 1, ...body }, '/admin/settings').expect(400);
    }
    expect((await get(actor).expect(200)).body.version).toBe(0);
  });
  it('prevents stale and concurrent profile saves from overwriting newer edits', async () => {
    const actor = await admin();
    const results = await Promise.all([
      patch(actor, { version: 0, name: 'First' }),
      patch(actor, { version: 0, name: 'Second' }),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual([200, 409]);
    expect((await get(actor).expect(200)).body.version).toBe(1);
    expect((await logs(actor.id)).rows).toHaveLength(1);
  });
  it('persists shared platform settings, normalizes fields and audits the change', async () => {
    const actor = await admin(),
      other = await admin();
    const before = (await get(actor, '/admin/settings').expect(200)).body;
    const saved = await patch(
      actor,
      {
        version: before.version,
        name: '  Dentra care  ',
        region: '  Mumbai  ',
        supportEmail: ' CARE@EXAMPLE.TEST ',
      },
      '/admin/settings',
    ).expect(200);
    expect(saved.body).toMatchObject({
      name: 'Dentra care',
      region: 'Mumbai',
      supportEmail: 'care@example.test',
      version: before.version + 1,
    });
    expect((await get(other, '/admin/settings').expect(200)).body).toEqual(saved.body);
    const audit = (await logs(before.id)).rows;
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ action: 'platform_settings_updated', actor_user_id: actor.id });
    expect(audit[0].before_state).toEqual(before);
    expect(audit[0].after_state).toEqual(saved.body);
  });
  it('prevents two admins from silently overwriting each other’s platform edits', async () => {
    const first = await admin(),
      second = await admin();
    const before = (await get(first, '/admin/settings').expect(200)).body;
    const results = await Promise.all([
      patch(first, { version: before.version, region: 'First region' }, '/admin/settings'),
      patch(second, { version: before.version, region: 'Second region' }, '/admin/settings'),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual([200, 409]);
    expect((await get(first, '/admin/settings').expect(200)).body.version).toBe(before.version + 1);
  });
  it('rolls profile and platform changes back if their audit write fails', async () => {
    const actor = await admin(),
      audit = app.get(AuditService),
      original = audit.log.bind(audit);
    for (const path of ['/admin/me', '/admin/settings']) {
      const before = (await get(actor, path).expect(200)).body;
      const countBefore = (await logs(before.id)).rows.length;
      const failure = jest.spyOn(audit, 'log').mockImplementationOnce(async (...args) => {
        await original(...args);
        throw new ConflictException('Synthetic audit failure');
      });
      try {
        await patch(actor, { version: before.version, name: 'Should roll back' }, path).expect(409);
      } finally {
        failure.mockRestore();
      }
      expect((await get(actor, path).expect(200)).body).toEqual(before);
      expect((await logs(before.id)).rows).toHaveLength(countBefore);
    }
  });
  it('treats unchanged saves as a no-op without adding audit entries or incrementing versions', async () => {
    const actor = await admin();
    for (const path of ['/admin/me', '/admin/settings']) {
      const before = (await get(actor, path).expect(200)).body;
      const countBefore = (await logs(before.id)).rows.length;
      const body =
        path === '/admin/me'
          ? { name: before.name, email: before.email, phone: before.phone }
          : { name: before.name, region: before.region, supportEmail: before.supportEmail };
      expect((await patch(actor, { version: before.version, ...body }, path).expect(200)).body).toEqual(
        before,
      );
      expect((await logs(before.id)).rows).toHaveLength(countBefore);
    }
  });
});
