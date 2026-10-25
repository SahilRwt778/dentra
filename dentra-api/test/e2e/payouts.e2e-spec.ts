import {
  ConflictException,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { randomInt, randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { HttpExceptionFilter } from '../../src/common/filters/http-exception.filter';
import { AuditService } from '../../src/modules/admin/audit/audit.service';

describe('Dentist payout submission and admin review (e2e)', () => {
  let app: INestApplication, pool: Pool, jwt: JwtService;
  type Actor = { id: string; token: string };
  const firstAccount = {
    bankAccountHolder: 'Payout Test Dentist',
    bankAccountNo: '001234567890',
    confirmAccountNo: '001234567890',
    bankIfsc: 'HDFC0001234',
    pan: 'ABCDE1234F',
    gstin: null,
    previousRequestId: null,
  };
  const secondAccount = {
    ...firstAccount,
    bankAccountNo: '009876543210',
    confirmAccountNo: '009876543210',
  };
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
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
    role: 'admin' | 'dentist' | 'patient',
    status = 'active',
  ): Promise<Actor> {
    const id = randomUUID();
    await pool.query(
      'insert into users (id, role, email, mobile, status, password_hash) values ($1,$2,$3,$4,$5,$6)',
      [
        id,
        role,
        `payout-${id}@example.test`,
        `+91${randomInt(6000000000, 9999999999)}`,
        status,
        role === 'admin' ? 'synthetic-admin-fixture' : null,
      ],
    );
    if (role === 'dentist') {
      await pool.query(
        `insert into dentists (user_id, full_name, qualification, specialization, council_reg_no, status)
        values ($1,'Payout Test Dentist','BDS','General dentistry','PAYOUT-TEST','verified')`,
        [id],
      );
    }
    return { id, token: jwt.sign({ sub: id, role }) };
  }
  const get = (user: Actor, path: string) =>
    request(app.getHttpServer())
      .get(path)
      .set('Authorization', `Bearer ${user.token}`);
  const post = (user: Actor, path: string, body: object = {}) =>
    request(app.getHttpServer())
      .post(path)
      .set('Authorization', `Bearer ${user.token}`)
      .send(body);
  const submit = (dentist: Actor, body: object = firstAccount) =>
    post(dentist, '/dentists/me/payout-requests', body);
  const profile = (dentist: Actor) =>
    get(dentist, '/dentists/me/payout-details');
  const approve = (admin: Actor, id: string) =>
    post(admin, `/admin/payout-requests/${id}/approve`);
  const reject = (
    admin: Actor,
    id: string,
    reason = 'Please correct the account holder name.',
  ) => post(admin, `/admin/payout-requests/${id}/reject`, { reason });

  it('requires authentication, the right role, active admins and verified dentists', async () => {
    const admin = await actor('admin'),
      dentist = await actor('dentist'),
      patient = await actor('patient');
    const readPaths = [
      '/dentists/me/payout-details',
      '/admin/payout-requests',
      `/admin/dentists/${dentist.id}/payout-details`,
    ];
    for (const path of readPaths)
      await request(app.getHttpServer()).get(path).expect(401);
    await request(app.getHttpServer())
      .post('/dentists/me/payout-requests')
      .send(firstAccount)
      .expect(401);
    for (const user of [admin, patient]) {
      await get(user, readPaths[0]).expect(403);
      await submit(user).expect(403);
    }
    for (const user of [dentist, patient, await actor('admin', 'locked')]) {
      await get(user, readPaths[1]).expect(403);
      await get(user, readPaths[2]).expect(403);
      await approve(user, randomUUID()).expect(403);
      await reject(user, randomUUID()).expect(403);
    }
    for (const status of ['draft', 'pending_review', 'rejected', 'disabled']) {
      await pool.query('update dentists set status = $2 where user_id = $1', [
        dentist.id,
        status,
      ]);
      await profile(dentist).expect(403);
      await submit(dentist).expect(403);
    }
    await get(admin, `/admin/dentists/${randomUUID()}/payout-details`).expect(
      404,
    );
    await approve(admin, randomUUID()).expect(404);
  });

  it('saves a normalized pending proposal separately, without storing confirmation or leaking it to public profiles or audit logs', async () => {
    const dentist = await actor('dentist'),
      other = await actor('dentist'),
      admin = await actor('admin');
    await pool.query('update users set email = null where id = $1', [dentist.id]);
    expect((await profile(dentist).expect(200)).body).toEqual({
      approved: null,
      request: null,
    });
    const submitted = await submit(dentist, {
      ...firstAccount,
      bankAccountHolder: '  Payout Test Dentist  ',
      bankIfsc: ' hdfc0001234 ',
      pan: ' abcde1234f ',
      gstin: '',
    }).expect(201);
    expect(submitted.headers['cache-control']).toBe('no-store');
    expect(submitted.body).toMatchObject({
      dentistId: dentist.id,
      status: 'pending',
      bankAccountNo: '001234567890',
      bankAccountHolder: 'Payout Test Dentist',
      bankIfsc: 'HDFC0001234',
      pan: 'ABCDE1234F',
      gstin: null,
      reviewedAt: null,
    });
    expect(submitted.body.confirmAccountNo).toBeUndefined();
    expect((await profile(dentist).expect(200)).body).toEqual({
      approved: null,
      request: submitted.body,
    });
    expect((await profile(other).expect(200)).body).toEqual({
      approved: null,
      request: null,
    });
    expect(
      (
        await get(admin, `/admin/dentists/${dentist.id}/payout-details`).expect(
          200,
        )
      ).body.request,
    ).toEqual(submitted.body);
    const row = (
      await pool.query(
        'select bank_account_no, pan, status from dentists where user_id = $1',
        [dentist.id],
      )
    ).rows[0];
    expect(row).toEqual({
      bank_account_no: null,
      pan: null,
      status: 'verified',
    });
    const publicRecord = (
      await request(app.getHttpServer())
        .get(`/dentists/${dentist.id}`)
        .expect(200)
    ).body;
    expect(JSON.stringify(publicRecord)).not.toContain(
      firstAccount.bankAccountNo,
    );
    expect(publicRecord.bankAccountNo).toBeUndefined();
    const audit = (
      await pool.query('select * from audit_log where entity_id = $1', [
        dentist.id,
      ])
    ).rows;
    expect(audit).toHaveLength(1);
    expect(audit[0].action).toBe('payout_submitted');
    expect(audit[0].actor_user_id).toBe(dentist.id);
    expect(audit[0].actor_label).not.toBe('admin');
    expect(JSON.stringify(audit)).not.toContain(firstAccount.bankAccountNo);
    expect(JSON.stringify(audit)).not.toContain(firstAccount.pan);
  });

  it('validates bank and tax formats, confirmation and privileged fields on the server', async () => {
    const dentist = await actor('dentist');
    const invalid = [
      { bankAccountHolder: ' ' },
      { bankAccountHolder: 'x'.repeat(121) },
      { bankAccountNo: '1234' },
      { bankAccountNo: '12abc7890' },
      { confirmAccountNo: '9999999999' },
      { bankIfsc: 'BAD-IFSC' },
      { pan: 'invalid' },
      { gstin: 'invalid' },
      { previousRequestId: 'invalid' },
      { dentistId: randomUUID() },
      { status: 'approved' },
      { reviewedBy: randomUUID() },
    ];
    for (const change of invalid)
      await submit(dentist, { ...firstAccount, ...change }).expect(400);
    expect((await profile(dentist).expect(200)).body.request).toBeNull();
    const admin = await actor('admin');
    for (const query of ['page=0', 'page=1.5', 'page=no', 'status=unknown'])
      await get(admin, `/admin/payout-requests?${query}`).expect(400);
  });

  it('allows only one pending request under concurrent submissions', async () => {
    const dentist = await actor('dentist');
    const results = await Promise.all([submit(dentist), submit(dentist)]);
    expect(results.map((result) => result.status).sort()).toEqual([201, 409]);
    expect(
      (
        await pool.query(
          'select id from dentist_payout_requests where dentist_id = $1',
          [dentist.id],
        )
      ).rows,
    ).toHaveLength(1);
    expect((await profile(dentist).expect(200)).body.approved).toBeNull();
  });

  it('approves an exact proposal, activates its account and keeps the dentist verified', async () => {
    const dentist = await actor('dentist'),
      admin = await actor('admin');
    const proposal = (await submit(dentist).expect(201)).body;
    const response = await approve(admin, proposal.id).expect(200);
    expect(response.body).toMatchObject({
      id: proposal.id,
      status: 'approved',
      rejectionReason: null,
    });
    expect(response.body.reviewedAt).toBeTruthy();
    const saved = (await profile(dentist).expect(200)).body;
    expect(saved.approved).toMatchObject({
      bankAccountNo: firstAccount.bankAccountNo,
      pan: firstAccount.pan,
    });
    expect(saved.request.status).toBe('approved');
    const ownRecord = (await get(dentist, '/dentists/me').expect(200)).body;
    expect(ownRecord).toMatchObject({
      status: 'verified',
      bankAccountNo: firstAccount.bankAccountNo,
    });
    await approve(admin, proposal.id).expect(409);
    await reject(admin, proposal.id).expect(409);
  });

  it('keeps the approved account during pending and rejected changes, and permits a corrected resubmission', async () => {
    const dentist = await actor('dentist'),
      admin = await actor('admin');
    const first = (await submit(dentist).expect(201)).body;
    await approve(admin, first.id).expect(200);
    const change = (
      await submit(dentist, {
        ...secondAccount,
        previousRequestId: first.id,
      }).expect(201)
    ).body;
    expect(
      (await profile(dentist).expect(200)).body.approved.bankAccountNo,
    ).toBe(firstAccount.bankAccountNo);
    await reject(admin, change.id, '  Please correct the name.  ').expect(200);
    const rejected = (await profile(dentist).expect(200)).body;
    expect(rejected.approved.bankAccountNo).toBe(firstAccount.bankAccountNo);
    expect(rejected.request).toMatchObject({
      status: 'rejected',
      rejectionReason: 'Please correct the name.',
    });
    await submit(dentist, {
      ...secondAccount,
      previousRequestId: first.id,
    }).expect(409);
    const corrected = (
      await submit(dentist, {
        ...secondAccount,
        previousRequestId: change.id,
        gstin: '27ABCDE1234F1Z5',
      }).expect(201)
    ).body;
    await approve(admin, change.id).expect(409);
    await approve(admin, corrected.id).expect(200);
    expect((await profile(dentist).expect(200)).body.approved).toMatchObject({
      bankAccountNo: secondAccount.bankAccountNo,
      gstin: '27ABCDE1234F1Z5',
    });
    const clearTax = (
      await submit(dentist, {
        ...secondAccount,
        previousRequestId: corrected.id,
        gstin: '',
      }).expect(201)
    ).body;
    await approve(admin, clearTax.id).expect(200);
    expect((await profile(dentist).expect(200)).body.approved.gstin).toBeNull();
  });

  it('requires a rejection reason and prevents two admins from applying conflicting decisions', async () => {
    const dentist = await actor('dentist'),
      admin = await actor('admin'),
      secondAdmin = await actor('admin');
    const proposal = (await submit(dentist).expect(201)).body;
    await reject(admin, proposal.id, ' ').expect(400);
    const results = await Promise.all([
      approve(admin, proposal.id),
      reject(secondAdmin, proposal.id),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual([200, 409]);
    const saved = (await profile(dentist).expect(200)).body;
    expect(saved.approved?.bankAccountNo ?? null).toBe(
      saved.request.status === 'approved' ? firstAccount.bankAccountNo : null,
    );
    const audit = (
      await pool.query(
        "select * from audit_log where entity_id = $1 and action in ('payout_approved','payout_rejected')",
        [dentist.id],
      )
    ).rows;
    expect(audit).toHaveLength(1);
  });

  it('rolls back account activation and the review decision when the audit write fails', async () => {
    const dentist = await actor('dentist'),
      admin = await actor('admin');
    const proposal = (await submit(dentist).expect(201)).body;
    const auditFailure = jest
      .spyOn(AuditService.prototype, 'log')
      .mockRejectedValueOnce(new ConflictException('Synthetic audit failure'));
    try {
      await approve(admin, proposal.id).expect(409);
    } finally {
      auditFailure.mockRestore();
    }
    expect((await profile(dentist).expect(200)).body).toMatchObject({
      approved: null,
      request: { status: 'pending', reviewedAt: null },
    });
    await approve(admin, proposal.id).expect(200);
  });

  it('blocks approval after the dentist is disabled but still allows admin rejection', async () => {
    const dentist = await actor('dentist'),
      admin = await actor('admin');
    const proposal = (await submit(dentist).expect(201)).body;
    await pool.query(
      "update dentists set status = 'disabled' where user_id = $1",
      [dentist.id],
    );
    await approve(admin, proposal.id).expect(409);
    await reject(admin, proposal.id).expect(200);
    const saved = (
      await get(admin, `/admin/dentists/${dentist.id}/payout-details`).expect(
        200,
      )
    ).body;
    expect(saved).toMatchObject({
      approved: null,
      request: { status: 'rejected' },
    });
  });

  it('paginates the private review queue without exposing account or tax identifiers', async () => {
    const admin = await actor('admin');
    const seeded: string[] = [];
    for (let index = 0; index < 21; index++) {
      const dentist = await actor('dentist');
      seeded.push((await submit(dentist).expect(201)).body.id);
    }
    const seen: string[] = [];
    let page: number | null = 1;
    while (page !== null) {
      const response: request.Response = await get(
        admin,
        `/admin/payout-requests?page=${page}`,
      ).expect(200);
      expect(response.body.items.length).toBeLessThanOrEqual(20);
      for (const item of response.body.items) {
        expect(item.status).toBe('pending');
        expect(item.bankAccountNo).toBeUndefined();
        expect(item.pan).toBeUndefined();
        seen.push(item.id);
      }
      page = response.body.nextPage;
    }
    expect(new Set(seen).size).toBe(seen.length);
    for (const id of seeded) expect(seen).toContain(id);
    expect(seen.length).toBeGreaterThan(20);
  });
});
