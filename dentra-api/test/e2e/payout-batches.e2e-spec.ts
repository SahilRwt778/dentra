import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { randomInt, randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { HttpExceptionFilter } from '../../src/common/filters/http-exception.filter';
import { AuditService } from '../../src/modules/admin/audit/audit.service';

describe('Manual payout batches (e2e)', () => {
  let app: INestApplication, pool: Pool, jwt: JwtService;
  let sequence = 0;
  type Actor = { id: string; token: string; approvalId: string };
  const path = '/admin/payout-batches';
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
    approved = true,
  ): Promise<Actor> {
    const id = randomUUID();
    await pool.query(
      'insert into users (id,role,mobile,email,password_hash) values ($1,$2,$3,$4,$5)',
      [
        id,
        role,
        role === 'admin' ? null : `+91${randomInt(6000000000, 9999999999)}`,
        role === 'admin' ? `${id}@example.test` : null,
        role === 'admin' ? 'synthetic' : null,
      ],
    );
    let approvalId = '';
    if (role === 'dentist') {
      await pool.query(
        `insert into dentists (user_id,full_name,qualification,specialization,council_reg_no,status,bank_account_holder,bank_account_no,bank_ifsc)
        values ($1,'Synthetic Ledger Dentist','BDS','General','TEST-LEDGER','verified','Test Holder','123456789012','TEST0001234')`,
        [id],
      );
      if (approved)
        approvalId = (
          await pool.query(
            `insert into dentist_payout_requests
        (dentist_id,bank_account_holder,bank_account_no,bank_ifsc,pan,status,reviewed_by,reviewed_at)
        values ($1,'Test Holder','123456789012','TEST0001234','ABCDE1234F','approved',$1,now()) returning id`,
            [id],
          )
        ).rows[0].id;
    } else if (role === 'patient')
      await pool.query(
        "insert into patients (user_id,full_name,date_of_birth) values ($1,'Synthetic Ledger Patient','1990-01-01')",
        [id],
      );
    return { id, token: jwt.sign({ sub: id, role }), approvalId };
  }
  async function payment(
    dentist: Actor,
    options: {
      status?: string;
      completed?: boolean;
      amount?: number;
      captured?: boolean;
      clinic?: boolean;
    } = {},
  ) {
    const patient = await actor('patient');
    const appointmentId = (
      await pool.query(
        `insert into appointments
      (dentist_id,patient_id,type,scheduled_date,scheduled_time,status,concern_summary,completed_at)
      values ($1,$2,'video','2025-01-01'::date + $3::int,'10:00',$4,'Synthetic only',now()) returning id`,
        [
          dentist.id,
          patient.id,
          ++sequence,
          options.completed === false ? 'booked' : 'completed',
        ],
      )
    ).rows[0].id;
    const id = (
      await pool.query(
        `insert into transactions (appointment_id,idempotency_key,amount_paise,method,status,gateway_payment_ref)
      values ($1,$2,$3,$4,$5,$6) returning id`,
        [
          appointmentId,
          randomUUID(),
          options.amount ?? 10029,
          options.clinic ? 'pay_at_clinic' : 'upi',
          options.status ?? 'paid',
          options.captured === false ? null : `pay_${randomUUID()}`,
        ],
      )
    ).rows[0].id;
    if (options.clinic)
      await pool.query(
        "insert into clinic_payment_collections (id,transaction_id,amount_paise,method,collected_by) values ($1,$2,$3,'cash',$4)",
        [randomUUID(), id, options.amount ?? 10029, dentist.id],
      );
    return id as string;
  }
  const get = (actor: Actor, url: string, query = {}) =>
    request(app.getHttpServer())
      .get(url)
      .set('Authorization', `Bearer ${actor.token}`)
      .query(query);
  const post = (actor: Actor, url: string, body: object) =>
    request(app.getHttpServer())
      .post(url)
      .set('Authorization', `Bearer ${actor.token}`)
      .send(body);
  const input = (dentist: Actor, ids: string[], feeBps = 1000) => ({
    requestId: randomUUID(),
    dentistId: dentist.id,
    accountApprovalId: dentist.approvalId,
    transactionIds: ids,
    feeBps,
  });
  const change = (
    admin: Actor,
    batch: { id: string; version: number },
    action: string,
    fields = {},
  ) =>
    post(admin, `${path}/${batch.id}/actions`, {
      requestId: randomUUID(),
      version: batch.version,
      action,
      ...fields,
    });
  const today = () =>
    new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

  it('scopes history and details to the verified owner and keeps full bank data admin-only', async () => {
    const admin = await actor('admin'),
      dentist = await actor('dentist'),
      other = await actor('dentist');
    const batch = (
      await post(admin, path, input(dentist, [await payment(dentist)])).expect(
        200,
      )
    ).body;
    expect(batch.account.accountNo).toBe('123456789012');
    await request(app.getHttpServer()).get(path).expect(401);
    await get(dentist, path).expect(403);
    await post(dentist, path, input(dentist, [await payment(dentist)])).expect(
      403,
    );
    const own = await get(
      dentist,
      `/dentists/me/payout-batches/${batch.id}`,
    ).expect(200);
    expect(own.body.account).toBeNull();
    expect(own.body.accountLast4).toBe('9012');
    expect(JSON.stringify(own.body)).not.toContain('123456789012');
    await get(other, `/dentists/me/payout-batches/${batch.id}`).expect(404);
    await get(other, `/dentists/me/payout-batches/${randomUUID()}`).expect(404);
    expect(
      (await get(other, '/dentists/me/payout-batches').expect(200)).body.total,
    ).toBe(0);
    await get(dentist, '/dentists/me/payout-batches', {
      dentistId: other.id,
    }).expect(400);
    await pool.query("update dentists set status='disabled' where user_id=$1", [
      dentist.id,
    ]);
    await get(dentist, '/dentists/me/payout-batches').expect(403);
    expect(own.headers['cache-control']).toBe('no-store');
  });

  it('excludes unpaid, uncompleted, zero-fee, clinic-collected and refunded transactions', async () => {
    const admin = await actor('admin'),
      dentist = await actor('dentist');
    const eligible = await payment(dentist);
    const excluded = [
      await payment(dentist, { status: 'pending' }),
      await payment(dentist, { completed: false }),
      await payment(dentist, { amount: 0 }),
      await payment(dentist, { clinic: true }),
      await payment(dentist, { captured: false }),
      await payment(dentist, { status: 'refunded' }),
    ];
    const refund = await payment(dentist);
    await pool.query(
      "insert into payment_refunds (transaction_id,payment_ref,amount_paise) values ($1,'pay_test',10029)",
      [refund],
    );
    const result = (
      await get(admin, `${path}/eligible`, { dentistId: dentist.id }).expect(
        200,
      )
    ).body;
    expect(result.items.map((x: { id: string }) => x.id)).toEqual([eligible]);
    expect(result.total).toBe(1);
    expect(result.grossPaise).toBe(10029);
    for (const id of [...excluded, refund])
      await post(admin, path, input(dentist, [id])).expect(409);
    const withoutAccount = await actor('dentist', false);
    const missing = await payment(withoutAccount);
    expect(
      (
        await get(admin, `${path}/eligible`, {
          dentistId: withoutAccount.id,
        }).expect(200)
      ).body.account,
    ).toBeNull();
    await post(admin, path, {
      ...input(withoutAccount, [missing]),
      accountApprovalId: randomUUID(),
    }).expect(409);
  });

  it('snapshots exact paise and per-item fees, supports identical retries and audits once', async () => {
    const admin = await actor('admin'),
      dentist = await actor('dentist');
    const ids = [
      await payment(dentist, { amount: 101 }),
      await payment(dentist, { amount: 29 }),
    ];
    const body = input(dentist, ids, 5000);
    const batch = (await post(admin, path, body).expect(200)).body;
    expect(batch).toMatchObject({
      grossPaise: 130,
      feePaise: 66,
      netPaise: 64,
      feeBps: 5000,
      status: 'pending',
      version: 1,
    });
    expect(
      batch.items.reduce(
        (sum: number, item: { feePaise: number }) => sum + item.feePaise,
        0,
      ),
    ).toBe(66);
    const retry = (
      await post(admin, path, {
        ...body,
        transactionIds: [...ids].reverse(),
      }).expect(200)
    ).body;
    expect(retry.id).toBe(batch.id);
    expect(
      (
        await pool.query('select count(*) from audit_log where entity_id=$1', [
          batch.id,
        ])
      ).rows[0].count,
    ).toBe('1');
    await post(admin, path, { ...body, feeBps: 0 }).expect(409);
    await post(admin, path, input(dentist, ids)).expect(409);
    expect(
      (
        await get(admin, `${path}/eligible`, { dentistId: dentist.id }).expect(
          200,
        )
      ).body.total,
    ).toBe(0);
  });

  it('serializes competing batches and concurrent retries without double reservation', async () => {
    const admin = await actor('admin'),
      dentist = await actor('dentist');
    const ids = [await payment(dentist)];
    const competing = await Promise.all([
      post(admin, path, input(dentist, ids)),
      post(admin, path, input(dentist, ids)),
    ]);
    expect(competing.map((x) => x.status).sort()).toEqual([200, 409]);
    const body = input(dentist, [await payment(dentist)]);
    const retry = await Promise.all([
      post(admin, path, body),
      post(admin, path, body),
    ]);
    expect(retry.map((x) => x.status)).toEqual([200, 200]);
    expect(retry[0].body.id).toBe(retry[1].body.id);
  });

  it('requires explicit processing, fresh versions and bank evidence; paid batches are immutable', async () => {
    const admin = await actor('admin'),
      dentist = await actor('dentist');
    let batch = (
      await post(admin, path, input(dentist, [await payment(dentist)])).expect(
        200,
      )
    ).body;
    await change(admin, batch, 'paid', {
      reference: 'UTR-1',
      paidOn: today(),
    }).expect(409);
    const old = batch;
    batch = (await change(admin, batch, 'processing').expect(200)).body;
    await change(admin, old, 'cancelled', { note: 'Stale action' }).expect(409);
    await change(admin, batch, 'cancelled', {
      note: 'Cannot cancel in flight',
    }).expect(409);
    await change(admin, batch, 'paid').expect(400);
    await change(admin, batch, 'paid', {
      reference: 'UTR-1',
      paidOn: '2099-01-01',
    }).expect(400);
    const body = {
      requestId: randomUUID(),
      version: batch.version,
      action: 'paid',
      reference: ' utr-1 ',
      paidOn: today(),
    };
    batch = (await post(admin, `${path}/${batch.id}/actions`, body).expect(200))
      .body;
    expect(batch).toMatchObject({
      status: 'paid',
      bankReference: 'UTR-1',
      paidOn: today(),
      version: 3,
    });
    expect(
      (await post(admin, `${path}/${batch.id}/actions`, body).expect(200)).body
        .version,
    ).toBe(3);
    await change(admin, batch, 'failed', { note: 'Cannot rewrite' }).expect(
      409,
    );
    expect(batch.events.map((x: { status: string }) => x.status)).toEqual([
      'pending',
      'processing',
      'paid',
    ]);
    const audits = (
      await pool.query('select after_state from audit_log where entity_id=$1', [
        batch.id,
      ])
    ).rows;
    expect(audits).toHaveLength(3);
    expect(JSON.stringify(audits)).not.toContain('123456789012');
  });

  it('keeps failed transfers reserved, releases only on cancellation and rejects duplicate bank references', async () => {
    const admin = await actor('admin'),
      dentist = await actor('dentist');
    const id = await payment(dentist);
    let batch = (await post(admin, path, input(dentist, [id])).expect(200))
      .body;
    batch = (await change(admin, batch, 'processing').expect(200)).body;
    await change(admin, batch, 'failed').expect(400);
    batch = (
      await change(admin, batch, 'failed', {
        note: 'Bank confirmed transfer failed',
      }).expect(200)
    ).body;
    await post(admin, path, input(dentist, [id])).expect(409);
    batch = (
      await change(admin, batch, 'cancelled', {
        note: 'No transfer occurred',
      }).expect(200)
    ).body;
    expect(batch.items[0].released).toBe(true);
    let replacement = (
      await post(admin, path, input(dentist, [id])).expect(200)
    ).body;
    replacement = (await change(admin, replacement, 'processing').expect(200))
      .body;
    await change(admin, replacement, 'paid', {
      reference: 'UTR-UNIQUE',
      paidOn: today(),
    }).expect(200);
    let another = (
      await post(admin, path, input(dentist, [await payment(dentist)])).expect(
        200,
      )
    ).body;
    another = (await change(admin, another, 'processing').expect(200)).body;
    await change(admin, another, 'paid', {
      reference: 'utr-unique',
      paidOn: today(),
    }).expect(409);
    expect(
      (await get(admin, `${path}/${another.id}`).expect(200)).body.status,
    ).toBe('processing');
  });

  it('rechecks approved bank and payment eligibility before processing; flags a later refund', async () => {
    const admin = await actor('admin'),
      dentist = await actor('dentist');
    const txn = await payment(dentist);
    let batch = (await post(admin, path, input(dentist, [txn])).expect(200))
      .body;
    await pool.query(
      "update dentists set bank_account_no='999999999999' where user_id=$1",
      [dentist.id],
    );
    await change(admin, batch, 'processing').expect(409);
    await pool.query(
      "update dentists set bank_account_no='123456789012' where user_id=$1",
      [dentist.id],
    );
    await pool.query(
      "update transactions set status='refund_pending' where id=$1",
      [txn],
    );
    await change(admin, batch, 'processing').expect(409);
    expect(
      (await get(admin, `${path}/${batch.id}`).expect(200)).body.needsAttention,
    ).toBe(true);
    await pool.query("update transactions set status='paid' where id=$1", [
      txn,
    ]);
    batch = (await change(admin, batch, 'processing').expect(200)).body;
    await pool.query("update transactions set status='refunded' where id=$1", [
      txn,
    ]);
    await change(admin, batch, 'paid', {
      reference: 'UTR-AFTER-REFUND',
      paidOn: today(),
    }).expect(409);
    batch = (
      await change(admin, batch, 'paid', {
        reference: 'UTR-AFTER-REFUND',
        paidOn: today(),
        acknowledgeChanges: true,
      }).expect(200)
    ).body;
    expect(batch.needsAttention).toBe(true);
    expect(batch.netPaise).toBe(9026);
  });

  it('filters and paginates history with exact totals and rolls back a failed audit write', async () => {
    const admin = await actor('admin'),
      dentist = await actor('dentist');
    for (let i = 0; i < 3; i++)
      await post(
        admin,
        path,
        input(dentist, [await payment(dentist)], 0),
      ).expect(200);
    const page = (
      await get(admin, path, { dentistId: dentist.id, limit: 2 }).expect(200)
    ).body;
    expect(page).toMatchObject({
      total: 3,
      reservedPaise: 30087,
      paidPaise: 0,
      nextPage: 2,
    });
    expect(page.items).toHaveLength(2);
    const next = (
      await get(admin, path, {
        dentistId: dentist.id,
        limit: 2,
        page: 2,
      }).expect(200)
    ).body;
    expect(next.items).toHaveLength(1);
    expect(next.nextPage).toBeNull();
    expect(next.items[0].id).not.toBe(page.items[0].id);
    expect(
      (
        await get(admin, path, {
          dentistId: dentist.id,
          status: 'paid',
        }).expect(200)
      ).body.total,
    ).toBe(0);
    const body = input(dentist, [await payment(dentist)]);
    const spy = jest
      .spyOn(app.get(AuditService), 'log')
      .mockRejectedValueOnce(new Error('Synthetic ledger audit failure'));
    await post(admin, path, body).expect(500);
    spy.mockRestore();
    expect(
      (
        await pool.query(
          'select count(*) from payout_batch_items where batch_id=$1',
          [body.requestId],
        )
      ).rows[0].count,
    ).toBe('0');
    await post(admin, path, body).expect(200);
  });

  it('protects provider captures as well as transaction IDs and detects changed snapshot amounts', async () => {
    const admin = await actor('admin'),
      dentist = await actor('dentist');
    const first = await payment(dentist),
      duplicate = await payment(dentist);
    await pool.query(
      'update transactions set gateway_payment_ref=(select gateway_payment_ref from transactions where id=$1) where id=$2',
      [first, duplicate],
    );
    const batch = (await post(admin, path, input(dentist, [first])).expect(200))
      .body;
    await post(admin, path, input(dentist, [duplicate])).expect(409);
    expect(
      (
        await get(admin, `${path}/eligible`, { dentistId: dentist.id }).expect(
          200,
        )
      ).body.total,
    ).toBe(0);
    await pool.query(
      'update transactions set amount_paise=amount_paise+1 where id=$1',
      [first],
    );
    expect(
      (await get(admin, `${path}/${batch.id}`).expect(200)).body.needsAttention,
    ).toBe(true);
    await change(admin, batch, 'processing').expect(409);
  });

  it('rolls back transfer progress when audit storage fails and safely retries the exact request', async () => {
    const admin = await actor('admin'),
      dentist = await actor('dentist');
    const batch = (
      await post(admin, path, input(dentist, [await payment(dentist)])).expect(
        200,
      )
    ).body;
    const body = { requestId: randomUUID(), version: 1, action: 'processing' };
    const spy = jest
      .spyOn(app.get(AuditService), 'log')
      .mockRejectedValueOnce(new Error('Synthetic transition audit failure'));
    await post(admin, `${path}/${batch.id}/actions`, body).expect(500);
    spy.mockRestore();
    const unchanged = (await get(admin, `${path}/${batch.id}`).expect(200))
      .body;
    expect(unchanged.status).toBe('pending');
    expect(unchanged.version).toBe(1);
    expect(unchanged.events).toHaveLength(1);
    expect(
      (await post(admin, `${path}/${batch.id}/actions`, body).expect(200)).body
        .version,
    ).toBe(2);
  });

  it('validates rates, IDs, bounds and server-owned fields', async () => {
    const admin = await actor('admin'),
      dentist = await actor('dentist');
    const ids = [await payment(dentist)];
    const body = input(dentist, ids);
    for (const changes of [
      { feeBps: -1 },
      { feeBps: 10001 },
      { feeBps: 1.2 },
      { transactionIds: [] },
      { transactionIds: [ids[0], ids[0]] },
      { netPaise: 1 },
      { accountApprovalId: randomUUID() },
    ])
      await post(admin, path, { ...body, ...changes }).expect(
        'accountApprovalId' in changes ? 409 : 400,
      );
    await post(admin, path, { ...body, feeBps: 10000 }).expect(400);
    for (const query of [{ limit: 101 }, { page: 0 }, { status: 'unknown' }])
      await get(admin, path, query).expect(400);
    await get(admin, `${path}/not-a-uuid`).expect(400);
    const result = (
      await get(admin, `${path}/dentists`, { q: 'Synthetic Ledger' }).expect(
        200,
      )
    ).body;
    expect(result.items.some((x: { id: string }) => x.id === dentist.id)).toBe(
      true,
    );
  });
});
