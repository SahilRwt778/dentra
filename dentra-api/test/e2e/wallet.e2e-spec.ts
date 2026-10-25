import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { randomInt, randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { HttpExceptionFilter } from '../../src/common/filters/http-exception.filter';
import { RazorpayGatewayService } from '../../src/modules/payments/razorpay-gateway.service';
import { AuditService } from '../../src/modules/admin/audit/audit.service';
import { NotificationsService } from '../../src/modules/notifications/notifications.service';

describe('Dentist wallet and withdrawal requests (e2e)', () => {
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
    await pool.query(
      'update wallet_settings set fee_bps=null,minimum_withdrawal_paise=null',
    );
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

  beforeEach(async () => {
    await pool.query(
      'update wallet_settings set fee_bps=null,minimum_withdrawal_paise=null,version=version+1',
    );
  });
  const wallet = (dentist: Actor) => get(dentist, '/dentists/me/wallet');
  async function configure(
    admin: Actor,
    feeBps = 1000,
    minimumWithdrawalPaise = 100,
    applyToUnpriced = false,
  ) {
    const current = (await get(admin, '/admin/wallet-settings').expect(200))
      .body;
    return request(app.getHttpServer())
      .patch('/admin/wallet-settings')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        version: current.version,
        feeBps,
        minimumWithdrawalPaise,
        applyToUnpriced,
      })
      .expect(200);
  }
  async function earning(
    dentist: Actor,
    amount = 10029,
    feeBps: number | null = 1000,
    options: Parameters<typeof payment>[1] = {},
  ) {
    const id = await payment(dentist, { ...options, amount });
    await pool.query(
      'update transactions set platform_fee_bps=$2 where id=$1',
      [id, feeBps],
    );
    return id;
  }
  const ask = (dentist: Actor, amountPaise: number, requestId = randomUUID()) =>
    post(dentist, '/dentists/me/withdrawals', {
      requestId,
      accountApprovalId: dentist.approvalId,
      amountPaise,
    });
  const review = (
    admin: Actor,
    w: { id: string; version: number },
    action: string,
    fields = {},
  ) =>
    post(admin, `/admin/withdrawals/${w.id}/actions`, {
      requestId: randomUUID(),
      version: w.version,
      action,
      ...fields,
    });

  it('starts unconfigured, requires an active verified owner and enforces private settings access', async () => {
    const admin = await actor('admin'),
      dentist = await actor('dentist'),
      patient = await actor('patient');
    const initial = (await wallet(dentist).expect(200)).body;
    expect(initial).toMatchObject({
      configured: false,
      feeBps: null,
      minimumWithdrawalPaise: null,
      availablePaise: 0,
    });
    await earning(dentist);
    await ask(dentist, 1000).expect(409);
    await get(patient, '/dentists/me/wallet').expect(403);
    await get(dentist, '/admin/wallet-settings').expect(403);
    await configure(admin);
    await pool.query("update dentists set status='disabled' where user_id=$1", [
      dentist.id,
    ]);
    await wallet(dentist).expect(403);
    await ask(dentist, 1000).expect(403);
    await request(app.getHttpServer()).get('/dentists/me/wallet').expect(401);
  });
  it('calculates exact net balances, excludes direct clinic collections, deduplicates captures and separates pending/unpriced', async () => {
    const admin = await actor('admin'),
      dentist = await actor('dentist');
    await configure(admin, 5000);
    await earning(dentist, 101, 5000);
    await earning(dentist, 29, 5000);
    await earning(dentist, 10029, 1000, { clinic: true });
    await earning(dentist, 10029, 1000, { captured: false });
    await earning(dentist, 10029, 1000, { status: 'refunded' });
    await earning(dentist, 10029, 1000, { completed: false });
    await earning(dentist, 777, null);
    const original = await earning(dentist, 100, 0),
      duplicate = await earning(dentist, 100, 0);
    await pool.query(
      'update transactions set gateway_payment_ref=(select gateway_payment_ref from transactions where id=$1) where id=$2',
      [original, duplicate],
    );
    const result = await wallet(dentist).expect(200);
    expect(result.body).toMatchObject({
      availablePaise: 164,
      eligibleGrossPaise: 230,
      eligibleFeePaise: 66,
      pendingPaise: 9026,
      unpricedGrossPaise: 777,
      unpricedCount: 1,
      reservedPaise: 0,
      shortfallPaise: 0,
    });
    expect(JSON.stringify(result.body)).not.toContain('123456789012');
    expect(result.headers['cache-control']).toBe('no-store');
  });
  it('reserves arbitrary amounts once, enforces the minimum, hides other owners, and notifies admin exactly once', async () => {
    const admin = await actor('admin'),
      dentist = await actor('dentist'),
      other = await actor('dentist');
    await configure(admin, 1000, 1000);
    await earning(dentist);
    await ask(dentist, 999).expect(400);
    await ask(dentist, 9027).expect(409);
    const key = randomUUID();
    const withdrawal = (await ask(dentist, 2000, key).expect(200)).body;
    expect(withdrawal).toMatchObject({
      status: 'requested',
      amountPaise: 2000,
      version: 1,
      account: null,
      wallet: { availablePaise: 7026, reservedPaise: 2000 },
    });
    expect((await ask(dentist, 2000, key).expect(200)).body.version).toBe(1);
    await ask(dentist, 2001, key).expect(409);
    expect(
      (await get(dentist, '/dentists/me/withdrawals').expect(200)).body.total,
    ).toBe(1);
    await get(other, `/dentists/me/withdrawals/${withdrawal.id}`).expect(404);
    await get(other, `/dentists/me/withdrawals/${randomUUID()}`).expect(404);
    await get(other, '/dentists/me/withdrawals', {
      dentistId: dentist.id,
    }).expect(400);
    const detail = (
      await get(admin, `/admin/withdrawals/${withdrawal.id}`).expect(200)
    ).body;
    expect(detail.account.accountNo).toBe('123456789012');
    const notes = (
      await get(admin, '/notifications').expect(200)
    ).body.items.filter(
      (item: { type: string; withdrawalId: string }) =>
        item.type === 'wallet_withdrawal_requested' &&
        item.withdrawalId === withdrawal.id,
    );
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({
      amountPaise: 2000,
      dentistId: dentist.id,
    });
    expect(JSON.stringify(notes)).not.toContain('123456789012');
  });
  it('serializes simultaneous withdrawal requests and idempotent retries against the available balance', async () => {
    const admin = await actor('admin'),
      dentist = await actor('dentist');
    await configure(admin);
    await earning(dentist);
    const competing = await Promise.all([
      ask(dentist, 5000),
      ask(dentist, 5000),
    ]);
    expect(competing.map((x) => x.status).sort()).toEqual([200, 409]);
    const key = randomUUID();
    const retries = await Promise.all([
      ask(dentist, 1000, key),
      ask(dentist, 1000, key),
    ]);
    expect(retries.map((x) => x.status)).toEqual([200, 200]);
    expect((await wallet(dentist).expect(200)).body).toMatchObject({
      availablePaise: 3026,
      reservedPaise: 6000,
    });
  });
  it('declines with a reason, releases funds, rejects stale reviews and preserves the original minimum', async () => {
    const admin = await actor('admin'),
      dentist = await actor('dentist');
    await configure(admin, 1000, 1000);
    await earning(dentist);
    let w = (await ask(dentist, 2000).expect(200)).body;
    await review(admin, w, 'rejected').expect(400);
    const old = w;
    w = (
      await review(admin, w, 'rejected', {
        note: 'Please review your payout details',
      }).expect(200)
    ).body;
    expect(w.wallet.availablePaise).toBe(9026);
    expect(w.events.at(-1).note).toBe('Please review your payout details');
    await review(admin, old, 'approved').expect(409);
    w = (await ask(dentist, 2000).expect(200)).body;
    await configure(admin, 1000, 5000);
    w = (await review(admin, w, 'approved').expect(200)).body;
    expect(w.minimumPaise).toBe(1000);
    expect(w.status).toBe('approved');
    expect(w.wallet.withdrawnPaise).toBe(0);
  });
  it('records a paid transfer only after approval/processing and keeps failed transfers reserved', async () => {
    const admin = await actor('admin'),
      dentist = await actor('dentist');
    await configure(admin);
    await earning(dentist);
    let w = (await ask(dentist, 4000).expect(200)).body;
    await review(admin, w, 'paid', {
      reference: 'WALLET-TEST',
      paidOn: today(),
    }).expect(409);
    w = (await review(admin, w, 'approved').expect(200)).body;
    w = (await review(admin, w, 'processing').expect(200)).body;
    await review(admin, w, 'rejected', {
      note: 'Cannot decline in flight',
    }).expect(409);
    w = (
      await review(admin, w, 'failed', {
        note: 'Bank confirmed no transfer',
      }).expect(200)
    ).body;
    expect(w.wallet.reservedPaise).toBe(4000);
    w = (await review(admin, w, 'processing').expect(200)).body;
    await review(admin, w, 'paid').expect(400);
    const body = {
      requestId: randomUUID(),
      version: w.version,
      action: 'paid',
      reference: ' wallet-test ',
      paidOn: today(),
    };
    w = (
      await post(admin, `/admin/withdrawals/${w.id}/actions`, body).expect(200)
    ).body;
    expect(w).toMatchObject({
      status: 'paid',
      bankReference: 'WALLET-TEST',
      wallet: { availablePaise: 5026, reservedPaise: 0, withdrawnPaise: 4000 },
    });
    expect(
      (
        await post(admin, `/admin/withdrawals/${w.id}/actions`, body).expect(
          200,
        )
      ).body.version,
    ).toBe(w.version);
    await review(admin, w, 'cancelled', { note: 'Cannot change paid' }).expect(
      409,
    );
  });
  it('blocks approval for changed bank accounts or refunds and exposes shortfalls after already paid transfers', async () => {
    const admin = await actor('admin'),
      dentist = await actor('dentist');
    await configure(admin);
    const id = await earning(dentist);
    let w = (await ask(dentist, 8000).expect(200)).body;
    await pool.query(
      "update dentists set bank_account_no='999999999999' where user_id=$1",
      [dentist.id],
    );
    await review(admin, w, 'approved').expect(409);
    await pool.query(
      "update dentists set bank_account_no='123456789012' where user_id=$1",
      [dentist.id],
    );
    await pool.query(
      "update transactions set status='refund_pending' where id=$1",
      [id],
    );
    await review(admin, w, 'approved').expect(409);
    expect((await wallet(dentist).expect(200)).body).toMatchObject({
      availablePaise: 0,
      shortfallPaise: 8000,
    });
    w = (
      await review(admin, w, 'rejected', { note: 'Refund in progress' }).expect(
        200,
      )
    ).body;
    expect(w.wallet.shortfallPaise).toBe(0);
    await pool.query("update transactions set status='paid' where id=$1", [id]);
    w = (await ask(dentist, 8000).expect(200)).body;
    w = (await review(admin, w, 'approved').expect(200)).body;
    w = (await review(admin, w, 'processing').expect(200)).body;
    await pool.query("update transactions set status='refunded' where id=$1", [
      id,
    ]);
    await review(admin, w, 'paid', {
      reference: 'WALLET-REFUND',
      paidOn: today(),
    }).expect(409);
    w = (
      await review(admin, w, 'paid', {
        reference: 'WALLET-REFUND',
        paidOn: today(),
        acknowledgeChanges: true,
      }).expect(200)
    ).body;
    expect(w.wallet).toMatchObject({
      availablePaise: 0,
      shortfallPaise: 8000,
      withdrawnPaise: 8000,
    });
    await earning(dentist);
    expect((await wallet(dentist).expect(200)).body).toMatchObject({
      availablePaise: 1026,
      shortfallPaise: 0,
    });
  });
  it('uses global settings for new bookings and applies an explicit backfill only to unpriced bookings', async () => {
    const admin = await actor('admin'),
      dentist = await actor('dentist'),
      patient = await actor('patient');
    const unpriced = await earning(dentist, 10029, null),
      old = await earning(dentist, 10029, 500);
    await configure(admin, 1000, 100, false);
    expect(
      (
        await pool.query(
          'select platform_fee_bps from transactions where id=$1',
          [unpriced],
        )
      ).rows[0].platform_fee_bps,
    ).toBeNull();
    await configure(admin, 1500, 100, true);
    expect(
      (
        await pool.query(
          'select platform_fee_bps from transactions where id=$1',
          [unpriced],
        )
      ).rows[0].platform_fee_bps,
    ).toBe(1500);
    expect(
      (
        await pool.query(
          'select platform_fee_bps from transactions where id=$1',
          [old],
        )
      ).rows[0].platform_fee_bps,
    ).toBe(500);
    await pool.query(
      "update dentists set offers_video=true,video_hours_from='10:00',video_hours_to='18:00',fee_video_paise=10029 where user_id=$1",
      [dentist.id],
    );
    const spy = jest
      .spyOn(app.get(RazorpayGatewayService), 'createOrder')
      .mockResolvedValue({ orderId: `order_${randomUUID()}` });
    const day = new Date(Date.now() + 3 * 86400000).toLocaleDateString(
      'en-CA',
      { timeZone: 'Asia/Kolkata' },
    );
    const booking = await post(patient, '/appointments', {
      dentistId: dentist.id,
      type: 'video',
      date: day,
      time: '10:00',
      concern: 'Synthetic fixture',
      paymentMethod: 'upi',
      idempotencyKey: randomUUID(),
    }).expect(201);
    spy.mockRestore();
    expect(
      (
        await pool.query(
          'select platform_fee_bps from transactions where appointment_id=$1',
          [booking.body.id],
        )
      ).rows[0].platform_fee_bps,
    ).toBe(1500);
    await configure(admin, 2000, 100, true);
    expect(
      (
        await pool.query(
          'select platform_fee_bps from transactions where appointment_id=$1',
          [booking.body.id],
        )
      ).rows[0].platform_fee_bps,
    ).toBe(1500);
  });
  it('preserves earlier batches, prevents a parallel manual payout path and shares bank-reference deduplication', async () => {
    const admin = await actor('admin'),
      dentist = await actor('dentist');
    const id = await earning(dentist);
    let batch = (await post(admin, path, input(dentist, [id])).expect(200))
      .body;
    batch = (await change(admin, batch, 'processing').expect(200)).body;
    await change(admin, batch, 'paid', {
      reference: 'SHARED-REFERENCE',
      paidOn: today(),
    }).expect(200);
    await configure(admin);
    await earning(dentist);
    expect((await wallet(dentist).expect(200)).body).toMatchObject({
      availablePaise: 9026,
      withdrawnPaise: 9026,
    });
    await post(admin, path, input(dentist, [await earning(dentist)])).expect(
      409,
    );
    let w = (await ask(dentist, 1000).expect(200)).body;
    w = (await review(admin, w, 'approved').expect(200)).body;
    w = (await review(admin, w, 'processing').expect(200)).body;
    await review(admin, w, 'paid', {
      reference: 'shared-reference',
      paidOn: today(),
    }).expect(409);
    await pool.query("update transactions set status='refunded' where id=$1", [
      id,
    ]);
    expect((await wallet(dentist).expect(200)).body.availablePaise).toBe(
      9026 - 1000,
    );
  });
  it('rolls back requests, notifications and decisions when audit logging fails', async () => {
    const admin = await actor('admin'),
      dentist = await actor('dentist');
    await configure(admin);
    await earning(dentist);
    const key = randomUUID();
    const spy = jest
      .spyOn(app.get(AuditService), 'log')
      .mockRejectedValueOnce(new Error('Synthetic wallet audit failure'));
    await ask(dentist, 1000, key).expect(500);
    spy.mockRestore();
    expect((await wallet(dentist).expect(200)).body.reservedPaise).toBe(0);
    expect(
      (
        await pool.query(
          "select count(*) from notifications where payload->>'withdrawalId'=$1",
          [key],
        )
      ).rows[0].count,
    ).toBe('0');
    const w = (await ask(dentist, 1000, key).expect(200)).body;
    const fail = jest
      .spyOn(app.get(AuditService), 'log')
      .mockRejectedValueOnce(new Error('Synthetic review audit failure'));
    await review(admin, w, 'rejected', { note: 'Synthetic rollback' }).expect(
      500,
    );
    fail.mockRestore();
    expect(
      (await get(admin, `/admin/withdrawals/${w.id}`).expect(200)).body.status,
    ).toBe('requested');
  });
  it('notifies the owner once per committed decision, preserves reasons and scopes all notification access', async () => {
    const admin = await actor('admin'),
      dentist = await actor('dentist'),
      other = await actor('dentist'),
      patient = await actor('patient');
    await configure(admin);
    await earning(dentist);
    let w = (await ask(dentist, 3000).expect(200)).body;
    const approved = {
      requestId: randomUUID(),
      version: w.version,
      action: 'approved',
    };
    const decisions = await Promise.all([
      post(admin, `/admin/withdrawals/${w.id}/actions`, approved).expect(200),
      post(admin, `/admin/withdrawals/${w.id}/actions`, approved).expect(200),
    ]);
    w = decisions[0].body;
    w = (await review(admin, w, 'processing').expect(200)).body;
    await review(admin, w, 'paid', {
      reference: 'SYNTHETIC-NOTIFICATION-TRANSFER',
      paidOn: today(),
    }).expect(200);
    const declined = (await ask(dentist, 2000).expect(200)).body;
    await review(admin, declined, 'rejected', {
      note: 'Please confirm the account holder',
    }).expect(200);
    const inbox = (await get(dentist, '/notifications').expect(200)).body;
    expect(inbox.unreadCount).toBe(4);
    expect(inbox.items).toHaveLength(4);
    expect(inbox.items.map((n: { status: string }) => n.status).sort()).toEqual(
      ['approved', 'paid', 'processing', 'rejected'],
    );
    const rejection = inbox.items.find(
      (n: { status: string }) => n.status === 'rejected',
    );
    expect(rejection).toMatchObject({
      type: 'wallet_withdrawal_updated',
      withdrawalId: declined.id,
      amountPaise: 2000,
      reason: 'Please confirm the account holder',
      readAt: null,
    });
    expect(JSON.stringify(inbox)).not.toContain('123456789012');
    expect(JSON.stringify(inbox)).not.toContain(
      'SYNTHETIC-NOTIFICATION-TRANSFER',
    );
    expect((await get(other, '/notifications').expect(200)).body.items).toEqual(
      [],
    );
    expect(
      (await get(patient, '/notifications').expect(200)).body.items,
    ).toEqual([]);
    expect(
      (await get(admin, '/notifications').expect(200)).body.items.every(
        (n: { type: string }) => n.type !== 'wallet_withdrawal_updated',
      ),
    ).toBe(true);
    await get(other, `/notifications/${rejection.id}`).expect(404);
    await get(other, '/notifications', { cursor: rejection.id }).expect(404);
    await request(app.getHttpServer())
      .patch(`/notifications/${rejection.id}/read`)
      .set('Authorization', `Bearer ${other.token}`)
      .expect(404);
    const read = await request(app.getHttpServer())
      .patch(`/notifications/${rejection.id}/read`)
      .set('Authorization', `Bearer ${dentist.token}`)
      .expect(200);
    expect(read.body.readAt).toBeTruthy();
    expect(read.body.reason).toBe(rejection.reason);
    expect(
      (await get(dentist, '/notifications').expect(200)).body.unreadCount,
    ).toBe(3);
    await post(dentist, '/notifications/read-all', {
      through: inbox.items[0].id,
    }).expect(200);
    expect(
      (await get(dentist, '/notifications').expect(200)).body.unreadCount,
    ).toBe(0);
  });

  it('rolls back a decision and its notification together and permits an identical retry', async () => {
    const admin = await actor('admin'),
      dentist = await actor('dentist');
    await configure(admin);
    await earning(dentist);
    const w = (await ask(dentist, 1000).expect(200)).body;
    const input = {
      requestId: randomUUID(),
      version: w.version,
      action: 'rejected',
      note: 'Synthetic retry reason',
    };
    const service = app.get(NotificationsService),
      insert = service.withdrawalUpdated.bind(service);
    const failure = jest
      .spyOn(service, 'withdrawalUpdated')
      .mockImplementationOnce(async (...args) => {
        await insert(...args);
        throw new Error('Synthetic failure after notification insert');
      });
    await post(admin, `/admin/withdrawals/${w.id}/actions`, input).expect(500);
    failure.mockRestore();
    expect(
      (await get(dentist, '/notifications').expect(200)).body.items,
    ).toEqual([]);
    expect(
      (await get(admin, `/admin/withdrawals/${w.id}`).expect(200)).body,
    ).toMatchObject({ status: 'requested', version: 1 });
    expect((await wallet(dentist).expect(200)).body.reservedPaise).toBe(1000);
    await post(admin, `/admin/withdrawals/${w.id}/actions`, input).expect(200);
    await post(admin, `/admin/withdrawals/${w.id}/actions`, input).expect(200);
    expect(
      (await get(dentist, '/notifications').expect(200)).body.items,
    ).toHaveLength(1);
    expect((await wallet(dentist).expect(200)).body.reservedPaise).toBe(0);
  });

  it('rolls back a global fee backfill when its audit write fails', async () => {
    const admin = await actor('admin'),
      dentist = await actor('dentist');
    const id = await earning(dentist, 10029, null);
    const policy = (await get(admin, '/admin/wallet-settings').expect(200))
      .body;
    const spy = jest
      .spyOn(app.get(AuditService), 'log')
      .mockRejectedValueOnce(
        new Error('Synthetic wallet settings audit failure'),
      );
    await request(app.getHttpServer())
      .patch('/admin/wallet-settings')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        version: policy.version,
        feeBps: 1000,
        minimumWithdrawalPaise: 100,
        applyToUnpriced: true,
      })
      .expect(500);
    spy.mockRestore();
    expect(
      (await get(admin, '/admin/wallet-settings').expect(200)).body,
    ).toMatchObject({
      version: policy.version,
      feeBps: null,
      minimumWithdrawalPaise: null,
    });
    expect(
      (
        await pool.query(
          'select platform_fee_bps from transactions where id=$1',
          [id],
        )
      ).rows[0].platform_fee_bps,
    ).toBeNull();
  });

  it('validates settings versions, amounts, paging and decision evidence', async () => {
    const admin = await actor('admin'),
      dentist = await actor('dentist');
    await configure(admin);
    await earning(dentist);
    const settings = (await get(admin, '/admin/wallet-settings').expect(200))
      .body;
    await request(app.getHttpServer())
      .patch('/admin/wallet-settings')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        version: settings.version - 1,
        feeBps: 1000,
        minimumWithdrawalPaise: 100,
      })
      .expect(409);
    for (const amount of [0, -1, 1.5]) await ask(dentist, amount).expect(400);
    for (const query of [{ page: 0 }, { limit: 101 }, { status: 'bad' }])
      await get(admin, '/admin/withdrawals', query).expect(400);
    const w = (await ask(dentist, 1000).expect(200)).body;
    await post(dentist, `/admin/withdrawals/${w.id}/actions`, {
      requestId: randomUUID(),
      version: 1,
      action: 'approved',
    }).expect(403);
    await get(admin, '/admin/withdrawals/not-a-uuid').expect(400);
    expect(
      (
        await get(admin, '/admin/withdrawals', {
          q: dentist.id,
          limit: 1,
        }).expect(200)
      ).body.items,
    ).toHaveLength(0);
  });
});
