import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import * as request from 'supertest';
import { createHmac, randomInt, randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { AppModule } from '../../src/app.module';
import { HttpExceptionFilter } from '../../src/common/filters/http-exception.filter';
import { RazorpayGatewayService } from '../../src/modules/payments/razorpay-gateway.service';
import { RefundDeliveryService } from '../../src/modules/payments/refund-delivery.service';
import { PaymentReconciliationService } from '../../src/modules/payments/payment-reconciliation.service';
import { PaymentExpiryService } from '../../src/modules/payments/payment-expiry.service';

describe('Payments: confirmation, cancellation and durable refunds (e2e)', () => {
  let app: INestApplication, pool: Pool, gateway: RazorpayGatewayService;
  let delivery: RefundDeliveryService, expiry: PaymentExpiryService;
  let token: (id: string, role?: string) => string;

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication({ rawBody: true });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    gateway = app.get(RazorpayGatewayService);
    delivery = app.get(RefundDeliveryService);
    expiry = app.get(PaymentExpiryService);
    token = (id, role = 'patient') => app.get(JwtService).sign({ sub: id, role });
  });
  beforeEach(async () => {
    // Other test fixtures share only this disposable schema. Keep their jobs out of this worker tick.
    await pool.query(
      "update payment_refunds set next_attempt_at = now() + interval '1 day' where status = 'pending'"
    );
    await pool.query(
      "update transactions set next_payment_check_at = now() + interval '1 day' where next_payment_check_at <= now()"
    );
  });
  afterAll(async () => {
    await pool.end();
    await app.close();
  });

  function post(payload: object, valid = true) {
    const raw = JSON.stringify(payload);
    const signature = valid
      ? createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET!).update(raw).digest('hex')
      : 'bad';
    return request(app.getHttpServer())
      .post('/payments/webhook')
      .set('Content-Type', 'application/json')
      .set('X-Razorpay-Signature', signature)
      .send(raw);
  }

  async function fixture() {
    const patientId = randomUUID(),
      dentistId = randomUUID(),
      appointmentId = randomUUID();
    const transactionId = randomUUID(),
      orderId = `order_${randomUUID()}`,
      paymentId = `pay_${randomUUID()}`;
    await pool.query("insert into users (id, role, mobile) values ($1,'patient',$3),($2,'dentist',$4)", [
      patientId,
      dentistId,
      `+91${randomInt(6000000000, 9999999999)}`,
      `+91${randomInt(6000000000, 9999999999)}`,
    ]);
    await pool.query(
      "insert into patients (user_id, full_name, date_of_birth) values ($1,'Synthetic payment patient','1990-01-01')",
      [patientId]
    );
    await pool.query(
      `insert into dentists (user_id, full_name, qualification, specialization, council_reg_no, status)
      values ($1,'Synthetic payment dentist','BDS','General Dentist',$2,'verified')`,
      [dentistId, randomUUID()]
    );
    await pool.query(
      `insert into appointments (id, patient_id, dentist_id, type, scheduled_date, scheduled_time, concern_summary)
      values ($1,$2,$3,'video','2027-03-01','10:00','Synthetic payment fixture')`,
      [appointmentId, patientId, dentistId]
    );
    await pool.query(
      `insert into transactions (id, appointment_id, idempotency_key, amount_paise, method, gateway_ref, payment_expires_at)
      values ($1,$2,$3,40050,'upi',$4,now() + interval '15 minutes')`,
      [transactionId, appointmentId, randomUUID(), orderId]
    );
    return { patientId, dentistId, appointmentId, transactionId, orderId, paymentId };
  }
  type Fixture = Awaited<ReturnType<typeof fixture>>;
  const payment = (f: Fixture, event = 'payment.captured', extra: object = {}) =>
    post({
      event,
      payload: {
        payment: {
          entity: { id: f.paymentId, order_id: f.orderId, amount: 40050, currency: 'INR', ...extra },
        },
      },
    });
  const refund = (f: Fixture, id: string, event = 'refund.processed', extra: object = {}) =>
    post({
      event,
      payload: {
        refund: { entity: { id, payment_id: f.paymentId, amount: 40050, currency: 'INR', ...extra } },
      },
    });
  const cancel = (f: Fixture) =>
    request(app.getHttpServer())
      .post(`/appointments/${f.appointmentId}/cancel`)
      .set('Authorization', `Bearer ${token(f.patientId)}`);
  async function current(f: Fixture) {
    return (
      await pool.query(
        `select t.*, a.status as appointment_status from transactions t join appointments a on a.id = t.appointment_id where t.id = $1`,
        [f.transactionId]
      )
    ).rows[0];
  }
  async function job(f: Fixture) {
    return (await pool.query('select * from payment_refunds where transaction_id = $1', [f.transactionId]))
      .rows[0];
  }
  async function due(f: Fixture) {
    await pool.query(
      "update payment_refunds set next_attempt_at = now() - interval '1 second' where transaction_id = $1",
      [f.transactionId]
    );
  }

  it('rejects bad signatures and malformed known events', async () => {
    await post({ event: 'payment.captured', payload: {} }, false).expect(400);
    await post({ event: 'payment.captured', payload: {} }).expect(400);
    await post({ event: 'refund.processed', payload: {} }).expect(400);
    await post({ event: 'unknown.event' }).expect(200);
  });
  it('accepts the exact captured amount and ignores concurrent duplicate captures and late failures', async () => {
    const f = await fixture();
    await Promise.all([payment(f).expect(200), payment(f).expect(200)]);
    await payment(f, 'payment.failed').expect(200);
    expect(await current(f)).toMatchObject({
      status: 'paid',
      gateway_payment_ref: f.paymentId,
      appointment_status: 'booked',
    });
    expect(await job(f)).toBeUndefined();
  });
  it('rejects a capture with another amount or currency without changing the booking', async () => {
    const f = await fixture();
    await payment(f, 'payment.captured', { amount: 1 }).expect(400);
    await payment(f, 'payment.captured', { currency: 'USD' }).expect(400);
    expect(await current(f)).toMatchObject({ status: 'pending', gateway_payment_ref: null });
  });
  it('allows another checkout attempt on the same order after payment.failed', async () => {
    const f = await fixture();
    await payment(f, 'payment.failed').expect(200);
    expect(await current(f)).toMatchObject({ status: 'failed', appointment_status: 'booked' });
    await payment(f).expect(200);
    expect(await current(f)).toMatchObject({ status: 'paid', appointment_status: 'booked' });
  });
  it('cancels and saves one refund atomically, then stays processing until confirmed', async () => {
    const f = await fixture();
    await payment(f).expect(200);
    const results = await Promise.all([cancel(f).expect(200), cancel(f).expect(200)]);
    expect(results[0].body.payment.status).toBe('refund_pending');
    expect(gateway.refund).not.toHaveBeenCalled();
    const saved = await job(f);
    expect(saved).toMatchObject({ payment_ref: f.paymentId, amount_paise: 40050, status: 'pending' });
    await delivery.runOnce();
    expect(gateway.refund).toHaveBeenCalledTimes(1);
    expect(gateway.refund).toHaveBeenCalledWith(f.paymentId, 40050, saved.id);
    expect(await current(f)).toMatchObject({ status: 'refund_pending', appointment_status: 'cancelled' });
    const submitted = await job(f);
    await refund(f, submitted.gateway_ref).expect(200);
    await refund(f, submitted.gateway_ref).expect(200);
    await refund(f, submitted.gateway_ref, 'refund.created').expect(200);
    await refund(f, submitted.gateway_ref, 'refund.failed').expect(200);
    expect(await current(f)).toMatchObject({ status: 'refunded', appointment_status: 'cancelled' });
    expect((await job(f)).status).toBe('processed');
  });
  it('retries a network timeout with the same saved amount and gateway idempotency key', async () => {
    const f = await fixture();
    await payment(f).expect(200);
    await cancel(f).expect(200);
    const id = (await job(f)).id;
    (gateway.refund as jest.Mock).mockRejectedValueOnce(
      new Error('Synthetic timeout after gateway acceptance')
    );
    await delivery.runOnce();
    expect(await job(f)).toMatchObject({
      id,
      status: 'pending',
      last_error_code: 'gateway-request-error',
      gateway_ref: null,
    });
    await due(f);
    await delivery.runOnce();
    expect((gateway.refund as jest.Mock).mock.calls).toEqual([
      [f.paymentId, 40050, id],
      [f.paymentId, 40050, id],
    ]);
    expect((await current(f)).status).toBe('refund_pending');
  });
  it('recovers a worker lease after a restart without changing the request key', async () => {
    const f = await fixture();
    await payment(f).expect(200);
    await cancel(f).expect(200);
    const saved = await job(f);
    await pool.query(
      "update payment_refunds set lease_token = $2, lease_until = now() - interval '1 second' where id = $1",
      [saved.id, randomUUID()]
    );
    await delivery.runOnce();
    expect(gateway.refund).toHaveBeenCalledWith(f.paymentId, 40050, saved.id);
  });
  it('claims a refund only once across concurrent workers', async () => {
    const f = await fixture();
    await payment(f).expect(200);
    await cancel(f).expect(200);
    await Promise.all([delivery.runOnce(), delivery.runOnce()]);
    expect(gateway.refund).toHaveBeenCalledTimes(1);
  });
  it('reconciles a missing refund webhook through an authenticated gateway read', async () => {
    const f = await fixture();
    await payment(f).expect(200);
    await cancel(f).expect(200);
    await delivery.runOnce();
    const saved = await job(f);
    (gateway.fetchRefund as jest.Mock).mockResolvedValueOnce({
      refundId: saved.gateway_ref,
      paymentId: f.paymentId,
      amountPaise: 40050,
      currency: 'INR',
      status: 'processed',
    });
    await due(f);
    await delivery.runOnce();
    expect(gateway.refund).toHaveBeenCalledTimes(1);
    expect(gateway.fetchRefund).toHaveBeenCalledWith(saved.gateway_ref);
    expect((await current(f)).status).toBe('refunded');
  });
  it('does not let a delayed pending provider response undo a processed webhook', async () => {
    const f = await fixture();
    await payment(f).expect(200);
    await cancel(f).expect(200);
    (gateway.refund as jest.Mock).mockImplementationOnce(async () => {
      await refund(f, 'rfnd_race').expect(200);
      return {
        refundId: 'rfnd_race',
        paymentId: f.paymentId,
        amountPaise: 40050,
        currency: 'INR',
        status: 'pending',
      };
    });
    await delivery.runOnce();
    expect((await current(f)).status).toBe('refunded');
    expect((await job(f)).status).toBe('processed');
  });
  it('refunds late captures on cancelled appointments without reopening their slot', async () => {
    const f = await fixture();
    await cancel(f).expect(200);
    await payment(f, 'payment.failed').expect(200);
    await payment(f).expect(200);
    await payment(f).expect(200);
    expect(await current(f)).toMatchObject({
      status: 'refund_pending',
      gateway_payment_ref: f.paymentId,
      appointment_status: 'cancelled',
    });
    expect(await job(f)).toMatchObject({ amount_paise: 40050 });
    await delivery.runOnce();
    expect(gateway.refund).toHaveBeenCalledTimes(1);
  });
  it('serializes capture versus cancellation and still queues exactly one refund', async () => {
    const f = await fixture();
    await Promise.all([payment(f).expect(200), cancel(f).expect(200)]);
    expect(await current(f)).toMatchObject({ status: 'refund_pending', appointment_status: 'cancelled' });
    expect(await job(f)).toBeDefined();
  });
  it('marks gateway-rejected refunds as needing attention, and accepts later processed confirmation', async () => {
    const f = await fixture();
    await payment(f).expect(200);
    await cancel(f).expect(200);
    await delivery.runOnce();
    const saved = await job(f);
    await refund(f, saved.gateway_ref, 'refund.failed').expect(200);
    await refund(f, saved.gateway_ref, 'refund.created').expect(200);
    expect((await current(f)).status).toBe('refund_failed');
    await refund(f, saved.gateway_ref).expect(200);
    expect((await current(f)).status).toBe('refunded');
  });
  it('does not mark partial or mismatched refunds complete', async () => {
    const f = await fixture();
    await payment(f).expect(200);
    await cancel(f).expect(200);
    await delivery.runOnce();
    const saved = await job(f);
    await refund(f, saved.gateway_ref, 'refund.processed', { amount: 50 }).expect(200);
    await refund(f, 'rfnd_wrong').expect(200);
    expect((await current(f)).status).toBe('refund_pending');
  });
  it('exhausts submission retries visibly and allows only admins to requeue the original request', async () => {
    const f = await fixture();
    await payment(f).expect(200);
    await cancel(f).expect(200);
    const saved = await job(f);
    await pool.query('update payment_refunds set attempts = 7 where id = $1', [saved.id]);
    (gateway.refund as jest.Mock).mockRejectedValueOnce(new Error('Synthetic timeout'));
    await delivery.runOnce();
    expect((await current(f)).status).toBe('refund_failed');
    const url = `/admin/payments/${f.transactionId}/refund/retry`;
    await request(app.getHttpServer()).post(url).expect(401);
    await request(app.getHttpServer())
      .post(url)
      .set('Authorization', `Bearer ${token(f.patientId)}`)
      .expect(403);
    const admin = randomUUID();
    await pool.query(
      "insert into users (id, role, email, password_hash) values ($1,'admin',$2,'synthetic-test-only')",
      [admin, `${admin}@example.test`]
    );
    const retry = () =>
      request(app.getHttpServer())
        .post(url)
        .set('Authorization', `Bearer ${token(admin, 'admin')}`);
    await Promise.all([retry().expect(202), retry().expect(202)]);
    expect(await job(f)).toMatchObject({ id: saved.id, status: 'pending', attempts: 0 });
    expect((await current(f)).status).toBe('refund_pending');
    expect(
      (
        await pool.query(
          "select id from audit_log where entity_id = $1 and action = 'refund_retry_requested'",
          [f.appointmentId]
        )
      ).rows
    ).toHaveLength(1);
    await delivery.runOnce();
    expect(gateway.refund).toHaveBeenLastCalledWith(f.paymentId, 40050, saved.id);
  });
  it('expires only new unpaid online holds, preserves paid/legacy bookings, and refunds late captures', async () => {
    const expired = await fixture(),
      paid = await fixture(),
      legacy = await fixture();
    await pool.query(
      "update transactions set payment_expires_at = now() - interval '1 second' where id = any($1::uuid[])",
      [[expired.transactionId, paid.transactionId]]
    );
    await pool.query('update transactions set payment_expires_at = null where id = $1', [
      legacy.transactionId,
    ]);
    await payment(paid).expect(200);
    await Promise.all([expiry.runOnce(), expiry.runOnce()]);
    expect(await current(expired)).toMatchObject({ status: 'cancelled', appointment_status: 'cancelled' });
    expect((await current(paid)).appointment_status).toBe('booked');
    expect((await current(legacy)).appointment_status).toBe('booked');
    const notifications = await pool.query(
      "select id from notifications where user_id = $1 and template_key = 'appointment_cancelled'",
      [expired.patientId]
    );
    expect(notifications.rows).toHaveLength(1);
    await payment(expired).expect(200);
    expect((await current(expired)).status).toBe('refund_pending');
  });
  it('recovers payment confirmation when a capture webhook is missing', async () => {
    const f = await fixture();
    await pool.query('update transactions set next_payment_check_at = now() where id = $1', [
      f.transactionId,
    ]);
    (gateway.fetchOrderPayments as jest.Mock).mockResolvedValueOnce([
      { id: f.paymentId, order_id: f.orderId, amount: 40050, currency: 'INR', status: 'captured' },
    ]);
    await app.get(PaymentReconciliationService).runOnce();
    expect(await current(f)).toMatchObject({ status: 'paid', appointment_status: 'booked' });
  });
  it('refunds a captured payment found by reconciliation after its checkout hold expires', async () => {
    const f = await fixture();
    await pool.query(
      "update transactions set next_payment_check_at = now(), payment_expires_at = now() - interval '1 second' where id = $1",
      [f.transactionId]
    );
    await expiry.runOnce();
    (gateway.fetchOrderPayments as jest.Mock).mockResolvedValueOnce([
      { id: f.paymentId, order_id: f.orderId, amount: 40050, currency: 'INR', status: 'captured' },
    ]);
    await app.get(PaymentReconciliationService).runOnce();
    expect(await current(f)).toMatchObject({ status: 'refund_pending', appointment_status: 'cancelled' });
    expect(await job(f)).toBeDefined();
  });
  it('tracks a full refund started in the gateway dashboard without submitting another refund', async () => {
    const f = await fixture();
    await payment(f).expect(200);
    await refund(f, 'rfnd_dashboard', 'refund.created').expect(200);
    expect(await job(f)).toMatchObject({ gateway_ref: 'rfnd_dashboard', status: 'pending' });
    (gateway.fetchRefund as jest.Mock).mockResolvedValueOnce({ refundId: 'rfnd_dashboard', paymentId: f.paymentId, amountPaise: 40050, currency: 'INR', status: 'processed' });
    await due(f); await delivery.runOnce();
    expect(gateway.refund).not.toHaveBeenCalled();
    expect(gateway.fetchRefund).toHaveBeenCalledWith('rfnd_dashboard');
    expect((await current(f)).status).toBe('refunded');
  });

});
