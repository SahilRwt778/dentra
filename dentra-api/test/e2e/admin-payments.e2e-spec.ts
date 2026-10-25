import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { createHmac, randomInt, randomUUID } from 'node:crypto';
import * as request from 'supertest';
import { Pool } from 'pg';
import { AppModule } from '../../src/app.module';
import { HttpExceptionFilter } from '../../src/common/filters/http-exception.filter';

describe('Admin payments reporting (e2e)', () => {
  let app: INestApplication;
  let pool: Pool;
  let jwt: JwtService;
  let adminToken: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ rawBody: true });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    jwt = moduleRef.get(JwtService);
    const { rows } = await pool.query(
      `insert into users (role, email, password_hash) values ('admin', $1, 'test-only') returning id`,
      [`payment-report-${randomUUID()}@dentra.test`],
    );
    adminToken = jwt.sign({ sub: rows[0].id, role: 'admin' });
  });
  afterAll(async () => { await pool.end(); await app.close(); });

  const list = (query: Record<string, string | number> = {}) => request(app.getHttpServer())
    .get('/admin/payments').set('Authorization', `Bearer ${adminToken}`).query(query);

  async function fixture(onlyPaidCount?: number) {
    const tag = `report-${randomUUID()}`;
    const patient = await pool.query(`insert into users (role, mobile) values ('patient', $1) returning id`, [`+91${randomInt(6000000000, 9999999999)}`]);
    const dentist = await pool.query(`insert into users (role, mobile) values ('dentist', $1) returning id`, [`+91${randomInt(6000000000, 9999999999)}`]);
    await pool.query(`insert into patients (user_id, full_name, date_of_birth) values ($1, $2, '1990-01-01')`, [patient.rows[0].id, `Patient ${tag}`]);
    await pool.query(`insert into dentists (user_id, full_name, qualification, specialization, council_reg_no, status)
      values ($1, $2, 'BDS', 'General Dentist', $3, 'verified')`, [dentist.rows[0].id, `Dentist ${tag}`, tag]);
    const clinic = await pool.query(`insert into dentist_clinics (dentist_id, name) values ($1, 'Test clinic') returning id`, [dentist.rows[0].id]);
    const statuses = onlyPaidCount ? Array.from({ length: onlyPaidCount }, () => 'paid')
      : ['paid', 'pending', 'due_at_clinic', 'refunded', 'failed', 'cancelled'];
    const created = ['2026-10-16T18:29:59Z', '2026-10-16T18:30:00Z', '2026-10-17T18:29:59Z', '2026-10-17T18:30:00Z'];
    const items: { id: string; appointmentId: string; orderId: string | null; amount: number; status: string }[] = [];
    for (const [index, status] of statuses.entries()) {
      const inClinic = status === 'due_at_clinic';
      const appointment = await pool.query(`insert into appointments (patient_id, dentist_id, clinic_id, type, scheduled_date, scheduled_time, concern_summary)
        values ($1, $2, $3, $4, date '2027-05-01' + $5::integer, '10:00', 'Synthetic reporting fixture') returning id`,
      [patient.rows[0].id, dentist.rows[0].id, inClinic ? clinic.rows[0].id : null, inClinic ? 'clinic' : 'video', index]);
      const orderId = inClinic ? null : `order_${randomUUID()}`;
      const amount = onlyPaidCount ? 12501 : 40050 + index * 10000;
      const transaction = await pool.query(`insert into transactions
        (appointment_id, idempotency_key, amount_paise, method, status, gateway_ref, gateway_payment_ref, created_at)
        values ($1, $2, $3, $4, $5, $6, $7, $8) returning id`,
      [appointment.rows[0].id, randomUUID(), amount, inClinic ? 'pay_at_clinic' : index === 0 ? 'card' : 'upi', status,
        orderId, ['paid', 'refunded'].includes(status) ? `pay_${randomUUID()}` : null,
        onlyPaidCount ? '2026-10-17T10:00:00Z' : created[index] ?? '2026-10-19T10:00:00Z']);
      items.push({ id: transaction.rows[0].id, appointmentId: appointment.rows[0].id, orderId, amount, status });
    }
    return { tag, items };
  }

  it('requires admin authorization', async () => {
    await request(app.getHttpServer()).get('/admin/payments').expect(401);
    for (const role of ['patient', 'dentist']) {
      const token = jwt.sign({ sub: randomUUID(), role });
      await request(app.getHttpServer()).get('/admin/payments').set('Authorization', `Bearer ${token}`).expect(403);
    }
  });

  it('reports real records and exact paise totals, without changing payments or exposing credentials', async () => {
    const data = await fixture();
    const before = await pool.query('select * from transactions where id = any($1::uuid[]) order by id', [data.items.map(item => item.id)]);
    const response = await list({ q: data.tag }).expect(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body.summary).toEqual({
      totalTransactions: 6, paidAmountPaise: 40050, pendingAmountPaise: 50050,
      dueAtClinicAmountPaise: 60050, refundedAmountPaise: 70050, refundPendingAmountPaise: 0, refundFailedAmountPaise: 0,
    });
    expect(response.body.items).toHaveLength(6);
    expect(response.body.items.every((item: { patientName: string; dentistName: string }) =>
      item.patientName === `Patient ${data.tag}` && item.dentistName === `Dentist ${data.tag}`)).toBe(true);
    expect(response.body.gateway).toEqual({ provider: 'razorpay', mode: 'test', checkoutConfigured: true, webhookConfigured: true });
    expect(JSON.stringify(response.body)).not.toContain(process.env.RAZORPAY_KEY_SECRET!);
    expect(JSON.stringify(response.body)).not.toContain(process.env.RAZORPAY_WEBHOOK_SECRET!);
    const after = await pool.query('select * from transactions where id = any($1::uuid[]) order by id', [data.items.map(item => item.id)]);
    expect(after.rows).toEqual(before.rows);
  });

  it('filters statuses and methods, searches references, and treats wildcard characters literally', async () => {
    const data = await fixture();
    const paid = await list({ q: data.tag, status: 'paid', method: 'card' }).expect(200);
    expect(paid.body.items.map((item: { id: string }) => item.id)).toEqual([data.items[0].id]);
    expect(paid.body.summary).toMatchObject({ totalTransactions: 1, paidAmountPaise: 40050, pendingAmountPaise: 0 });
    for (const reference of [data.items[0].id, data.items[0].appointmentId, data.items[0].orderId!]) {
      const result = await list({ q: reference }).expect(200);
      expect(result.body.items.map((item: { id: string }) => item.id)).toEqual([data.items[0].id]);
    }
    const literal = await list({ q: `${data.tag}%` }).expect(200);
    expect(literal.body.summary.totalTransactions).toBe(0);
  });

  it('uses inclusive IST transaction dates, independently of appointment dates', async () => {
    const data = await fixture();
    const result = await list({ q: data.tag, from: '2026-10-17', to: '2026-10-17' }).expect(200);
    expect(result.body.items.map((item: { id: string }) => item.id).sort()).toEqual([data.items[1].id, data.items[2].id].sort());
    expect(result.body.summary).toMatchObject({ totalTransactions: 2, pendingAmountPaise: 50050, dueAtClinicAmountPaise: 60050, paidAmountPaise: 0 });
  });

  it('paginates deterministically while keeping totals across every matching page', async () => {
    const data = await fixture(24);
    const first = await list({ q: data.tag }).expect(200);
    const second = await list({ q: data.tag, page: 2 }).expect(200);
    expect(first.body.items).toHaveLength(20);
    expect(first.body.nextPage).toBe(2);
    expect(second.body.items).toHaveLength(4);
    expect(second.body.nextPage).toBeNull();
    expect(first.body.summary).toEqual(second.body.summary);
    expect(first.body.summary).toMatchObject({ totalTransactions: 24, paidAmountPaise: 24 * 12501 });
    const ids = [...first.body.items, ...second.body.items].map((item: { id: string }) => item.id);
    expect(new Set(ids).size).toBe(24);
    expect([...ids].sort().reverse()).toEqual(ids);
    const again = await list({ q: data.tag }).expect(200);
    expect(again.body.items.map((item: { id: string }) => item.id)).toEqual(ids.slice(0, 20));
  });

  it('returns genuine empty results and zero totals', async () => {
    const response = await list({ q: randomUUID() }).expect(200);
    expect(response.body.items).toEqual([]);
    expect(response.body.nextPage).toBeNull();
    expect(Object.values(response.body.summary)).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });

  it('validates filters before executing a payment report', async () => {
    const invalid: Record<string, string | number>[] = [
      { status: 'unknown' }, { method: 'cash' }, { page: 0 }, { page: 1.5 }, { page: 100001 },
      { from: '2026-02-30' }, { from: '2026-10-17T00:00:00Z' },
      { from: '2026-10-18', to: '2026-10-17' }, { q: 'a'.repeat(101) },
    ];
    for (const query of invalid) await list(query).expect(400);
  });

  it('reflects an actual signed capture webhook on the next read', async () => {
    const data = await fixture();
    const pending = data.items[1];
    const before = await list({ q: pending.id }).expect(200);
    expect(before.body.items[0].status).toBe('pending');
    const raw = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_report_capture', order_id: pending.orderId, amount: pending.amount, currency: 'INR' } } } });
    const signature = createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET!).update(raw).digest('hex');
    await request(app.getHttpServer()).post('/payments/webhook').set('Content-Type', 'application/json')
      .set('X-Razorpay-Signature', signature).send(raw).expect(200);
    const after = await list({ q: pending.id }).expect(200);
    expect(after.body.items[0]).toMatchObject({ status: 'paid', gatewayPaymentId: 'pay_report_capture' });
    expect(after.body.summary).toMatchObject({ paidAmountPaise: pending.amount, pendingAmountPaise: 0 });
  });
  it('separates processing and failed refunds from completed refunds, and searches refund references', async () => {
    const data = await fixture();
    const [processing, failed] = data.items;
    await pool.query("update transactions set status = 'refund_pending', gateway_payment_ref = 'pay_report_refund' where id = $1", [processing.id]);
    await pool.query("update transactions set status = 'refund_failed' where id = $1", [failed.id]);
    const refundId = `rfnd_${randomUUID()}`;
    await pool.query(`insert into payment_refunds (transaction_id, payment_ref, amount_paise, gateway_ref)
      values ($1,'pay_report_refund',$2,$3)`, [processing.id, processing.amount, refundId]);
    const report = await list({ q: data.tag }).expect(200);
    expect(report.body.summary).toMatchObject({ paidAmountPaise: 0, pendingAmountPaise: 0,
      refundPendingAmountPaise: processing.amount, refundFailedAmountPaise: failed.amount, refundedAmountPaise: 70050 });
    const filtered = await list({ q: data.tag, status: 'refund_pending' }).expect(200);
    expect(filtered.body.items.map((item: { id: string }) => item.id)).toEqual([processing.id]);
    const reference = await list({ q: refundId }).expect(200);
    expect(reference.body.items[0]).toMatchObject({ id: processing.id, gatewayRefundId: refundId });
  });

});
